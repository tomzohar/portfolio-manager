#!/usr/bin/env python3
"""
Pre-Processor: Update Stock Prices in Google Sheets
"""

import yfinance as yf
import gspread
from google.oauth2.service_account import Credentials
from typing import List
from tenacity import retry, stop_after_attempt, wait_exponential
from ..config import SPREADSHEET_ID, get_google_creds

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=4, max=10))
def _fetch_prices_batch(tickers: List[str]):
    """Fetches prices in a batch with retry logic."""
    return yf.download(tickers, period="2d", progress=False, group_by='ticker')

def update_gsheet_prices(sheet_name: str = 'גיליון1', column_range: str = 'A:B'):
    """
    Fetches the latest closing price for each stock in the Google Sheet and updates it.
    If a price for a ticker cannot be fetched, its existing price in the sheet is preserved.
    """
    print("=" * 60)
    print("PRE-PROCESSING: UPDATING STOCK PRICES IN GOOGLE SHEET")
    print("=" * 60)
    
    # 1. Authenticate and connect to Google Sheets
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
    
    decoded_creds = get_google_creds()
    if decoded_creds:
        creds = Credentials.from_service_account_info(decoded_creds, scopes=SCOPES)
        print("Authenticated with Google Sheets using environment variable.")
    else:
        from ..config import GOOGLE_SHEET_CREDS_JSON
        if not GOOGLE_SHEET_CREDS_JSON:
            raise ValueError("Google credentials not found. Set GOOGLE_SHEET_CREDS_JSON env var or service account file.")
        creds = Credentials.from_service_account_file(GOOGLE_SHEET_CREDS_JSON, scopes=SCOPES)
        print(f"Authenticated with Google Sheets using local file: {GOOGLE_SHEET_CREDS_JSON}")
        
    client = gspread.authorize(creds)
    
    try:
        spreadsheet = client.open_by_key(SPREADSHEET_ID)
        worksheet = spreadsheet.worksheet(sheet_name)
        
        # 2. Get all tickers and existing prices from the sheet
        all_values = worksheet.get(column_range)
        header = all_values[0]
        rows = all_values[1:]
        
        tickers = [row[0] for row in rows if row and row[0].strip()]
        
        if not tickers:
            print("No tickers found in the Google Sheet. Skipping price update.")
            return

        print(f"Found {len(tickers)} tickers. Fetching latest prices in a batch...")

        # 3. Fetch the latest price data
        try:
            data = _fetch_prices_batch(tickers)
        except Exception as e:
            print(f"❌ Failed to fetch price data after multiple retries: {e}")
            print("Skipping all price updates for this run due to a fatal data fetching error.")
            return

        # 4. Prepare the list of prices for batch update
        prices_to_update = []
        for i, row in enumerate(rows):
            ticker = row[0]
            current_price = row[1] if len(row) > 1 else 'N/A'
            
            new_price_fetched = False
            if ticker in data and 'Close' in data[ticker] and not data[ticker]['Close'].dropna().empty:
                try:
                    latest_price = data[ticker]['Close'].iloc[-1]
                    prices_to_update.append([f"{latest_price:.2f}"])
                    print(f"  -> Success for {ticker}: Updating price to ${latest_price:.2f}")
                    new_price_fetched = True
                except (IndexError, TypeError) as e:
                    print(f"  -> Error processing data for {ticker}: {e}. Keeping old price.")
            
            if not new_price_fetched:
                prices_to_update.append([current_price])
                print(f"  -> No new data for {ticker}. Keeping old price: {current_price}")
        
        # 5. Update the Google Sheet with the new prices
        if prices_to_update:
            update_range = f'B2:B{len(rows) + 1}'
            worksheet.update(update_range, prices_to_update)
            print("\n✅ Google Sheet price update process complete.")
        
    except gspread.exceptions.SpreadsheetNotFound:
        print("❌ Spreadsheet not found. Please check your SPREADSHEET_ID and sharing permissions.")
        raise
    except Exception as e:
        print(f"❌ An error occurred during the price update process: {e}")
        raise
