#!/usr/bin/env python3
"""
Update Portfolio History Script

This script consolidates all picks from us_market/archive/*.csv files
into a single portfolio_history.csv file in us_market/history/.

The consolidated file stores:
- ticker: Stock symbol
- entry_date: Date the pick was made (from filename)
- entry_price: Price at the time of pick (current_price from archive file)
- grade: AI grade assigned to the pick

Run this script whenever new archive files are added to update the history.
"""

import os
import glob
import pandas as pd
from datetime import datetime

def update_portfolio_history():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    archive_dir = os.path.join(base_dir, 'us_market', 'archive')
    history_dir = os.path.join(base_dir, 'us_market', 'history')
    output_file = os.path.join(history_dir, 'portfolio_history.csv')
    
    print(f"📂 Archive Directory: {archive_dir}")
    print(f"📂 Output File: {output_file}")
    
    # Ensure history directory exists
    os.makedirs(history_dir, exist_ok=True)
    
    # Load existing history if it exists
    existing_entries = set()
    if os.path.exists(output_file):
        try:
            existing_df = pd.read_csv(output_file)
            for _, row in existing_df.iterrows():
                key = (row['ticker'], row['entry_date'])
                existing_entries.add(key)
            print(f"📋 Loaded {len(existing_entries)} existing entries")
        except Exception as e:
            print(f"⚠️ Could not load existing file: {e}")
            existing_df = pd.DataFrame()
    else:
        existing_df = pd.DataFrame()
    
    # Find all archive files
    pick_files = sorted(glob.glob(os.path.join(archive_dir, 'picks_*.csv')))
    print(f"🔍 Found {len(pick_files)} archive files")
    
    if not pick_files:
        print("❌ No archive files found!")
        return
    
    # Collect all new picks
    new_picks = []
    
    for file_path in pick_files:
        try:
            filename = os.path.basename(file_path)
            date_str = filename.replace('picks_', '').replace('.csv', '')
            entry_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            
            df = pd.read_csv(file_path)
            if df.empty or 'ticker' not in df.columns:
                print(f"  ⏭️ Skipping {filename}: empty or no ticker column")
                continue
            
            # Get top 10 picks from each file
            top_picks = df.head(10)
            added_count = 0
            
            for _, row in top_picks.iterrows():
                ticker = str(row.get('ticker', '')).strip()
                entry_price = row.get('current_price', 0)
                grade = row.get('grade', 'N/A')
                
                if not ticker or not entry_price or entry_price <= 0:
                    continue
                
                key = (ticker, entry_date)
                if key in existing_entries:
                    continue  # Skip duplicates
                
                existing_entries.add(key)
                new_picks.append({
                    'ticker': ticker,
                    'entry_date': entry_date,
                    'entry_price': round(float(entry_price), 2),
                    'grade': grade
                })
                added_count += 1
            
            if added_count > 0:
                print(f"  ✅ {filename}: Added {added_count} new picks")
            else:
                print(f"  ⏭️ {filename}: No new picks (all exist)")
                
        except Exception as e:
            print(f"  ❌ Error processing {file_path}: {e}")
            continue
    
    # Append new picks to existing data
    if new_picks:
        new_df = pd.DataFrame(new_picks)
        combined_df = pd.concat([existing_df, new_df], ignore_index=True)
        
        # Sort by entry_date descending
        combined_df = combined_df.sort_values('entry_date', ascending=False)
        
        # Save to CSV
        combined_df.to_csv(output_file, index=False)
        print(f"\n✅ Saved {len(combined_df)} total picks to {output_file}")
        print(f"   New picks added: {len(new_picks)}")
    else:
        print("\n📋 No new picks to add. History is up to date.")
    
    # Show summary
    if os.path.exists(output_file):
        final_df = pd.read_csv(output_file)
        print(f"\n📊 Portfolio History Summary:")
        print(f"   Total unique picks: {len(final_df)}")
        print(f"   Date range: {final_df['entry_date'].min()} to {final_df['entry_date'].max()}")
        print(f"   Unique tickers: {final_df['ticker'].nunique()}")

if __name__ == "__main__":
    print("=" * 50)
    print("Portfolio History Update Script")
    print(f"Run Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    update_portfolio_history()
