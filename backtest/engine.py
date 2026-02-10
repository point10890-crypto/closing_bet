#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
KR Market Backtest - Engine
백테스트 엔진 - Crypto VCP 아키텍처 기반

핵심 클래스:
- PositionManager: 포지션 관리 (진입, 청산, 사이징)
- TradeSimulator: 시뮬레이션 실행
"""
import logging
from typing import List, Dict, Optional, Callable
from dataclasses import dataclass
from datetime import datetime
import numpy as np

from config import BacktestConfig, MarketRegime
from models import Signal, Trade, BacktestResult

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class PositionManager:
    """포지션 관리자 - 진입, 청산, 자금 관리"""
    
    def __init__(self, config: BacktestConfig):
        self.config = config
        self.capital = config.initial_capital
        self.open_positions: Dict[str, Trade] = {}
        self.closed_trades: List[Trade] = []
        self.peak_capital = config.initial_capital
        self.max_drawdown = 0.0
        
    def can_open_position(self, ticker: str) -> bool:
        """새 포지션 진입 가능 여부"""
        # 이미 보유 중인 종목
        if ticker in self.open_positions:
            return False
        
        # 최대 포지션 수 초과
        if len(self.open_positions) >= self.config.max_positions:
            return False
        
        # 자본 부족
        min_position_value = self.capital * (self.config.position_size_pct / 100) * 0.5
        if self.capital < min_position_value:
            return False
        
        return True
    
    def calculate_position_size(self, entry_price: float, signal: Signal) -> int:
        """포지션 크기 계산 (주수)"""
        # 기본 포지션 크기 (자본의 X%)
        position_value = self.capital * (self.config.position_size_pct / 100)
        
        # 시그널 점수에 따른 조정 (고점수면 더 큰 포지션)
        score_multiplier = 0.8 + (signal.score / 100) * 0.4  # 0.8 ~ 1.2
        position_value *= score_multiplier
        
        # 주수 계산
        quantity = int(position_value / entry_price)
        
        return max(1, quantity)
    
    def open_position(self, signal: Signal, entry_price: float) -> Optional[Trade]:
        """새 포지션 진입"""
        if not self.can_open_position(signal.ticker):
            return None
        
        quantity = self.calculate_position_size(entry_price, signal)
        position_value = entry_price * quantity
        
        # 거래 비용 계산
        commission = position_value * (self.config.commission_pct / 100)
        slippage = position_value * (self.config.slippage_pct / 100)
        total_cost = position_value + commission + slippage
        
        if total_cost > self.capital:
            logger.warning(f"자본 부족: {signal.ticker}")
            return None
        
        # 손절가 계산
        stop_loss = entry_price * (1 - self.config.stop_loss_pct / 100)
        
        # 익절가 계산
        take_profit = entry_price * (1 + self.config.take_profit_pct / 100)
        
        # Trade 객체 생성
        trade = Trade(
            ticker=signal.ticker,
            name=signal.name,
            entry_time=signal.signal_time,
            entry_price=entry_price,
            entry_type=signal.signal_type,
            entry_score=signal.score,
            quantity=quantity,
            position_value=position_value,
            stop_loss=stop_loss,
            take_profit=take_profit,
            foreign_net_5d=signal.foreign_net_5d,
            inst_net_5d=signal.inst_net_5d,
            market_regime=signal.market_regime
        )
        
        # 자본 차감
        self.capital -= total_cost
        self.open_positions[signal.ticker] = trade
        
        logger.debug(f"진입: {signal.ticker} @ {entry_price:,.0f}원 x {quantity}주")
        
        return trade
    
    def check_exits(self, ticker: str, current_price: float, current_time: int,
                   high_price: float, foreign_net_today: int = 0,
                   rsi: Optional[float] = None) -> Optional[str]:
        """
        청산 조건 체크
        
        Returns:
            청산 사유 (None이면 청산 안함)
        """
        if ticker not in self.open_positions:
            return None
        
        trade = self.open_positions[ticker]
        
        # 1. 손절 (Stop Loss)
        if current_price <= trade.stop_loss:
            return "STOP_LOSS"
        
        # 2. 익절 (Take Profit)
        if trade.take_profit and current_price >= trade.take_profit:
            return "TAKE_PROFIT"
        
        # 3. 트레일링 스탑
        trailing_stop = high_price * (1 - self.config.trailing_stop_pct / 100)
        if current_price <= trailing_stop and current_price > trade.entry_price:
            return "TRAILING_STOP"
        
        # 4. 시간 제한
        holding_days = (current_time - trade.entry_time) // 86400
        if holding_days >= self.config.max_hold_days:
            return "TIME_EXIT"
        
        # 5. 외인 순매도 전환
        if self.config.exit_on_foreign_sell and foreign_net_today < 0:
            # 연속 순매도일 체크 필요 (여기서는 단순화)
            return "FOREIGN_SELL"
        
        # 6. RSI 과매수
        if rsi and rsi >= self.config.rsi_exit_threshold:
            return "RSI_EXIT"
        
        return None
    
    def close_position(self, ticker: str, exit_price: float, 
                      exit_time: int, exit_reason: str) -> Optional[Trade]:
        """포지션 청산"""
        if ticker not in self.open_positions:
            return None
        
        trade = self.open_positions.pop(ticker)
        
        # 청산 정보 업데이트
        trade.exit_time = exit_time
        trade.exit_price = exit_price
        trade.exit_reason = exit_reason
        
        # 수익금 계산
        gross_pnl = (exit_price - trade.entry_price) * trade.quantity
        
        # 거래 비용 (매도)
        exit_value = exit_price * trade.quantity
        commission = exit_value * (self.config.commission_pct / 100)
        tax = exit_value * (self.config.tax_pct / 100) if gross_pnl > 0 else 0
        
        net_pnl = gross_pnl - commission - tax
        
        # 자본 회수
        self.capital += exit_value - commission - tax
        
        # 최대 낙폭 업데이트
        if self.capital > self.peak_capital:
            self.peak_capital = self.capital
        else:
            drawdown = (self.peak_capital - self.capital) / self.peak_capital * 100
            self.max_drawdown = max(self.max_drawdown, drawdown)
        
        self.closed_trades.append(trade)
        
        logger.debug(f"청산: {ticker} @ {exit_price:,.0f}원 ({exit_reason}) "
                    f"PnL: {net_pnl:+,.0f}원 ({trade.return_pct:+.2f}%)")
        
        return trade
    
    def get_equity(self) -> float:
        """현재 총 자산 (현금 + 포지션 평가액)"""
        position_value = sum(
            pos.quantity * pos.entry_price  # 실제론 현재가로 계산해야 함
            for pos in self.open_positions.values()
        )
        return self.capital + position_value


class TradeSimulator:
    """거래 시뮬레이터"""
    
    def __init__(self, config: BacktestConfig):
        self.config = config
        self.position_manager = PositionManager(config)
        
    def should_take_signal(self, signal: Signal) -> bool:
        """시그널 필터링"""
        # 최소 점수
        if signal.score < self.config.min_score:
            return False
        
        # 연속 매수일
        if signal.consecutive_days < self.config.min_consecutive_days:
            return False
        
        # Market Regime
        if not self.config.should_trade_in_regime(signal.market_regime):
            return False
        
        # 환율 게이트
        if self.config.use_usd_krw_gate and signal.usd_krw > 1400:
            return False
        
        # 시그널 타입
        if signal.signal_type != self.config.entry_trigger and self.config.entry_trigger != "DOUBLE_BUY":
            # DOUBLE_BUY는 모든 시그널 허용
            if self.config.entry_trigger == "DOUBLE_BUY" and signal.signal_type not in ["FOREIGNER_BUY", "INST_SCOOP", "DOUBLE_BUY"]:
                return False
        
        return True
    
    def simulate(self, signals: List[Signal],
                price_getter: Callable,      # (ticker, timestamp) -> price
                high_getter: Callable,       # (ticker, start_ts, end_ts) -> high_price
                flow_getter: Callable = None # (ticker, timestamp) -> foreign_net
                ) -> BacktestResult:
        """
        백테스트 실행
        
        Args:
            signals: 시간순 정렬된 시그널 리스트
            price_getter: 가격 조회 함수
            high_getter: 고가 조회 함수
            flow_getter: 외인 수급 조회 함수 (선택)
        """
        logger.info(f"백테스트 시작: {len(signals)}개 시그널")
        
        equity_curve = []
        daily_timestamps = set()
        
        # 시그널 순회
        for signal in signals:
            # 시그널 필터링
            if not self.should_take_signal(signal):
                continue
            
            # 진입 가격 조회
            entry_price = price_getter(signal.ticker, signal.signal_time)
            if not entry_price:
                continue
            
            # 포지션 진입
            trade = self.position_manager.open_position(signal, entry_price)
            if not trade:
                continue
            
            # 청산 시뮬레이션 (간소화: 즉시 N일 후 청산)
            # 실제로는 일별 가격 데이터로 청산 조건 체크해야 함
            exit_time = signal.signal_time + (self.config.max_hold_days * 86400)
            exit_price = price_getter(signal.ticker, exit_time)
            
            if exit_price:
                high_price = high_getter(signal.ticker, signal.signal_time, exit_time) or exit_price
                
                # 청산 조건 체크
                exit_reason = self.position_manager.check_exits(
                    signal.ticker, exit_price, exit_time, high_price
                )
                
                if not exit_reason:
                    exit_reason = "TIME_EXIT"
                
                self.position_manager.close_position(
                    signal.ticker, exit_price, exit_time, exit_reason
                )
            
            # Equity 기록
            equity = self.position_manager.get_equity()
            equity_curve.append((signal.signal_time, equity))
        
        # 결과 계산
        return self._calculate_result(equity_curve)
    
    def _calculate_result(self, equity_curve: List[tuple]) -> BacktestResult:
        """백테스트 결과 계산"""
        trades = self.position_manager.closed_trades
        
        if not trades:
            return BacktestResult(
                config_name="default",
                start_date="",
                end_date="",
                initial_capital=self.config.initial_capital,
                final_capital=self.config.initial_capital,
                equity_curve=equity_curve
            )
        
        # 기본 통계
        total_trades = len(trades)
        winners = [t for t in trades if t.is_winner]
        losers = [t for t in trades if not t.is_winner]
        
        win_rate = len(winners) / total_trades * 100 if total_trades > 0 else 0
        
        # 수익률 통계
        returns = [t.return_pct for t in trades]
        avg_return = np.mean(returns) if returns else 0
        
        winner_returns = [t.return_pct for t in winners]
        loser_returns = [t.return_pct for t in losers]
        
        avg_winner = np.mean(winner_returns) if winner_returns else 0
        avg_loser = np.mean(loser_returns) if loser_returns else 0
        
        # R-Multiple
        r_multiples = [t.r_multiple for t in trades]
        avg_r = np.mean(r_multiples) if r_multiples else 0
        total_r = sum(r_multiples)
        
        # 총 수익률
        final_capital = self.position_manager.capital
        total_return = ((final_capital - self.config.initial_capital) / 
                       self.config.initial_capital * 100)
        
        # Sharpe Ratio (간소화)
        if returns and len(returns) > 1:
            sharpe = np.mean(returns) / np.std(returns) * np.sqrt(252 / len(returns))
        else:
            sharpe = 0
        
        # 보유 기간
        holding_days = [t.holding_days for t in trades if t.holding_days > 0]
        avg_holding = np.mean(holding_days) if holding_days else 0
        
        # 연속 승/패
        max_wins = max_losses = current_wins = current_losses = 0
        for trade in trades:
            if trade.is_winner:
                current_wins += 1
                current_losses = 0
                max_wins = max(max_wins, current_wins)
            else:
                current_losses += 1
                current_wins = 0
                max_losses = max(max_losses, current_losses)
        
        # 시그널별 통계
        signal_stats = {}
        for signal_type in ["FOREIGNER_BUY", "INST_SCOOP", "DOUBLE_BUY"]:
            type_trades = [t for t in trades if t.entry_type == signal_type]
            if type_trades:
                type_winners = [t for t in type_trades if t.is_winner]
                signal_stats[signal_type] = {
                    "count": len(type_trades),
                    "win_rate": len(type_winners) / len(type_trades) * 100,
                    "avg_return": np.mean([t.return_pct for t in type_trades])
                }
        
        return BacktestResult(
            config_name="default",
            start_date=datetime.fromtimestamp(trades[0].entry_time).strftime("%Y-%m-%d") if trades else "",
            end_date=datetime.fromtimestamp(trades[-1].exit_time).strftime("%Y-%m-%d") if trades and trades[-1].exit_time else "",
            total_trades=total_trades,
            winners=len(winners),
            losers=len(losers),
            win_rate=win_rate,
            avg_return_pct=avg_return,
            avg_winner_pct=avg_winner,
            avg_loser_pct=avg_loser,
            avg_r_multiple=avg_r,
            total_r=total_r,
            total_return_pct=total_return,
            max_drawdown_pct=self.position_manager.max_drawdown,
            sharpe_ratio=sharpe,
            initial_capital=self.config.initial_capital,
            final_capital=final_capital,
            avg_holding_days=avg_holding,
            max_consecutive_wins=max_wins,
            max_consecutive_losses=max_losses,
            signal_stats=signal_stats,
            trades=trades,
            equity_curve=equity_curve
        )


def run_backtest(signals: List[Signal],
                price_getter: Callable,
                high_getter: Callable,
                config: BacktestConfig = None) -> BacktestResult:
    """백테스트 실행 헬퍼 함수"""
    if config is None:
        config = BacktestConfig()
    
    simulator = TradeSimulator(config)
    return simulator.simulate(signals, price_getter, high_getter)
