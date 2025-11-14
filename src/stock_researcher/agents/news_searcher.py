#!/usr/bin/env python3
"""
Get latest news for stock tickers using SerpAPI
"""

import os
from serpapi import GoogleSearch
from typing import List, Dict
from ..config import SERPAPI_API_KEY


def get_stock_news(tickers: List[str], api_key: str) -> Dict[str, List[Dict]]:
    """
    Searches for the latest news for a list of stock tickers using a Search API.
    
    Returns a dictionary mapping Ticker -> List of relevant news links/snippets.
    """
    all_news_data = {}

    print(f"Starting news retrieval for {len(tickers)} stocks...")

    for ticker in tickers:
        print(f"--> Searching for news on: {ticker}")
        
        # Craft a precise search query
        query = f'"{ticker}" stock news today financial analysis'
        
        try:
            # Parameters for a focused news search
            params = {
                "engine": "google",    # Use Google Search engine
                "q": query,            # The specific query
                "tbm": "nws",          # Target only the "News" tab
                "gl": "us",            # Geolocation for results
                "num": 3,              # Retrieve the top 3 results
                "api_key": api_key     # API key for authentication
            }
            
            # Execute the search
            search = GoogleSearch(params)
            results = search.get_dict()
            
            # Extract relevant information from the search results
            news_items = []
            if 'news_results' in results:
                for item in results['news_results']:
                    news_items.append({
                        'title': item.get('title'),
                        'snippet': item.get('snippet'),
                        'source': item.get('source'),
                        'link': item.get('link')
                    })
            
            all_news_data[ticker] = news_items
            
        except Exception as e:
            print(f"An error occurred while searching for {ticker}: {e}")
            all_news_data[ticker] = []

    return all_news_data
