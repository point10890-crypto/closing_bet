import pandas as pd
import os

def create_ticker_map():
    input_file = 'korean_stocks_list.csv'
    output_file = 'ticker_to_yahoo_map.csv'
    
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    try:
        # Read CSV with string dtype for ticker to preserve leading zeros
        # Also handle potential BOM in column names
        df = pd.read_csv(input_file, dtype=str)
        
        # Clean column names (remove BOM)
        df.columns = [c.replace('\ufeff', '') for c in df.columns]
        
        print(f"Loaded {len(df)} stocks from {input_file}")
        
        # Ensure 'ticker' and 'market' columns exist
        if 'ticker' not in df.columns or 'market' not in df.columns:
            print("Error: Required columns 'ticker' and 'market' not found.")
            print(f"Columns found: {df.columns.tolist()}")
            return

        # Function to determine Yahoo ticker
        def get_yahoo_ticker(row):
            ticker = str(row['ticker']).zfill(6)
            market = str(row['market']).upper()
            
            if market == 'KOSPI':
                return f"{ticker}.KS"
            elif market == 'KOSDAQ':
                return f"{ticker}.KQ"
            else:
                # Default to .KS if unknown, or log warning
                return f"{ticker}.KS"

        # Apply mapping
        df['yahoo_ticker'] = df.apply(get_yahoo_ticker, axis=1)
        
        # Select relevant columns
        map_df = df[['ticker', 'market', 'yahoo_ticker', 'name']]
        
        # Ensure ticker is padded in output too
        map_df['ticker'] = map_df['ticker'].apply(lambda x: str(x).zfill(6))
        
        # Save to CSV
        map_df.to_csv(output_file, index=False)
        print(f"✅ Successfully created {output_file} with {len(map_df)} mappings.")
        
        # Verification: Print a few samples
        print("\nSample Mappings:")
        print(map_df.head())
        
        print("\nChecking specific problematic tickers:")
        test_tickers = ['005930', '353810', '006620', '000950']
        for t in test_tickers:
            match = map_df[map_df['ticker'] == t]
            if not match.empty:
                print(f"{t} -> {match.iloc[0]['yahoo_ticker']} ({match.iloc[0]['market']})")
            else:
                print(f"{t} -> Not found!")

    except Exception as e:
        print(f"❌ Error creating ticker map: {e}")

if __name__ == "__main__":
    create_ticker_map()
