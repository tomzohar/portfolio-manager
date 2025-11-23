"""
Final Report Node - Portfolio Manager V3

Generates structured JSON output from synthesis and reflexion results.
Implements PortfolioReport schema and handles notification formatting.
"""

from typing import Dict, Any, List
import logging
from datetime import datetime
import json
import sentry_sdk

from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.schemas import (
    PortfolioReport,
    MarketRegime,
    PortfolioStrategy,
    PositionAction,
    RiskAssessment
)
from src.portfolio_manager.config import settings
from src.stock_researcher.notifications.pushover import send_pushover_message
from src.stock_researcher.utils.llm_utils import call_gemini_api

logger = logging.getLogger(__name__)


def final_report_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node for generating structured final report.
    
    Process:
    1. Extract synthesis result and reflexion feedback
    2. Build PortfolioReport object from state
    3. Validate against Pydantic schema
    4. Generate executive summary using LLM
    5. Serialize to JSON
    6. Format for Pushover notification
    7. Send notification (if configured)
    8. Return JSON string in state
    
    Args:
        state: Agent state with synthesis and reflexion results
        
    Returns:
        Updated state with final_report (JSON string)
    """
    try:
        logger.info("FINAL REPORT: GENERATION PHASE")
        
        # 1. Extract synthesis and reflexion results
        synthesis = state.get("synthesis_result")
        reflexion_feedback = state.get("reflexion_feedback", [])
        confidence_adjustment = state.get("confidence_adjustment", 0.0)
        
        if not synthesis:
            logger.error("No synthesis result available")
            return {
                "final_report": json.dumps({"error": "No synthesis result"}),
                "error": "Missing synthesis result"
            }
        
        # 2. Build PortfolioReport components
        market_regime = _extract_market_regime(state)
        portfolio_strategy = _extract_portfolio_strategy(synthesis)
        positions = _extract_position_actions(synthesis)
        risk_assessment = _extract_risk_assessment(state)
        
        # 3. Generate executive summary
        executive_summary = _generate_executive_summary(state, synthesis)
        
        # 4. Format reflexion notes
        reflexion_notes = _format_reflexion_notes(reflexion_feedback)
        
        # 5. Calculate final confidence
        base_confidence = synthesis.get("confidence_score", 0.5)
        final_confidence = max(0.0, min(1.0, base_confidence + confidence_adjustment))
        
        # 6. Create PortfolioReport object
        report = PortfolioReport(
            executive_summary=executive_summary,
            market_regime=market_regime,
            portfolio_strategy=portfolio_strategy,
            positions=positions,
            risk_assessment=risk_assessment,
            reflexion_notes=reflexion_notes,
            timestamp=datetime.now(),
            confidence_score=final_confidence,
            agent_version="v3.0"
        )
        
        # 7. Validate and serialize to JSON
        report_json = report.to_dict()
        report_json_str = json.dumps(report_json, indent=2, default=str)
        
        logger.info(f"Final report generated: {len(report_json_str)} bytes")
        
        # 8. Format for Pushover notification
        notification_text = _format_pushover_message(report)
        
        # 9. Send notification (if enabled)
        _send_notification(notification_text, report)
        
        logger.info("FINAL REPORT: COMPLETE")
        
        return {
            "final_report": report_json_str,
            "scratchpad": state.get("scratchpad", []) + [
                f"Final Report: Generated structured JSON output ({len(positions)} positions)"
            ]
        }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Final Report Error: {e}", exc_info=True)
        return {
            "final_report": json.dumps({"error": str(e)}),
            "error": str(e),
            "scratchpad": state.get("scratchpad", []) + [
                f"Final Report: Failed with error: {str(e)}"
            ]
        }


def _extract_market_regime(state: Dict[str, Any]) -> MarketRegime:
    """
    Extract MarketRegime from state.
    
    Args:
        state: Agent state with macro_analysis
        
    Returns:
        MarketRegime object
        
    Raises:
        ValueError: If macro_analysis missing or invalid
    """
    macro = state.get("macro_analysis")
    
    if not macro:
        logger.warning("No macro analysis available, using defaults")
        return MarketRegime(
            status="Goldilocks",
            signal="Risk-On",
            key_driver="Data unavailable",
            confidence=0.3
        )
    
    try:
        return MarketRegime(
            status=macro.get("status", "Goldilocks"),
            signal=macro.get("signal", "Risk-On"),
            key_driver=macro.get("key_driver", "N/A"),
            confidence=macro.get("confidence", 0.5)
        )
    except Exception as e:
        logger.error(f"Failed to extract MarketRegime: {e}")
        # Return default instead of failing
        return MarketRegime(
            status="Goldilocks",
            signal="Risk-On",
            key_driver="Parsing error",
            confidence=0.3
        )


def _extract_portfolio_strategy(synthesis: Dict[str, Any]) -> PortfolioStrategy:
    """
    Extract PortfolioStrategy from synthesis result.
    
    Args:
        synthesis: Synthesis result dictionary
        
    Returns:
        PortfolioStrategy object
    """
    strategy_dict = synthesis.get("portfolio_strategy", {})
    
    try:
        return PortfolioStrategy(
            action=strategy_dict.get("action", "Hold"),
            rationale=strategy_dict.get("rationale", "No strategy determined"),
            priority=strategy_dict.get("priority", "Medium")
        )
    except Exception as e:
        logger.error(f"Failed to extract PortfolioStrategy: {e}")
        return PortfolioStrategy(
            action="Hold",
            rationale="Strategy extraction failed",
            priority="Low"
        )


def _extract_position_actions(synthesis: Dict[str, Any]) -> List[PositionAction]:
    """
    Extract position actions from synthesis result.
    
    Args:
        synthesis: Synthesis result dictionary
        
    Returns:
        List of PositionAction objects
    """
    positions_list = synthesis.get("position_actions", [])
    
    position_actions = []
    for pos_dict in positions_list:
        try:
            position = PositionAction(
                ticker=pos_dict.get("ticker", "UNKNOWN"),
                action=pos_dict.get("action", "Hold"),
                current_weight=pos_dict.get("current_weight", 0.0),
                target_weight=pos_dict.get("target_weight", 0.0),
                rationale=pos_dict.get("rationale", "N/A"),
                confidence=pos_dict.get("confidence", 0.5),
                fundamental_signal=pos_dict.get("fundamental_signal"),
                technical_signal=pos_dict.get("technical_signal")
            )
            position_actions.append(position)
        except Exception as e:
            logger.error(f"Failed to parse position {pos_dict.get('ticker')}: {e}")
            # Skip invalid positions instead of failing
            continue
    
    return position_actions


def _extract_risk_assessment(state: Dict[str, Any]) -> RiskAssessment:
    """
    Extract RiskAssessment from state.
    
    Args:
        state: Agent state with risk_assessment
        
    Returns:
        RiskAssessment object
    """
    risk = state.get("risk_assessment")
    
    if not risk:
        logger.warning("No risk assessment available, using defaults")
        return RiskAssessment(
            beta=1.0,
            sharpe_ratio=0.0,
            max_drawdown_risk="Moderate",
            var_95=0.0,
            portfolio_volatility=0.0,
            lookback_period="N/A",
            calculation_date=datetime.now(),
            max_drawdown=-0.10
        )
    
    try:
        return RiskAssessment(
            beta=risk.get("beta", 1.0),
            sharpe_ratio=risk.get("sharpe_ratio", 0.0),
            max_drawdown_risk=risk.get("max_drawdown_risk", "Moderate"),
            var_95=risk.get("var_95", 0.0),
            portfolio_volatility=risk.get("portfolio_volatility", 0.0),
            lookback_period=risk.get("lookback_period", "N/A"),
            calculation_date=risk.get("calculation_date", datetime.now()),
            max_drawdown=risk.get("max_drawdown", -0.10)
        )
    except Exception as e:
        logger.error(f"Failed to extract RiskAssessment: {e}")
        return RiskAssessment(
            beta=1.0,
            sharpe_ratio=0.0,
            max_drawdown_risk="Moderate",
            var_95=0.0,
            portfolio_volatility=0.0,
            lookback_period="Error",
            calculation_date=datetime.now(),
            max_drawdown=-0.10
        )


def _generate_executive_summary(
    state: Dict[str, Any],
    synthesis: Dict[str, Any]
) -> str:
    """
    Generate executive summary using LLM.
    
    Args:
        state: Full agent state
        synthesis: Synthesis result
        
    Returns:
        Executive summary string (2-3 paragraphs)
    """
    # Extract key components
    portfolio_strategy = synthesis.get("portfolio_strategy", {})
    position_actions = synthesis.get("position_actions", [])
    macro = state.get("macro_analysis", {})
    risk = state.get("risk_assessment", {})
    
    # Count actions
    buy_count = sum(1 for p in position_actions if p.get("action") == "Buy")
    sell_count = sum(1 for p in position_actions if p.get("action") == "Sell")
    hold_count = sum(1 for p in position_actions if p.get("action") == "Hold")
    
    # Build prompt
    prompt = f"""
You are a Senior Portfolio Manager writing an executive summary.

ANALYSIS RESULTS:
- Portfolio Strategy: {portfolio_strategy.get('action', 'Hold')}
- Market Regime: {macro.get('status', 'Unknown')} / {macro.get('signal', 'Unknown')}
- Position Recommendations: {buy_count} Buy, {sell_count} Sell, {hold_count} Hold
- Portfolio Risk: Beta={risk.get('beta', 'N/A')}, Risk Level={risk.get('max_drawdown_risk', 'N/A')}

Write a concise executive summary (2-3 paragraphs, max 300 words) covering:
1. Current market environment and portfolio positioning
2. Key recommendations and rationale
3. Risk considerations and outlook

Be clear, professional, and actionable. Focus on insights, not raw data.
"""
    
    try:
        summary = call_gemini_api(prompt, model=settings.ANALYSIS_MODEL)
        return summary.strip()
    except Exception as e:
        logger.error(f"Failed to generate executive summary: {e}")
        # Fallback to template-based summary
        return _generate_template_summary(portfolio_strategy, macro, risk, position_actions)


def _generate_template_summary(
    portfolio_strategy: Dict,
    macro: Dict,
    risk: Dict,
    position_actions: List
) -> str:
    """
    Generate template-based executive summary (fallback).
    
    Args:
        portfolio_strategy: Strategy dict
        macro: Macro analysis dict
        risk: Risk assessment dict
        position_actions: List of position dicts
        
    Returns:
        Template-based summary string
    """
    strategy_action = portfolio_strategy.get("action", "Hold")
    market_regime = macro.get("status", "Unknown")
    risk_level = risk.get("max_drawdown_risk", "Moderate")
    
    buy_count = sum(1 for p in position_actions if p.get("action") == "Buy")
    sell_count = sum(1 for p in position_actions if p.get("action") == "Sell")
    
    summary = f"""
Portfolio Analysis Summary

Market Environment: The current market regime is {market_regime}, suggesting {'favorable' if macro.get('signal') == 'Risk-On' else 'cautious'} conditions for equity exposure.

Recommendations: Our analysis recommends a {strategy_action} strategy for the portfolio. We identify {buy_count} positions with Buy signals and {sell_count} positions with Sell signals. {portfolio_strategy.get('rationale', '')}

Risk Profile: The portfolio exhibits {risk_level} risk characteristics with a beta of {risk.get('beta', 'N/A')}. {'Consider rebalancing to manage concentration risk.' if risk_level == 'High' else 'Risk levels are within acceptable ranges.'}
"""
    return summary.strip()


def _format_reflexion_notes(reflexion_feedback: List[str]) -> str:
    """
    Format reflexion feedback into notes string.
    
    Args:
        reflexion_feedback: List of feedback strings
        
    Returns:
        Formatted reflexion notes
    """
    if not reflexion_feedback:
        return "No reflexion feedback - analysis approved on first iteration."
    
    # Filter out system messages
    substantive_feedback = [
        f for f in reflexion_feedback 
        if not f.startswith("Max iterations") and len(f) > 10
    ]
    
    if not substantive_feedback:
        return "Analysis approved after self-critique review."
    
    notes = "Self-Critique Notes:\n" + "\n".join(
        f"• {feedback}" for feedback in substantive_feedback
    )
    
    return notes


def _format_pushover_message(report: PortfolioReport) -> str:
    """
    Format report for Pushover notification.
    
    Args:
        report: PortfolioReport object
        
    Returns:
        Formatted notification text
    """
    # Build notification text
    lines = [
        "📊 Portfolio Analysis Complete",
        "",
        f"Strategy: {report.portfolio_strategy.action}",
        f"Market: {report.market_regime.status} / {report.market_regime.signal}",
        f"Risk Level: {report.risk_assessment.max_drawdown_risk}",
        "",
        "Positions:"
    ]
    
    # Add position summaries (max 5)
    for i, position in enumerate(report.positions[:5], 1):
        emoji = {"Buy": "🟢", "Sell": "🔴", "Hold": "🟡"}.get(position.action, "⚪")
        lines.append(f"{emoji} {position.ticker}: {position.action}")
    
    if len(report.positions) > 5:
        lines.append(f"... and {len(report.positions) - 5} more")
    
    lines.append("")
    lines.append(f"Confidence: {report.confidence_score:.0%}")
    lines.append("")
    lines.append(report.disclaimer[:100] + "...")
    
    return "\n".join(lines)


def _send_notification(notification_text: str, report: PortfolioReport):
    """
    Send Pushover notification with report summary.
    
    Args:
        notification_text: Formatted notification text
        report: Full PortfolioReport object
    """
    try:
        # Check if Pushover is configured
        if not settings.PUSHOVER_USER_KEY or not settings.PUSHOVER_API_TOKEN:
            logger.warning("Pushover not configured, skipping notification")
            return
        
        # Send notification
        priority = 1 if report.portfolio_strategy.priority == "High" else 0
        success = send_pushover_message(
            message_body=notification_text,
            title="Portfolio Manager V3 Report",
            priority=priority
        )
        
        if success:
            logger.info("Pushover notification sent successfully")
        else:
            logger.warning("Failed to send Pushover notification")
        
    except Exception as e:
        logger.error(f"Failed to send Pushover notification: {e}")
        sentry_sdk.capture_exception(e)
        # Don't fail the node if notification fails
