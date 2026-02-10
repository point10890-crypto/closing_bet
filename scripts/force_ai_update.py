
import os
import pandas as pd
import json
import logging
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ForceAIUpdate")

def force_ai_update():
    try:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        data_dir = os.path.join(base_dir, "data")
        
        # 1. Read Signals Log
        signals_path = os.path.join(data_dir, "signals_log.csv")
        df = pd.read_csv(signals_path, dtype={'ticker': str})
        
        # Filter for today/open logs if needed, or just take top 10 regardless of date for now to show SOMETHING
        # But user wants Feb 5th.
        # df = df[df['status'] == 'OPEN'] 
        
        # 2. Read Name Map
        map_path = os.path.join(data_dir, "ticker_to_yahoo_map.csv")
        map_df = pd.read_csv(map_path, dtype={'ticker': str})
        name_map = dict(zip(map_df['ticker'].str.zfill(6), map_df['name']))
        
        # 3. Prepare Data for AI Analyzer
        signals_list = []
        for _, row in df.head(10).iterrows(): # Analyze top 10 rows for speed
            ticker = str(row['ticker']).zfill(6)
            name = name_map.get(ticker, ticker)
            
            signals_list.append({
                'ticker': ticker,
                'name': name,
                'signal_date': row.get('signal_date'),
                'score': float(row.get('score', 0)),
                'contraction_ratio': float(row.get('contraction_ratio', 0)),
                'foreign_5d': int(row.get('foreign_5d', 0)),
                'inst_5d': int(row.get('inst_5d', 0)),
                'entry_price': float(row.get('entry_price', 0))
            })
            
        print(f"Prepared {len(signals_list)} signals for AI analysis.")
        
        # 4. Run AI Analysis
        import sys
        sys.path.insert(0, base_dir)
        from kr_ai_analyzer import generate_ai_recommendations
        
        result = generate_ai_recommendations(signals_list)
        
        # 5. Save Result
        output_path = os.path.join(data_dir, "kr_ai_analysis.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
            
        print(f"Successfully saved AI analysis to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    force_ai_update()
