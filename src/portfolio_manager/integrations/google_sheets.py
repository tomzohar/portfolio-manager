"""
Google Sheets Integration
Handles portfolio data parsing and price updates.
"""

import logging
from dataclasses import asdict
from datetime import date, timedelta
from typing import Dict, List, Optional

import gspread
from google.oauth2.service_account import Credentials
from polygon import RESTClient
from pydantic import BaseModel
from tenacity import retry, stop_after_attempt, wait_exponential

from ..config import settings
from ..error_handler import capture_error
from ..schemas import Portfolio, PortfolioPosition

logger = logging.getLogger(__name__)


def _get_gspread_client() -> gspread.Client:
    """Authenticates and returns a gspread client."""
    SCOPES = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]
    
    # 1. Try Base64 encoded credentials first (Settings handles decoding)
    creds_dict = settings.get_google_creds()
    
    if creds_dict:
        creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
        logger.debug("Authenticated with Google Sheets using decoded credentials.")
    elif settings.GOOGLE_SERVICE_ACCOUNT_FILE:
        # 2. Fallback to file path
        creds = Credentials.from_service_account_file(
            settings.GOOGLE_SERVICE_ACCOUNT_FILE, 
            scopes=SCOPES
        )
        logger.debug(f"Authenticated with Google Sheets using file: {settings.GOOGLE_SERVICE_ACCOUNT_FILE}")
    else:
        raise ValueError("No valid Google credentials found in configuration.")

    return gspread.authorize(creds)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def parse_portfolio() -> Portfolio:
    """
    Retrieves and parses the user's portfolio from Google Sheets.
    
    Returns:
        Portfolio object containing all positions and total value.
        
    Raises:
        ValueError: If spreadsheet not found, data is missing, or parsing fails.
        gspread.exceptions.APIError: For Google Sheets API errors.
    """
    try:
        client = _get_gspread_client()
        
        try:
            spreadsheet = client.open_by_key(settings.SPREADSHEET_ID)
        except gspread.exceptions.SpreadsheetNotFound:
            raise ValueError(f"Spreadsheet with ID {settings.SPREADSHEET_ID} not found.")
        
        # Get all values from the configured range
        values = spreadsheet.values_get(settings.SPREADSHEET_RANGE)['values']
        
        if not values or len(values) < 2:
            raise ValueError("No data found in spreadsheet or insufficient rows")
        
        # Parse header row
        header = values[0]
        expected_columns = ['symbol', 'price', 'position', 'market value', '% of total']
        
        # Basic validation of header structure
        # Note: We do a loose check to be robust against minor header name changes
        header_lower = [h.lower() for h in header]
        if 'symbol' not in header_lower or 'position' not in header_lower:
             raise ValueError(f"Missing required columns. Expected at least 'symbol' and 'position'. Found: {header}")
        
        positions = []
        calculated_total_value = 0.0
        
        for row in values[1:]:  # Skip header
            if not row or len(row) < 3:
                continue
            
            # Skip empty rows
            if not row[0].strip():
                continue
            
            try:
                symbol = row[0].strip()
                # Handle price: clean '$' and ',' if present
                price_str = str(row[1]).replace('$', '').replace(',', '')
                price = float(price_str) if row[1] else 0.0
                
                position = int(float(row[2])) if len(row) > 2 else 0
                
                # Calculate market value if missing or parse it
                market_value = price * position
                if len(row) > 3 and row[3]:
                     mv_str = str(row[3]).replace('$', '').replace(',', '')
                     market_value = float(mv_str)
                
                # Parse percentage
                percent_of_total = 0.0
                if len(row) > 4 and row[4]:
                    pct_str = str(row[4]).replace('%', '')
                    percent_of_total = float(pct_str)
                
                pos_obj = PortfolioPosition(
                    symbol=symbol,
                    price=price,
                    position=position,
                    market_value=market_value,
                    percent_of_total=percent_of_total
                )
                
                positions.append(pos_obj)
                calculated_total_value += market_value
                
            except (ValueError, IndexError) as e:
                logger.warning(f"Skipping invalid row: {row} - Error: {e}")
                continue
        
        if not positions:
            raise ValueError("No valid positions found in spreadsheet")
            
        # Check if total value is explicitly provided in the sheet (sometimes in column F)
        sheet_total_value = None
        if len(values) > 1 and len(values[1]) > 5:
             try:
                 val_str = str(values[1][5]).replace('$', '').replace(',', '')
                 sheet_total_value = float(val_str)
             except ValueError:
                 pass
        
        final_total_value = sheet_total_value if sheet_total_value is not None else calculated_total_value
        
        logger.info(f"Successfully parsed {len(positions)} positions from portfolio.")
        return Portfolio(positions=positions, total_value=final_total_value)

    except Exception as e:
        capture_error(e)
        logger.error(f"Failed to parse portfolio: {e}")
        raise


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
)
def update_gsheet_prices(sheet_name: str = 'גיליון1', column_range: str = 'A:B') -> None:
    """
    Fetches the latest closing price for each stock from Polygon and updates the Google Sheet.
    
    Args:
        sheet_name: Name of the worksheet to update.
        column_range: Range to read tickers from (e.g., 'A:B').
    """
    try:
        client = _get_gspread_client()
        polygon_client = RESTClient(settings.POLYGON_API_KEY)
        
        try:
            spreadsheet = client.open_by_key(settings.SPREADSHEET_ID)
            worksheet = spreadsheet.worksheet(sheet_name)
        except gspread.exceptions.SpreadsheetNotFound:
            raise ValueError(f"Spreadsheet {settings.SPREADSHEET_ID} or worksheet {sheet_name} not found.")

        # Get all tickers
        all_values = worksheet.get(column_range)
        if not all_values:
             logger.warning("Empty spreadsheet found.")
             return

        rows = all_values[1:] # Skip header
        tickers = [row[0] for row in rows if row and row[0].strip()]
        
        if not tickers:
            logger.info("No tickers found in the Google Sheet. Skipping price update.")
            return

        logger.info(f"Found {len(tickers)} tickers. Fetching latest prices from Polygon...")

        # Get previous trading day
        previous_day = (date.today() - timedelta(days=1)).strftime('%Y-%m-%d')
        
        prices_to_update = []
        
        for row in rows:
            if not row or not row[0].strip():
                prices_to_update.append(['']) # Empty row placeholder
                continue
                
            ticker = row[0]
            current_price = row[1] if len(row) > 1 else 'N/A'
            
            try:
                # Fetch daily open/close agg
                resp = polygon_client.get_daily_open_close_agg(ticker, previous_day)
                
                if hasattr(resp, 'close'):
                    latest_price = resp.close
                    prices_to_update.append([f"{latest_price:.2f}"])
                    logger.debug(f"Updated {ticker} to ${latest_price:.2f}")
                else:
                    prices_to_update.append([current_price])
                    logger.warning(f"No data for {ticker} on {previous_day}. Keeping old price.")
            except Exception as e:
                # Don't fail the whole batch for one ticker error
                prices_to_update.append([current_price])
                logger.warning(f"Error fetching price for {ticker}: {e}")
                capture_error(e)
        
        # Batch update
        if prices_to_update:
            # Assuming price is in column B (index 2)
            # Range starts from row 2 (skipping header)
            update_range = f'B2:B{len(rows) + 1}'
            worksheet.update(update_range, prices_to_update)
            logger.info("✅ Google Sheet price update process complete.")
            
    except Exception as e:
        capture_error(e)
        logger.error(f"Failed to update stock prices: {e}")
        raise
