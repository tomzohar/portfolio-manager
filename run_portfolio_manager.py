#!/usr/bin/env python3
"""
Autonomous Portfolio Manager - Entry Point

This script runs the new autonomous agent system that intelligently analyzes
stock portfolios using LangGraph. Unlike the legacy sequential pipeline, this
agent dynamically decides what data to gather and which analyses to perform.

Usage:
    python run_portfolio_manager.py
"""

import logging
import sys
from dotenv import load_dotenv
import os
from logging.handlers import RotatingFileHandler
from rich.logging import RichHandler

# Configure logging
def setup_logging():
    """Set up logging with RichHandler and file output."""
    log_level = os.environ.get("LOG_LEVEL", "INFO").upper()
    
    # Create logs directory if it doesn't exist
    if not os.path.exists("logs"):
        os.makedirs("logs")

    # RichHandler for beautiful console output
    rich_handler = RichHandler(
        rich_tracebacks=True, 
        tracebacks_show_locals=True
    )

    # File handler for persistent logs
    file_handler = RotatingFileHandler(
        "logs/portfolio_manager.log", 
        maxBytes=1024 * 1024 * 5,  # 5 MB
        backupCount=2
    )
    
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            rich_handler,
            file_handler
        ]
    )

logger = logging.getLogger(__name__)


def main():
    """Main entry point for the autonomous portfolio manager"""
    
    # Load environment variables
    load_dotenv()
    setup_logging()
    
    logger.info("=" * 70)
    logger.info("AUTONOMOUS PORTFOLIO MANAGER")
    logger.info("=" * 70)
    
    try:
        # Import here to ensure env vars are loaded first
        from src.portfolio_manager.graph import run_autonomous_analysis
        from stock_researcher.notifications.whatsapp import send_whatsapp_message
        from stock_researcher.config import TWILIO_WHATSAPP_TO
        
        # Run the autonomous analysis
        final_state = run_autonomous_analysis(max_iterations=10)
        
        # Display the report
        if final_state["final_report"]:
            print("\n" + final_state["final_report"])
            
            # Send to WhatsApp (condensed version)
            try:
                # Extract key recommendations for WhatsApp
                confidence = final_state["confidence_score"]
                analyzed = len(final_state["analysis_results"])
                total = len(final_state["portfolio"]["positions"]) if final_state["portfolio"] else 0
                
                # Extract recommendations from the report text
                report_lines = final_state["final_report"].split('\n')
                recommendations_section = []
                in_recommendations = False
                for line in report_lines:
                    if "RECOMMENDATIONS:" in line:
                        in_recommendations = True
                        continue
                    if in_recommendations and "Data Coverage:" in line:
                        break
                    if in_recommendations and line.strip():
                        recommendations_section.append(line)
                
                recommendations_text = "\n".join(recommendations_section).strip()

                whatsapp_message = (
                    f"📊 *Portfolio Analysis*\n\n"
                    f"*Confidence:* {confidence:.0%}\n\n"
                    f"{recommendations_text}"
                )
                
                # Truncate if over 1600 characters
                if len(whatsapp_message) > 1600:
                    whatsapp_message = whatsapp_message[:1590] + "...\n(truncated)"

                send_whatsapp_message(
                    message_body=whatsapp_message, 
                    to_number=TWILIO_WHATSAPP_TO
                )
                logger.info("✓ WhatsApp notification sent")
                
            except Exception as whatsapp_error:
                logger.warning(f"Failed to send WhatsApp notification: {whatsapp_error}")
        else:
            logger.error("No report generated")
            sys.exit(1)
        
        # Check for errors
        if final_state["errors"]:
            logger.warning(f"Workflow completed with {len(final_state['errors'])} errors:")
            for error in final_state["errors"]:
                logger.warning(f"  - {error}")
            sys.exit(1)
        
        logger.info("✓ Analysis completed successfully")
        sys.exit(0)
        
    except KeyboardInterrupt:
        logger.info("\nAnalysis interrupted by user")
        sys.exit(130)
        
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}", exc_info=True)
        
        # Attempt to send error notification
        try:
            from stock_researcher.notifications.whatsapp import send_whatsapp_message
            from stock_researcher.config import TWILIO_WHATSAPP_TO
            send_whatsapp_message(
                f"❌ Portfolio Analysis Failed\n\n"
                f"Error: {str(e)}\n\n"
                f"Check logs for details.",
                to_number=TWILIO_WHATSAPP_TO
            )
        except:
            pass
        
        sys.exit(1)


if __name__ == "__main__":
    main()

