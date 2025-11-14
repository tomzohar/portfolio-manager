#!/usr/bin/env python3
"""
Portfolio Parser Agent
Reads portfolio data from Google Sheets with position sizes and market values
"""

import gspread
from google.oauth2.service_account import Credentials
from typing import List, Dict
from dataclasses import dataclass
from ..config import GOOGLE_SERVICE_ACCOUNT_FILE, SPREADSHEET_ID


@dataclass
class PortfolioPosition:
    """Represents a single stock position in the portfolio"""
    symbol: str
    price: float
    position: int  # number of shares
    market_value: float
    percent_of_total: float
    
    def __repr__(self):
        return f"{self.symbol}: {self.position} shares @ ${self.price} = ${self.market_value:,.2f} ({self.percent_of_total:.2f}%)"


class Portfolio:
    """Represents the complete portfolio"""
    
    def __init__(self, positions: List[PortfolioPosition], total_value: float):
        self.positions = positions
        self.total_value = total_value
        self._positions_dict = {pos.symbol: pos for pos in positions}
    
    def get_position(self, symbol: str) -> PortfolioPosition:
        """Get a specific position by symbol"""
        return self._positions_dict.get(symbol)
    
    def get_symbols(self) -> List[str]:
        """Get list of all stock symbols"""
        return [pos.symbol for pos in self.positions]
    
    def get_top_positions(self, n: int = 5) -> List[PortfolioPosition]:
        """Get top N positions by market value"""
        return sorted(self.positions, key=lambda x: x.market_value, reverse=True)[:n]
    
    def __repr__(self):
        return f"Portfolio(positions={len(self.positions)}, total_value=${self.total_value:,.2f})"
    
    def __str__(self):
        output = [f"\n{'='*80}"]
        output.append(f"PORTFOLIO SUMMARY - Total Value: ${self.total_value:,.2f}")
        output.append('='*80)
        
        for pos in self.positions:
            output.append(f"{pos.symbol:8} | {pos.position:4} shares | ${pos.price:8.2f} | "
                         f"${pos.market_value:10,.2f} | {pos.percent_of_total:6.2f}%")
        
        output.append('='*80)
        return '\n'.join(output)


def parse_portfolio(service_file: str, spreadsheet_id: str, sheet_range: str = 'גיליון1!A1:F100') -> Portfolio:
    """
    Parse portfolio data from Google Sheets
    
    Expected sheet structure:
    | symbol | price | position | market value | % of total | total |
    
    Args:
        service_file: Path to Google service account JSON file
        spreadsheet_id: Google Sheets spreadsheet ID
        sheet_range: Range to read (default: entire sheet)
    
    Returns:
        Portfolio object with all positions
    """
    # Define the necessary scopes
    SCOPES = [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ]
    
    # Authenticate using the service account credentials
    creds = Credentials.from_service_account_file(service_file, scopes=SCOPES)
    
    # Create a gspread client instance
    client = gspread.authorize(creds)
    
    # Open the spreadsheet by its ID
    try:
        spreadsheet = client.open_by_key(spreadsheet_id)
    except gspread.exceptions.SpreadsheetNotFound:
        raise ValueError("Spreadsheet not found. Check ID and sharing permissions.")
    
    # Get all values from the range
    values = spreadsheet.values_get(sheet_range)['values']
    
    if not values or len(values) < 2:
        raise ValueError("No data found in spreadsheet or insufficient rows")
    
    # Parse header row
    header = values[0]
    
    # Validate expected columns
    expected_columns = ['symbol', 'price', 'position', 'market value', '% of total', 'total']
    if not all(col.lower() in [h.lower() for h in header] for col in ['symbol', 'price', 'position']):
        raise ValueError(f"Missing required columns. Expected: {expected_columns}")
    
    # Parse positions
    positions = []
    total_value = None
    
    for row in values[1:]:  # Skip header
        if not row or len(row) < 3:  # Need at least symbol, price, position
            continue
        
        # Skip empty rows
        if not row[0].strip():
            continue
        
        try:
            symbol = row[0].strip()
            price = float(row[1]) if len(row) > 1 else 0.0
            position = int(float(row[2])) if len(row) > 2 else 0
            market_value = float(row[3]) if len(row) > 3 else price * position
            
            # Parse percentage (remove % sign if present)
            percent_str = row[4] if len(row) > 4 else '0'
            percent_of_total = float(percent_str.replace('%', '')) if percent_str else 0.0
            
            # Get total value (should be same for all rows)
            if len(row) > 5 and row[5]:
                total_value = float(row[5])
            
            position_obj = PortfolioPosition(
                symbol=symbol,
                price=price,
                position=position,
                market_value=market_value,
                percent_of_total=percent_of_total
            )
            
            positions.append(position_obj)
            
        except (ValueError, IndexError) as e:
            print(f"Warning: Skipping invalid row: {row} - Error: {e}")
            continue
    
    if not positions:
        raise ValueError("No valid positions found in spreadsheet")
    
    # Calculate total value if not provided
    if total_value is None:
        total_value = sum(pos.market_value for pos in positions)
    
    return Portfolio(positions=positions, total_value=total_value)

