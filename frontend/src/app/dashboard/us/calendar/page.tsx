'use client';

import { useEffect, useState } from 'react';
import { usAPI, USCalendarEvent } from '@/lib/api';
import HelpButton from '@/components/ui/HelpButton';

export default function EconomicCalendarPage() {
    const [loading, setLoading] = useState(true);
    const [events, setEvents] = useState<USCalendarEvent[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [impactFilter, setImpactFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await usAPI.getCalendar();
            setEvents(res.events || []);
        } catch (error) {
            console.error('Failed to load calendar:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter by impact level then group by date
    const filteredEvents = impactFilter === 'all'
        ? events
        : events.filter(e => e.impact === impactFilter);

    const eventsByDate = filteredEvents.reduce((acc, event) => {
        const date = event.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
    }, {} as Record<string, USCalendarEvent[]>);

    // Calendar grid helpers
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().split('T')[0];

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToday = () => setCurrentDate(new Date());

    const monthLabel = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    // Build calendar days
    const calendarDays: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

    const getDateStr = (day: number) => {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };

    const getImpactCounts = (dateStr: string) => {
        const dayEvents = eventsByDate[dateStr] || [];
        return {
            high: dayEvents.filter(e => e.impact === 'high').length,
            medium: dayEvents.filter(e => e.impact === 'medium').length,
            low: dayEvents.filter(e => e.impact === 'low').length,
            total: dayEvents.length,
        };
    };

    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getImpactIcon = (impact: string) => {
        switch (impact) {
            case 'high': return 'fa-exclamation-triangle';
            case 'medium': return 'fa-info-circle';
            case 'low': return 'fa-check-circle';
            default: return 'fa-circle';
        }
    };

    const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/5 text-xs text-teal-400 font-medium mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping"></span>
                    Economic Events
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tighter text-white leading-tight mb-2">
                                Economic <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">Calendar</span>
                            </h2>
                            <HelpButton title="Economic Calendar 가이드" sections={[
                                { heading: '작동 원리', body: '미국 주요 경제 이벤트와 실적 발표 일정을 캘린더로 표시합니다.\n\n• Impact Level:\n  - High (빨강): FOMC, CPI, NFP 등 시장 큰 영향\n  - Medium (노랑): GDP, PPI, 소매판매 등 중간 영향\n  - Low (초록): 소규모 지표, 제한적 영향' },
                                { heading: '해석 방법', body: '• 빨간 점이 많은 날: 변동성 확대 예상, 포지션 축소 고려\n• FOMC 회의: 금리 결정일 전후 2-3일 높은 변동성\n• CPI/NFP: 발표 직후 급등락 후 방향 확정\n• 날짜 클릭 시 해당일 이벤트 상세 내용 표시' },
                                { heading: '활용 팁', body: '• Impact 필터로 중요도별 이벤트 선별 가능\n• High Impact 이벤트 전일에는 신규 포지션 진입 자제\n• 실적 발표와 경제 지표가 겹치는 날은 특히 주의\n• 월간 캘린더에서 이벤트 밀집 주간을 파악하세요' },
                            ]} />
                        </div>
                        <p className="text-gray-400">US economic events &amp; earnings schedule</p>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <i className={`fas fa-sync-alt mr-2 ${loading ? 'animate-spin' : ''}`}></i>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Impact Filter */}
            <div className="flex items-center gap-2">
                {(['all', 'high', 'medium', 'low'] as const).map(level => (
                    <button
                        key={level}
                        onClick={() => setImpactFilter(level)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${impactFilter === level
                                ? level === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                    : level === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                        : level === 'low' ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                            : 'bg-teal-500/20 text-teal-400 border-teal-500/30'
                                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                            }`}
                    >
                        {level !== 'all' && (
                            <span className={`w-2 h-2 rounded-full ${level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                        )}
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                ))}
            </div>

            {/* Calendar */}
            {loading ? (
                <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 p-8">
                    <div className="grid grid-cols-7 gap-2">
                        {Array.from({ length: 35 }).map((_, i) => (
                            <div key={i} className="h-20 rounded-lg bg-white/5 animate-pulse"></div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden">
                    {/* Month Navigation */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-white">{monthLabel}</h3>
                            <button
                                onClick={goToday}
                                className="px-2 py-0.5 text-[10px] rounded bg-teal-500/20 text-teal-400 hover:bg-teal-500/30 transition-colors font-bold"
                            >
                                TODAY
                            </button>
                        </div>
                        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>

                    {/* Day Headers */}
                    <div className="grid grid-cols-7 border-b border-white/10">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className={`py-2 text-center text-[10px] font-bold uppercase tracking-widest ${day === 'Sun' ? 'text-red-400/60' : day === 'Sat' ? 'text-blue-400/60' : 'text-gray-500'}`}>
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map((day, idx) => {
                            if (day === null) {
                                return <div key={`empty-${idx}`} className="min-h-[90px] border-b border-r border-white/5 bg-white/[0.01]"></div>;
                            }

                            const dateStr = getDateStr(day);
                            const counts = getImpactCounts(dateStr);
                            const isToday = dateStr === today;
                            const isSelected = dateStr === selectedDate;
                            const hasEvents = counts.total > 0;
                            const dayOfWeek = (firstDay + day - 1) % 7;
                            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                            return (
                                <div
                                    key={day}
                                    onClick={() => hasEvents && setSelectedDate(isSelected ? null : dateStr)}
                                    className={`min-h-[90px] p-2 border-b border-r border-white/5 transition-all relative
                                        ${hasEvents ? 'cursor-pointer hover:bg-teal-500/5' : ''}
                                        ${isSelected ? 'bg-teal-500/10 ring-1 ring-teal-500/30' : ''}
                                        ${isToday ? 'bg-white/[0.03]' : ''}
                                    `}
                                >
                                    {/* Day Number */}
                                    <div className={`text-sm font-bold mb-1 ${isToday
                                            ? 'w-7 h-7 rounded-full bg-teal-500 text-black flex items-center justify-center'
                                            : isWeekend
                                                ? dayOfWeek === 0 ? 'text-red-400/60' : 'text-blue-400/60'
                                                : 'text-gray-400'
                                        }`}>
                                        {day}
                                    </div>

                                    {/* Impact Dots */}
                                    {hasEvents && (
                                        <div className="space-y-1">
                                            {counts.high > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                                    <span className="text-[10px] text-red-400 font-bold">{counts.high}</span>
                                                </div>
                                            )}
                                            {counts.medium > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span>
                                                    <span className="text-[10px] text-yellow-400 font-bold">{counts.medium}</span>
                                                </div>
                                            )}
                                            {counts.low > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                    <span className="text-[10px] text-green-400 font-bold">{counts.low}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Event Detail Modal */}
            {selectedDate && selectedEvents.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDate(null)}>
                    <div
                        className="w-full max-w-xl max-h-[80vh] rounded-2xl bg-[#1c1c1e] border border-white/10 overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    <i className="fas fa-calendar-day text-teal-500 mr-2"></i>
                                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        weekday: 'long'
                                    })}
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">{selectedEvents.length} events</p>
                            </div>
                            <button
                                onClick={() => setSelectedDate(null)}
                                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex items-center justify-center"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto max-h-[65vh] p-4 space-y-3">
                            {selectedEvents.map((event, idx) => (
                                <div
                                    key={idx}
                                    className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-xs text-gray-500 font-mono">{event.time}</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getImpactColor(event.impact)}`}>
                                                    <i className={`fas ${getImpactIcon(event.impact)} mr-1`}></i>
                                                    {event.impact.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="text-sm font-bold text-white">{event.event}</div>
                                            {event.ai_outlook && (
                                                <div className="mt-2 text-xs text-gray-400 italic">
                                                    <i className="fas fa-robot mr-1 text-teal-500"></i>
                                                    {event.ai_outlook}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            {event.forecast && (
                                                <div className="text-xs text-gray-500">
                                                    Forecast: <span className="text-white font-bold">{event.forecast}</span>
                                                </div>
                                            )}
                                            {event.previous && (
                                                <div className="text-xs text-gray-500">
                                                    Previous: <span className="text-gray-400">{event.previous}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
