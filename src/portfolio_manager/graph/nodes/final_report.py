"""Graph node for generating the final report."""
import logging
from datetime import datetime
from typing import Dict, Any
from src.portfolio_manager.agent_state import AgentState
from stock_researcher.agents.portfolio_manager import generate_portfolio_recommendations

logger = logging.getLogger(__name__)


def final_report_node(state: AgentState) -> AgentState:
    """
    Terminal node - generates final recommendations and formats output
    """
    logger.info("\n=== Generating Final Report ===")
    
    state["completed_at"] = datetime.utcnow().isoformat()
    
    try:
        # We need to convert our state back into the format the legacy function expects
        from stock_researcher.agents.portfolio_parser import Portfolio, PortfolioPosition
        
        # Reconstruct Portfolio object
        positions = [
            PortfolioPosition(
                symbol=pos["ticker"],
                price=pos["current_price"],
                position=pos["shares"],
                market_value=pos["market_value"],
                percent_of_total=pos["weight"] * 100.0,
            )
            for pos in state["portfolio"]["positions"]
        ]
        
        portfolio = Portfolio(
            positions=positions,
            total_value=state["portfolio"]["total_value"]
        )
        
        # Extract summaries
        news_summaries = {
            ticker: results.get("news", {})
            for ticker, results in state["analysis_results"].items()
        }
        technical_summaries = {
            ticker: results.get("technicals", {})
            for ticker, results in state["analysis_results"].items()
        }
        
        # Generate recommendations using existing logic
        recommendations = generate_portfolio_recommendations(
            portfolio=portfolio,
            summaries=news_summaries,
            technical_analysis=technical_summaries
        )
        
        # Format the final report
        report = _format_report(state, recommendations)
        state["final_report"] = report
        state["reasoning_trace"].append("Final report generated successfully")
        
    except Exception as e:
        logger.error(f"Failed to generate final report: {str(e)}", exc_info=True)
        state["errors"].append(f"Report generation failed: {str(e)}")
        state["final_report"] = "ERROR: Failed to generate report"
        state["reasoning_trace"].append(f"✗ Report generation failed: {str(e)}")
    
    return state


def _format_report(state: AgentState, recommendations: Dict[str, Any]) -> str:
    """
    Format the final report with agent reasoning trace and recommendations.
    """
    lines = []
    lines.append("=" * 65)
    lines.append("          AUTONOMOUS PORTFOLIO ANALYSIS REPORT")
    lines.append("=" * 65)
    lines.append("")
    
    # Portfolio summary
    if state["portfolio"]:
        lines.append("Portfolio Summary:")
        lines.append(f"  Total Value: ${state['portfolio']['total_value']:,.2f}")
        lines.append(f"  Positions: {len(state['portfolio']['positions'])}")
        analyzed = len(state["analysis_results"])
        total = len(state["portfolio"]["positions"])
        lines.append(f"  Analysis Coverage: {analyzed}/{total} positions ({analyzed/total*100:.0f}%)")
        lines.append(f"  Confidence: {state['confidence_score']:.2%}")
        lines.append("")
    
    # Agent reasoning trace
    lines.append("-" * 65)
    lines.append("AGENT REASONING TRACE:")
    lines.append("")
    for trace in state["reasoning_trace"]:
        lines.append(f"  {trace}")
    lines.append("")
    
    # Recommendations
    lines.append("-" * 65)
    lines.append("RECOMMENDATIONS:")
    lines.append("")
    
    if isinstance(recommendations, dict):
        if "portfolio_summary" in recommendations:
            lines.append(f"Portfolio Summary: {recommendations['portfolio_summary']}")
            lines.append("")
        
        if "recommendations" in recommendations and recommendations["recommendations"]:
            for rec in recommendations["recommendations"]:
                ticker = rec.get("ticker", "Unknown")
                action = rec.get("recommendation", "N/A")
                reasoning = rec.get("reasoning", "No reasoning provided")
                lines.append(f"  • {ticker} - {action}")
                lines.append(f"    {reasoning}")
                lines.append("")
        else:
            lines.append("  No specific actions recommended at this time.")
    else:
        lines.append(str(recommendations))
    
    lines.append("")
    
    # Data coverage
    lines.append("-" * 65)
    lines.append("Data Coverage:")
    has_news = sum(1 for r in state["analysis_results"].values() if "news" in r)
    has_tech = sum(1 for r in state["analysis_results"].values() if "technicals" in r)
    total_pos = len(state["portfolio"]["positions"]) if state["portfolio"] else 0
    
    lines.append(f"  ✓ Portfolio structure (100%)")
    if total_pos > 0:
        lines.append(f"  ✓ News analysis ({has_news}/{total_pos} stocks - {has_news/total_pos*100:.0f}%)")
        lines.append(f"  ✓ Technical analysis ({has_tech}/{total_pos} stocks - {has_tech/total_pos*100:.0f}%)")
    
    # Execution metadata
    if state["errors"]:
        lines.append("")
        lines.append(f"  ⚠ Errors encountered: {len(state['errors'])}")
    
    lines.append("")
    lines.append(f"Iterations: {state['current_iteration']}/{state['max_iterations']}")
    lines.append("")
    lines.append("=" * 65)
    
    return "\n".join(lines)
