#!/usr/bin/env python3
"""
Autonomous Portfolio Manager V3 - Main Entry Script

This script runs the Portfolio Manager with the new V3 supervisor multi-agent
architecture. It maintains backward compatibility with the V2 legacy workflow.

The V3 workflow features:
- Supervisor-based multi-agent orchestration
- Specialized sub-agents (Macro, Fundamental, Technical, Risk)
- Synthesis and conflict resolution
- Self-critique via Reflexion loop
- Structured JSON output

Usage:
  # Run with V3 supervisor workflow (default)
  python run_portfolio_manager.py
  
  # Run with V2 legacy workflow
  python run_portfolio_manager.py --version v2
  
  # Run with custom options
  python run_portfolio_manager.py --format text --output report.txt --verbose
  
  # Disable notifications
  python run_portfolio_manager.py --no-notification

For full CLI documentation, run:
  python run_portfolio_manager.py --help
"""

import sys
import os

# Add project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.portfolio_manager.graph.main import main

if __name__ == "__main__":
    sys.exit(main())
