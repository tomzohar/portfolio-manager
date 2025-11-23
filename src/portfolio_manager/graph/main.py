"""Main entry point for running the autonomous agent."""
import logging
import argparse
import sys
import json
import os
from typing import Dict, Any, Optional
from datetime import datetime
from logging.handlers import RotatingFileHandler
from .builder import build_graph
from ..agent_state import AgentState  # Import the Pydantic model
from ..config import settings
import sentry_sdk

logger = logging.getLogger(__name__)


def _setup_logging(verbose: bool = False, enable_file_logging: bool = True):
    """
    Set up logging with console output and optional file output.
    
    Creates rotating log files in logs/ directory when enabled:
    - portfolio_manager.log (main log, 5MB max, 2 backups)
    - portfolio_manager_YYYYMMDD_HHMMSS.log (timestamped run log)
    
    Args:
        verbose: If True, set DEBUG level; otherwise INFO level
        enable_file_logging: If True, write logs to files; otherwise console only
    """
    log_level = logging.DEBUG if verbose else logging.INFO
    
    # Format for all handlers
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    formatter = logging.Formatter(log_format)
    
    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Remove existing handlers to avoid duplicates
    root_logger.handlers.clear()
    
    # 1. Console handler (always enabled)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    logger.info(f"✓ Logging configured (level: {logging.getLevelName(log_level)})")
    
    # 2. File handlers (only if enabled)
    if enable_file_logging:
        # Create logs directory if it doesn't exist
        logs_dir = "logs"
        if not os.path.exists(logs_dir):
            os.makedirs(logs_dir)
        
        # Main rotating file handler
        main_log_file = os.path.join(logs_dir, "portfolio_manager.log")
        file_handler = RotatingFileHandler(
            main_log_file,
            maxBytes=5 * 1024 * 1024,  # 5 MB
            backupCount=2
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
        
        # Timestamped run-specific log file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        run_log_file = os.path.join(logs_dir, f"portfolio_manager_{timestamp}.log")
        run_file_handler = logging.FileHandler(run_log_file)
        run_file_handler.setLevel(log_level)
        run_file_handler.setFormatter(formatter)
        root_logger.addHandler(run_file_handler)
        
        logger.info(f"✓ Logs saved to: {main_log_file}")
        logger.info(f"✓ Run log saved to: {run_log_file}")
    else:
        logger.info("✓ File logging disabled (console only)")



def run_autonomous_analysis(max_iterations: int = 10, version: str = "v3"):
    """
    Run the autonomous portfolio analysis workflow.
    
    Args:
        max_iterations: The maximum number of agent decision loops (V2 only)
        version: Workflow version to use:
            - "v3" (default): Supervisor multi-agent workflow
            - "v2": Legacy single-agent workflow
            - "auto": Auto-detect based on portfolio data
    
    Returns:
        The final state of the workflow
        
    Raises:
        ValueError: If version is invalid
    """
    if version not in ["v2", "v3", "auto"]:
        raise ValueError(f"Invalid version: {version}. Must be 'v2', 'v3', or 'auto'")
    
    logger.info(f"Building the autonomous agent graph (version: {version})...")
    app = build_graph(version=version)
    
    # Create the initial state using the Pydantic model
    initial_state = AgentState(max_iterations=max_iterations)
    
    logger.info(f"Starting analysis (version: {version})...")
    
    # Calculate LangGraph recursion limit:
    # V2: Each agent iteration = 4 nodes (guardrail -> agent -> execute_tool -> guardrail)
    #     Plus: 1 start node + 1 final_report node
    #     Formula: (max_iterations * 4) + 10
    # V3: Supervisor workflow has more nodes but no iterations
    #     Formula: 30 (covers all V3 nodes including reflexion loops)
    if version == "v2":
        langgraph_recursion_limit = (max_iterations * 4) + 10
    else:  # v3 or auto
        langgraph_recursion_limit = 30  # V3 has fixed workflow depth
    
    logger.info(f"Setting LangGraph recursion limit to {langgraph_recursion_limit} "
                f"(version={version}, max_iterations={max_iterations})")
    
    # The input to invoke must be a dictionary
    final_state = app.invoke(
        initial_state.model_dump(),
        config={"recursion_limit": langgraph_recursion_limit}
    )
    
    return final_state


def _format_output_as_json(state: Dict[str, Any], workflow_version: str) -> Dict[str, Any]:
    """
    Format workflow output as JSON.
    
    Args:
        state: Final agent state
        workflow_version: Workflow version used
        
    Returns:
        Formatted output dictionary
    """
    if workflow_version == "v3":
        # V3 structured output
        final_report_json = state.get("final_report")
        
        if final_report_json:
            try:
                report = json.loads(final_report_json)
            except json.JSONDecodeError:
                report = {"error": "Failed to parse final report JSON"}
        else:
            report = None
        
        return {
            "status": "success" if not state.get("errors") else "completed_with_errors",
            "version": "v3.0",
            "report": report,
            "errors": state.get("errors", []),
            "timestamp": datetime.now().isoformat()
        }
    
    else:  # V2 output
        return {
            "status": "success" if not state.get("errors") else "completed_with_errors",
            "version": "v2.0",
            "report": state.get("final_report", "No report generated"),
            "errors": state.get("errors", []),
            "confidence_score": state.get("confidence_score", 0.0),
            "timestamp": datetime.now().isoformat()
        }


def _format_output_as_text(state: Dict[str, Any], workflow_version: str) -> str:
    """
    Format workflow output as human-readable text.
    
    Args:
        state: Final agent state
        workflow_version: Workflow version used
        
    Returns:
        Formatted text summary
    """
    if workflow_version == "v3":
        # V3 structured output
        final_report_json = state.get("final_report")
        
        if not final_report_json:
            return "ERROR: No report generated"
        
        try:
            report = json.loads(final_report_json)
        except json.JSONDecodeError:
            return "ERROR: Failed to parse report JSON"
        
        lines = [
            "=" * 70,
            "PORTFOLIO ANALYSIS REPORT (V3)",
            "=" * 70,
            "",
            f"Timestamp: {report.get('timestamp', 'N/A')}",
            f"Confidence: {report.get('confidence_score', 0) * 100:.0f}%",
            "",
            f"Market Regime: {report.get('market_regime', {}).get('status', 'N/A')} / "
            f"{report.get('market_regime', {}).get('signal', 'N/A')}",
            f"Portfolio Strategy: {report.get('portfolio_strategy', {}).get('action', 'N/A')}",
            f"Risk Level: {report.get('risk_assessment', {}).get('max_drawdown_risk', 'N/A')}",
            "",
            "EXECUTIVE SUMMARY:",
            "-" * 70,
            report.get("executive_summary", "N/A"),
            "",
            "POSITION RECOMMENDATIONS:",
            "-" * 70
        ]
        
        for position in report.get("positions", []):
            emoji = {"Buy": "🟢", "Sell": "🔴", "Hold": "🟡"}.get(position.get('action'), "⚪")
            lines.append(
                f"  {emoji} {position.get('ticker')}: {position.get('action')} "
                f"(Confidence: {position.get('confidence', 0) * 100:.0f}%)"
            )
            lines.append(f"     Rationale: {position.get('rationale', 'N/A')}")
        
        lines.extend([
            "",
            "RISK METRICS:",
            "-" * 70,
            f"  Beta: {report.get('risk_assessment', {}).get('beta', 'N/A')}",
            f"  Sharpe Ratio: {report.get('risk_assessment', {}).get('sharpe_projected', 'N/A')}",
            f"  VaR (95%): {report.get('risk_assessment', {}).get('var_95', 'N/A')}%",
            f"  Portfolio Volatility: {report.get('risk_assessment', {}).get('portfolio_volatility', 'N/A')}%",
            "",
            "=" * 70,
            report.get('disclaimer', ''),
            "=" * 70
        ])
        
        return "\n".join(lines)
    
    else:  # V2 output
        lines = [
            "=" * 70,
            "PORTFOLIO ANALYSIS REPORT (V2 Legacy)",
            "=" * 70,
            "",
            state.get("final_report", "No report generated"),
            "",
            "=" * 70
        ]
        
        if state.get("errors"):
            lines.extend([
                "",
                f"⚠️  Completed with {len(state['errors'])} error(s):",
                *[f"  - {error}" for error in state["errors"]]
            ])
        
        return "\n".join(lines)


def main():
    """CLI entry point for portfolio manager."""
    parser = argparse.ArgumentParser(
        description="Portfolio Manager - Autonomous Multi-Agent Analysis System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run with V3 supervisor workflow (default)
  python -m src.portfolio_manager.graph.main
  
  # Run with V2 legacy workflow
  python -m src.portfolio_manager.graph.main --version v2
  
  # Auto-detect workflow based on portfolio data
  python -m src.portfolio_manager.graph.main --version auto
  
  # Specify output format and save to file
  python -m src.portfolio_manager.graph.main --format text --output report.txt
  
  # Verbose logging
  python -m src.portfolio_manager.graph.main --verbose
  
  # Disable notifications
  python -m src.portfolio_manager.graph.main --no-notification

Environment Variables:
  GOOGLE_APPLICATION_CREDENTIALS - Path to Google Cloud service account JSON
  POLYGON_API_KEY                - Polygon.io API key for market data
  FRED_API_KEY                   - FRED API key for economic data
  GOOGLE_API_KEY                 - Google Gemini API key for LLM
  PUSHOVER_USER_KEY              - Pushover user key for notifications
  PUSHOVER_APP_TOKEN             - Pushover app token for notifications
  SENTRY_DSN                     - Sentry DSN for error tracking (optional)
"""
    )
    
    parser.add_argument(
        "--version",
        choices=["v2", "v3", "auto"],
        default="v3",
        help="Workflow version: 'v2' (legacy), 'v3' (supervisor, default), 'auto' (detect)"
    )
    
    parser.add_argument(
        "--max-iterations",
        type=int,
        default=10,
        help="Maximum agent iterations for V2 workflow (default: 10)"
    )
    
    parser.add_argument(
        "--format",
        choices=["json", "text"],
        default="json",
        help="Output format: 'json' (default) or 'text' (human-readable)"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        help="Write output to file (optional)"
    )
    
    parser.add_argument(
        "--no-notification",
        action="store_true",
        help="Disable Pushover notification"
    )
    
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable verbose (DEBUG) logging"
    )
    
    parser.add_argument(
        "--no-file-logging",
        action="store_true",
        help="Disable file logging (console only)"
    )
    
    args = parser.parse_args()
    
    # Detect if we're in a test environment
    in_test_env = (
        "PYTEST_CURRENT_TEST" in os.environ or  # pytest is running
        "pytest" in sys.modules or               # pytest module loaded
        any("pytest" in arg for arg in sys.argv) # pytest in command line
    )
    
    # Enable file logging by default in production, disable in tests
    # Allow explicit override via --no-file-logging flag
    enable_file_logging = not args.no_file_logging and not in_test_env
    
    # Configure logging with optional file output
    _setup_logging(args.verbose, enable_file_logging)
    
    logger.info("=" * 70)
    logger.info(f"PORTFOLIO MANAGER {args.version.upper()}")
    logger.info("=" * 70)
    
    # Initialize Sentry if configured
    if settings.SENTRY_DSN:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            traces_sample_rate=1.0,
            enable_tracing=True
        )
        logger.info("✓ Sentry error tracking initialized")
    
    # Run portfolio manager
    try:
        logger.info(f"Starting Portfolio Manager (version: {args.version})...")
        
        final_state = run_autonomous_analysis(
            max_iterations=args.max_iterations,
            version=args.version
        )
        
        # Check for critical errors
        if not final_state:
            logger.error("Analysis did not produce a final state")
            sys.exit(1)
        
        if not final_state.get("final_report"):
            logger.error("Analysis finished but no report was generated")
            if final_state.get("errors"):
                logger.error(f"Encountered {len(final_state['errors'])} error(s):")
                for error in final_state["errors"]:
                    logger.error(f"  - {error}")
            sys.exit(1)
        
        # Format output
        if args.format == "json":
            output = _format_output_as_json(final_state, args.version)
            output_str = json.dumps(output, indent=2, default=str)
        else:
            output_str = _format_output_as_text(final_state, args.version)
        
        # Write to file or stdout
        if args.output:
            with open(args.output, 'w') as f:
                f.write(output_str)
            logger.info(f"✓ Output written to {args.output}")
        else:
            print("\n" + output_str)
        
        # Send notification if enabled
        if not args.no_notification:
            try:
                from src.stock_researcher.notifications.pushover import send_pushover_message
                
                # V3 has structured notification in final_report node
                # V2 needs manual notification
                if args.version == "v2":
                    confidence = final_state.get("confidence_score", 0.0)
                    notification_text = (
                        f"Portfolio Analysis Complete (V2)\n\n"
                        f"Confidence: {confidence:.0%}\n\n"
                        f"Check logs for full report."
                    )
                    send_pushover_message(
                        message_body=notification_text,
                        title="Portfolio Manager V2"
                    )
                    logger.info("✓ Pushover notification sent")
                else:
                    logger.info("✓ V3 workflow handles notifications internally")
                    
            except Exception as e:
                logger.warning(f"Failed to send notification: {e}")
                sentry_sdk.capture_exception(e)
        else:
            logger.info("ℹ️  Notifications disabled via --no-notification flag")
        
        # Exit with success
        logger.info("✓ Portfolio Manager completed successfully")
        return 0
        
    except ValueError as e:
        logger.error(f"Invalid configuration: {e}")
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
        
    except KeyboardInterrupt:
        logger.info("\nAnalysis interrupted by user")
        return 130
        
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sentry_sdk.capture_exception(e)
        print(f"ERROR: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
