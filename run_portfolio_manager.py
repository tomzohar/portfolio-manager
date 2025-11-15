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
import sentry_sdk
from logging.handlers import RotatingFileHandler
from rich.logging import RichHandler

# Import application components at the top level for clarity and mockability
from src.portfolio_manager.graph import run_autonomous_analysis
from src.portfolio_manager.error_handler import capture_error, capture_message
from stock_researcher.notifications.whatsapp import send_whatsapp_message
from stock_researcher.config import TWILIO_WHATSAPP_TO


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


def _handle_analysis_output(
    final_state: dict,
    send_whatsapp_message,
    twilio_whatsapp_to: str
) -> bool:
    """
    Handles the final output, sending notifications and checking for errors.
    Returns True on success, False on failure.
    """
    if not final_state:
        logger.error("Analysis did not produce a final state.")
        capture_message("Analysis finished with no final state.", level="error")
        return False

    # A report is required to proceed, even if there are errors.
    if not final_state.get("final_report"):
        logger.error("Analysis finished but no report was generated.")
        # If there were also errors, log them as the likely cause.
        if final_state.get("errors"):
            logger.error(f"This may be due to the {len(final_state['errors'])} errors encountered.")
        capture_message("Analysis finished with no final report.", level="error")
        return False

    # Always print the report if it exists.
    logger.info("✓ Analysis attempting to complete...")
    print("\n" + final_state["final_report"])

    # Send a condensed version of the report to WhatsApp
    try:
        confidence = final_state.get("confidence_score", 0.0)
        
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
            to_number=twilio_whatsapp_to
        )
        logger.info("✓ WhatsApp notification sent")
        
    except Exception as whatsapp_error:
        logger.warning(
            f"Failed to send WhatsApp notification: {whatsapp_error}", 
            exc_info=True
        )
    
    # After sending notifications, check for errors to determine final status.
    if final_state.get("errors"):
        logger.warning(f"Workflow completed with {len(final_state['errors'])} errors:")
        for error in final_state["errors"]:
            logger.warning(f"  - {error}")
        capture_message(
            f"Portfolio analysis completed with {len(final_state['errors'])} errors.",
            level="warning"
        )
        return False

    logger.info("✓ Analysis completed successfully")
    return True


def main():
    """Main entry point for the autonomous portfolio manager"""
    
    # Load environment variables
    load_dotenv()
    setup_logging()
    
    # Initialize Sentry if DSN is provided
    sentry_dsn = os.environ.get("SENTRY_DSN")
    if sentry_dsn:
        sentry_sdk.init(
            dsn=sentry_dsn,
            traces_sample_rate=1.0,
            profiles_sample_rate=1.0,
            enable_tracing=True
        )
        logger.info("✓ Sentry initialized")
    
    logger.info("=" * 70)
    logger.info("AUTONOMOUS PORTFOLIO MANAGER")
    logger.info("=" * 70)
    
    try:
        # Run the autonomous analysis
        final_state = run_autonomous_analysis(max_iterations=10)
        
        success = _handle_analysis_output(
            final_state,
            send_whatsapp_message,
            TWILIO_WHATSAPP_TO
        )
        
        if success:
            sys.exit(0)
        else:
            sys.exit(1)
        
    except KeyboardInterrupt:
        logger.info("\nAnalysis interrupted by user")
        sys.exit(130)
        
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}", exc_info=True)
        try:
            send_whatsapp_message(
                f"❌ Portfolio Analysis Failed\n\n"
                f"Error: {str(e)}\n\n"
                f"Check logs for details.",
                to_number=TWILIO_WHATSAPP_TO
            )
        except Exception as notify_error:
            logger.error(f"Failed to send failure notification: {notify_error}")
        
        capture_error(e)
        sys.exit(1)


if __name__ == "__main__":
    main()

