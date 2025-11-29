"""
Synthesis Node - Portfolio Manager V3

Combines sub-agent outputs, resolves conflicts, and generates
unified portfolio recommendations.

This node implements the synthesis phase of the ReAct+Reflexion cognitive protocol,
where outputs from specialized sub-agents (Macro, Fundamental, Technical, Risk) are
integrated into coherent recommendations.
"""

from typing import Dict, Any, List, Optional
import logging
from ...agent_state import AgentState
from ...schemas import (
    PositionAction,
    PortfolioStrategy,
    ConflictResolution
)
import sentry_sdk

logger = logging.getLogger(__name__)


def synthesis_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node for synthesizing sub-agent outputs.
    
    Process:
    1. Collect all sub-agent outputs
    2. Detect conflicts between agents
    3. Resolve conflicts using weighting rules
    4. Generate per-ticker recommendations
    5. Generate portfolio-level strategy
    6. Create executive summary
    
    Args:
        state: Agent state with all sub-agent outputs
        
    Returns:
        Updated state with synthesis_result
    """
    try:
        logger.info("SYNTHESIS: INTEGRATION PHASE")
        
        # 1. Extract sub-agent outputs
        macro = state.macro_analysis if hasattr(state, 'macro_analysis') else None
        fundamentals = state.fundamental_analysis if hasattr(state, 'fundamental_analysis') else {}
        technicals = state.technical_analysis if hasattr(state, 'technical_analysis') else {}
        risk = state.risk_assessment if hasattr(state, 'risk_assessment') else None
        portfolio = state.portfolio if hasattr(state, 'portfolio') else None
        reflexion_feedback = state.reflexion_feedback if hasattr(state, 'reflexion_feedback') else []
        
        # 2. Extract position weights from portfolio
        weights_map = _extract_weights_from_portfolio(portfolio)
        logger.info(f"Extracted weights for {len(weights_map)} positions")
        for ticker, weight in weights_map.items():
            logger.info(f"  {ticker}: {weight:.1%}")
        
        # 3. Validate we have sufficient data
        if not _validate_inputs(macro, fundamentals, technicals, risk):
            logger.warning("Incomplete sub-agent data for synthesis")
        
        # 4. Detect conflicts
        conflicts = _detect_conflicts(macro, fundamentals, technicals, risk)
        
        if conflicts:
            logger.info(f"Conflicts detected: {len(conflicts)}")
            for conflict in conflicts:
                logger.info(f"  • {conflict.conflict_type}")
                
        # Check for strict mode from reflexion feedback
        strict_mode = any("Reduce_Risk" in f or "reduce risk" in f.lower() for f in reflexion_feedback)
        if strict_mode:
            logger.info("SYNTHESIS: Strict Mode ENABLED by Reflexion Feedback")
        
        # 5. Generate per-ticker recommendations
        position_actions = _generate_position_actions(
            fundamentals, technicals, macro, risk, conflicts, weights_map, strict_mode
        )
        
        # 6. Generate portfolio strategy
        portfolio_strategy = _generate_portfolio_strategy(
            macro, risk, position_actions
        )
        
        # 7. Calculate overall confidence
        confidence_score = _calculate_overall_confidence(
            macro, fundamentals, technicals, risk
        )
        
        # 8. Create synthesis result
        synthesis_result = {
            "position_actions": [p.model_dump() for p in position_actions],
            "portfolio_strategy": portfolio_strategy.model_dump(),
            "conflicts": [c.model_dump() for c in conflicts],
            "confidence_score": confidence_score
        }
        
        # 9. Log summary
        logger.info(f"Synthesis: Generated recommendations for {len(position_actions)} positions")
        logger.info(f"Synthesis: Detected and resolved {len(conflicts)} conflicts")
        logger.info(f"Synthesis: Overall confidence: {confidence_score:.0%}")
        
        # 10. Update scratchpad
        scratchpad_entries = [
            f"Synthesis: Generated recommendations for {len(position_actions)} positions",
            f"Synthesis: Detected and resolved {len(conflicts)} conflicts",
            f"Synthesis: Portfolio strategy: {portfolio_strategy.action}"
        ]
        
        return {
            "synthesis_result": synthesis_result,
            "reasoning_trace": list(state.reasoning_trace) + scratchpad_entries
        }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Synthesis error: {e}", exc_info=True)
        return {
            "synthesis_result": None,
            "error": str(e),
            "reasoning_trace": list(state.reasoning_trace) + [
                f"Synthesis: Failed with error: {str(e)}"
            ]
        }


def _extract_weights_from_portfolio(portfolio: Optional[Dict]) -> Dict[str, float]:
    """
    Extract position weights from portfolio data.
    
    Handles two portfolio formats:
    1. List format: {"positions": [{"ticker": "AAPL", "weight": 0.3}, ...]}
    2. Dict format: {"positions": {"AAPL": 0.3, "MSFT": 0.7}} (legacy test format)
    
    Args:
        portfolio: Portfolio dict with 'positions' list or dict
        
    Returns:
        Dictionary mapping ticker to weight (0.0 to 1.0)
        
    Example:
        >>> portfolio = {
        ...     "positions": [
        ...         {"ticker": "AAPL", "weight": 0.30},
        ...         {"ticker": "MSFT", "weight": 0.70}
        ...     ]
        ... }
        >>> weights = _extract_weights_from_portfolio(portfolio)
        >>> assert weights == {"AAPL": 0.30, "MSFT": 0.70}
    """
    weights_map = {}
    
    if not portfolio:
        logger.warning("No portfolio data available for weight extraction")
        return weights_map
    
    positions = portfolio.get("positions", [])
    if not positions:
        logger.warning("Portfolio has no positions")
        return weights_map
    
    # Handle dict format (legacy tests): {"AAPL": 0.5, "MSFT": 0.5}
    if isinstance(positions, dict):
        return positions
    
    # Handle list format: [{"ticker": "AAPL", "weight": 0.3}, ...]
    for position in positions:
        ticker = position.get("ticker")
        weight = position.get("weight", 0.0)
        
        if ticker:
            weights_map[ticker] = weight
        else:
            logger.warning(f"Position missing ticker: {position}")
    
    return weights_map


def _validate_inputs(
    macro: Optional[Dict],
    fundamentals: Dict,
    technicals: Dict,
    risk: Optional[Dict]
) -> bool:
    """
    Validate that we have sufficient sub-agent data to synthesize.
    
    Args:
        macro: Macro agent output
        fundamentals: Fundamental agent outputs per ticker
        technicals: Technical agent outputs per ticker
        risk: Risk agent output
        
    Returns:
        True if inputs are sufficient, False otherwise
    """
    issues = []
    
    if not macro:
        issues.append("Missing macro analysis")
    if not fundamentals:
        issues.append("Missing fundamental analysis")
    if not technicals:
        issues.append("Missing technical analysis")
    if not risk:
        issues.append("Missing risk assessment")
    
    if issues:
        logger.warning("Input validation warnings:")
        for issue in issues:
            logger.warning(f"  • {issue}")
        return False
    
    return True


def _detect_conflicts(
    macro: Optional[Dict],
    fundamentals: Dict,
    technicals: Dict,
    risk: Optional[Dict]
) -> List[ConflictResolution]:
    """
    Detect conflicts between sub-agent recommendations.
    
    Conflict Types:
    1. Fundamental vs. Technical divergence (Buy vs. Sell)
    2. Macro Risk-Off vs. Buy signals
    3. High Portfolio Risk vs. Adding Positions
    
    Args:
        macro: Macro agent output
        fundamentals: Fundamental agent outputs per ticker
        technicals: Technical agent outputs per ticker
        risk: Risk agent output
        
    Returns:
        List of identified conflicts
    """
    conflicts = []
    
    # Conflict Type 1: Fundamental vs. Technical divergence
    for ticker in fundamentals.keys():
        fund_data = fundamentals.get(ticker)
        tech_data = technicals.get(ticker)
        
        # Ensure both data dictionaries exist and are valid
        if not fund_data or not isinstance(fund_data, dict) or not tech_data or not isinstance(tech_data, dict):
            continue
            
        # Safe extraction with nested checking
        fund_assessment = fund_data.get("assessment")
        if not fund_assessment or not isinstance(fund_assessment, dict):
            continue
            
        tech_assessment = tech_data.get("assessment")
        if not tech_assessment or not isinstance(tech_assessment, dict):
            continue
            
        fund_rec = fund_assessment.get("recommendation")
        tech_rec = tech_assessment.get("recommendation")
        
        # Check for Buy vs. Sell conflict
        if fund_rec in ["Buy", "Strong Buy"] and tech_rec in ["Sell", "Strong Sell"]:
            conflicts.append(ConflictResolution(
                conflict_type=f"Fundamental vs. Technical ({ticker})",
                conflicting_signals={
                    "Fundamental": f"{fund_rec} (undervalued)",
                    "Technical": f"{tech_rec} (downtrend)"
                },
                resolution="Weight by user horizon (long-term favors fundamental)",
                rationale="Long-term value may not align with short-term price action"
            ))
        elif fund_rec in ["Sell", "Strong Sell"] and tech_rec in ["Buy", "Strong Buy"]:
            conflicts.append(ConflictResolution(
                conflict_type=f"Fundamental vs. Technical ({ticker})",
                conflicting_signals={
                    "Fundamental": f"{fund_rec} (overvalued)",
                    "Technical": f"{tech_rec} (uptrend)"
                },
                resolution="Weight by user horizon (short-term favors technical)",
                rationale="Short-term momentum may diverge from fundamentals"
            ))
    
    # Conflict Type 2: Macro Risk-Off vs. Buy signals
    if macro and macro.get("signal") == "Risk-Off":
        buy_count = sum(
            1 for ticker in fundamentals
            if fundamentals[ticker].get("assessment", {}).get("recommendation") in ["Buy", "Strong Buy"]
        )
        if buy_count > 0:
            conflicts.append(ConflictResolution(
                conflict_type="Macro Risk-Off vs. Buy Signals",
                conflicting_signals={
                    "Macro": "Risk-Off (high VIX, defensive stance)",
                    "Fundamental": f"{buy_count} Buy recommendations"
                },
                resolution="Downgrade Buy → Hold, add macro disclaimer",
                rationale="Macro headwinds override individual stock bullishness"
            ))
    
    # Conflict Type 3: High Portfolio Risk vs. Adding Positions
    if risk and risk.get("max_drawdown_risk") == "High":
        buy_count = sum(
            1 for ticker in fundamentals
            if fundamentals[ticker].get("assessment", {}).get("recommendation") in ["Buy", "Strong Buy"]
        )
        if buy_count > 0:
            conflicts.append(ConflictResolution(
                conflict_type="High Portfolio Risk vs. Buy Signals",
                conflicting_signals={
                    "Risk Agent": f"High risk (Beta={risk.get('beta', 'N/A')}, Volatility={risk.get('portfolio_volatility', 'N/A')}%)",
                    "Fundamental/Technical": f"{buy_count} Buy signals"
                },
                resolution="Recommend rebalancing before adding positions",
                rationale="Portfolio already at high risk, adding may increase exposure"
            ))
            
    # Conflict Type 4: Portfolio Misalignment (High Beta in Risk-Off)
    if macro and macro.get("signal") == "Risk-Off":
        beta = risk.get("beta") if risk else None
        if beta and isinstance(beta, (int, float)) and beta > 1.1:
            conflicts.append(ConflictResolution(
                conflict_type="Portfolio Misalignment",
                conflicting_signals={
                    "Macro": "Risk-Off",
                    "Portfolio": f"High Beta ({beta:.2f})"
                },
                resolution="Prioritize reducing exposure (Sell/Trim) to align with regime",
                rationale="Portfolio is too aggressive for current market regime"
            ))
    
    return conflicts


def _generate_position_actions(
    fundamentals: Dict,
    technicals: Dict,
    macro: Optional[Dict],
    risk: Optional[Dict],
    conflicts: List[ConflictResolution],
    weights_map: Dict[str, float],
    strict_mode: bool = False
) -> List[PositionAction]:
    """
    Generate per-ticker recommendations by combining sub-agent signals.
    
    Uses weighted voting based on user investment horizon:
    - Long-term: Fundamental 60%, Technical 30%, Macro 10%
    - Short-term: Technical 50%, Fundamental 30%, Macro 20%
    
    Args:
        fundamentals: Fundamental agent outputs per ticker
        technicals: Technical agent outputs per ticker
        macro: Macro agent output
        risk: Risk agent output
        conflicts: Detected conflicts
        weights_map: Dictionary mapping ticker to current portfolio weight
        strict_mode: Whether to apply stricter risk management
        
    Returns:
        List of PositionAction recommendations
    """
    position_actions = []
    
    # Determine user horizon (default to long-term if not specified)
    # TODO: Make configurable via user preferences
    user_horizon = "long-term"
    
    # Weight schemes
    if user_horizon == "long-term":
        weights = {"fundamental": 0.6, "technical": 0.3, "macro": 0.1}
    else:  # short-term
        weights = {"fundamental": 0.3, "technical": 0.5, "macro": 0.2}
    
    tickers = set(fundamentals.keys()) | set(technicals.keys())
    
    for ticker in tickers:
        fund_analysis = fundamentals.get(ticker) or {}
        tech_analysis = technicals.get(ticker) or {}
        
        # Extract recommendations
        fund_assessment = fund_analysis.get("assessment") or {}
        if not isinstance(fund_assessment, dict):
            fund_assessment = {}
            
        tech_assessment = tech_analysis.get("assessment") or {}
        if not isinstance(tech_assessment, dict):
            tech_assessment = {}
            
        fund_rec = fund_assessment.get("recommendation", "Hold")
        # Technical agent uses "timing_recommendation" not "recommendation"
        tech_rec = tech_assessment.get("timing_recommendation", "Hold")
        
        fund_conf = fund_assessment.get("confidence", 0.5)
        tech_conf = tech_assessment.get("confidence", 0.5)
        
        # Log confidence extraction for diagnostic purposes
        logger.info(f"{ticker}: fund_rec={fund_rec}, tech_rec={tech_rec}, fund_conf={fund_conf:.2f}, tech_conf={tech_conf:.2f}")
        
        # Resolve recommendation using weights
        final_rec, final_conf = _resolve_recommendation(
            fund_rec, fund_conf, tech_rec, tech_conf, weights, macro, risk, conflicts, ticker, strict_mode
        )
        
        # Build rationale
        rationale = _build_rationale(
            ticker, fund_rec, tech_rec, final_rec, conflicts
        )
        
        # Get current weight from portfolio
        current_weight = weights_map.get(ticker, 0.0)
        
        # Create PositionAction
        position_action = PositionAction(
            ticker=ticker,
            action=final_rec,
            current_weight=current_weight,
            target_weight=0.0,   # TODO: Calculate based on recommendation
            rationale=rationale,
            confidence=final_conf,
            fundamental_signal=fund_rec,
            technical_signal=tech_rec
        )
        
        position_actions.append(position_action)
    
    return position_actions


def _resolve_recommendation(
    fund_rec: str,
    fund_conf: float,
    tech_rec: str,
    tech_conf: float,
    weights: Dict[str, float],
    macro: Optional[Dict],
    risk: Optional[Dict],
    conflicts: List[ConflictResolution],
    ticker: str,
    strict_mode: bool = False
) -> tuple:
    """
    Resolve final recommendation using weighted voting.
    
    Uses a scoring system:
    - Strong Buy = +2, Buy = +1, Hold = 0, Sell = -1, Strong Sell = -2
    - Scores weighted by confidence and agent weights
    - Macro Risk-Off applies dampening factor
    - Conflicts reduce confidence
    
    Args:
        fund_rec: Fundamental recommendation
        fund_conf: Fundamental confidence
        tech_rec: Technical recommendation
        tech_conf: Technical confidence
        weights: Agent weighting scheme
        macro: Macro agent output
        risk: Risk agent output
        conflicts: List of conflicts
        ticker: Ticker symbol being evaluated
        strict_mode: Whether to apply stricter risk management
        
    Returns:
        Tuple of (recommendation, confidence)
    """
    # Convert recommendations to scores
    score_map = {
        "Strong Buy": 2,
        "Buy": 1,
        "Hold": 0,
        "Sell": -1,
        "Strong Sell": -2
    }
    
    fund_score = score_map.get(fund_rec, 0) * fund_conf
    tech_score = score_map.get(tech_rec, 0) * tech_conf
    
    # Weighted average
    weighted_score = (
        fund_score * weights["fundamental"] +
        tech_score * weights["technical"]
    )
    
    # Apply macro override if Risk-Off
    if macro and macro.get("signal") == "Risk-Off":
        if risk and risk.get("beta") is not None:
            portfolio_beta = risk.get("beta")
        else:
            portfolio_beta = 1.0
            logger.info(f"{ticker}: No risk beta found, using fallback value 1.0")
        if portfolio_beta is None:
            portfolio_beta = 1.0
            
        # Logic: In Risk-Off, High Beta assets should be trimmed
        if portfolio_beta > 1.0:
            logger.info(f"{ticker}: Risk-Off + High Beta ({portfolio_beta:.2f}) -> Applying Sell bias")
            weighted_score -= 0.5  # Shift towards Sell
            
            # If Strict Mode (from Reflexion), apply heavier penalty
            if strict_mode:
                logger.info(f"{ticker}: STRICT MODE -> Forcing Sell bias")
                weighted_score -= 0.5  # Additional shift
        
        # Logic: In Risk-Off, Technical weakness should trump Fundamental "Hold"
        if tech_rec in ["Sell", "Strong Sell"]:
            if weighted_score > -0.4:
                logger.info(f"{ticker}: Risk-Off + Technical {tech_rec} overrides score {weighted_score:.2f} -> -0.5")
                weighted_score = -0.5  # Force to Sell range
        else:
            # Standard dampening for non-sell signals
            weighted_score *= 0.5  # Reduce bullishness by 50%
            logger.info(f"{ticker}: Applying Risk-Off dampening (score: {weighted_score:.2f})")
    
    # Safety Valve: If low confidence in Risk-Off, default to Sell/Trim for safety
    overall_conf = (fund_conf * weights["fundamental"] + tech_conf * weights["technical"])
    if macro and macro.get("signal") == "Risk-Off" and overall_conf < 0.4:
        logger.info(f"{ticker}: Low confidence ({overall_conf:.2f}) in Risk-Off -> Defaulting to Sell")
        weighted_score = min(weighted_score, -0.5)
    
    # Convert back to recommendation
    if weighted_score > 1.2:
        final_rec = "Strong Buy"
    elif weighted_score > 0.4:
        final_rec = "Buy"
    elif weighted_score < -1.2:
        final_rec = "Strong Sell"
    elif weighted_score < -0.4:
        final_rec = "Sell"
    else:
        final_rec = "Hold"
    
    # Calculate final confidence (weighted average of sub-agent confidences)
    final_conf = (
        fund_conf * weights["fundamental"] +
        tech_conf * weights["technical"]
    )
    
    # Reduce confidence if ticker-specific conflicts exist
    ticker_conflicts = [c for c in conflicts if ticker in c.conflict_type]
    if ticker_conflicts:
        final_conf *= 0.85  # 15% confidence penalty for conflicts
        logger.info(f"{ticker}: Reducing confidence due to conflicts ({final_conf:.0%})")
    
    return final_rec, final_conf


def _build_rationale(
    ticker: str,
    fund_rec: str,
    tech_rec: str,
    final_rec: str,
    conflicts: List[ConflictResolution]
) -> str:
    """
    Build human-readable rationale for the recommendation.
    
    Args:
        ticker: Ticker symbol
        fund_rec: Fundamental recommendation
        tech_rec: Technical recommendation
        final_rec: Final resolved recommendation
        conflicts: List of conflicts
        
    Returns:
        Human-readable rationale string
    """
    rationale_parts = []
    
    # Note alignment or conflict
    if fund_rec == tech_rec:
        rationale_parts.append(f"Fundamental and Technical agree: {fund_rec}")
    else:
        rationale_parts.append(f"Fundamental: {fund_rec}, Technical: {tech_rec}")
    
    # Note final decision if different
    if final_rec != fund_rec and final_rec != tech_rec:
        rationale_parts.append(f"Resolved to {final_rec} based on weighting")
    elif final_rec == fund_rec and fund_rec != tech_rec:
        rationale_parts.append(f"Prioritized Fundamental assessment")
    elif final_rec == tech_rec and fund_rec != tech_rec:
        rationale_parts.append(f"Prioritized Technical assessment")
    
    # Note if conflict affected decision
    ticker_conflicts = [c for c in conflicts if ticker in c.conflict_type]
    if ticker_conflicts:
        rationale_parts.append(f"Conflict noted: {ticker_conflicts[0].resolution}")
    
    return ". ".join(rationale_parts)


def _generate_portfolio_strategy(
    macro: Optional[Dict],
    risk: Optional[Dict],
    position_actions: List[PositionAction]
) -> PortfolioStrategy:
    """
    Generate high-level portfolio strategy based on aggregated signals.
    
    Decision Logic:
    - Risk-Off macro → Reduce_Risk
    - High portfolio risk → Rebalance
    - More Buys than Sells → Accumulate
    - More Sells than Buys → Rebalance
    - Balanced → Hold
    
    Args:
        macro: Macro agent output
        risk: Risk agent output
        position_actions: List of position recommendations
        
    Returns:
        PortfolioStrategy object
    """
    # Count actions
    buy_count = sum(1 for p in position_actions if p.action in ["Buy", "Strong Buy"])
    sell_count = sum(1 for p in position_actions if p.action in ["Sell", "Strong Sell"])
    hold_count = sum(1 for p in position_actions if p.action == "Hold")
    
    # Determine strategy based on macro and risk
    if macro and macro.get("signal") == "Risk-Off":
        action = "Reduce_Risk"
        rationale = f"Market regime is Risk-Off. Recommend reducing exposure. {sell_count} Sell signals, {hold_count} Hold."
        priority = "High"
    elif risk and risk.get("max_drawdown_risk") == "High":
        action = "Rebalance"
        rationale = f"Portfolio risk is High (Beta={risk.get('beta', 'N/A')}). Rebalance before adding positions."
        priority = "High"
    elif buy_count > sell_count:
        action = "Accumulate"
        rationale = f"{buy_count} Buy signals vs. {sell_count} Sell signals. Consider accumulating quality positions."
        priority = "Medium"
    elif sell_count > buy_count:
        action = "Rebalance"
        rationale = f"{sell_count} Sell signals detected. Consider trimming or exiting positions."
        priority = "Medium"
    else:
        action = "Hold"
        rationale = f"Balanced signals ({buy_count} Buy, {sell_count} Sell, {hold_count} Hold). Maintain current allocation."
        priority = "Low"
    
    return PortfolioStrategy(
        action=action,
        rationale=rationale,
        priority=priority
    )


def _calculate_overall_confidence(
    macro: Optional[Dict],
    fundamentals: Dict,
    technicals: Dict,
    risk: Optional[Dict]
) -> float:
    """
    Calculate overall confidence in the analysis.
    
    Averages confidence scores from all sub-agents:
    - Macro confidence
    - Average fundamental confidence per ticker
    - Average technical confidence per ticker
    - Risk confidence (always 0.95 for deterministic calculations)
    
    Args:
        macro: Macro agent output
        fundamentals: Fundamental agent outputs per ticker
        technicals: Technical agent outputs per ticker
        risk: Risk agent output
        
    Returns:
        Confidence score (0.0 to 1.0)
    """
    confidences = []
    
    # Macro confidence
    if macro and "confidence" in macro:
        confidences.append(macro["confidence"])
    
    # Average fundamental confidences
    for ticker, analysis in fundamentals.items():
        if analysis and "assessment" in analysis and "confidence" in analysis["assessment"]:
            confidences.append(analysis["assessment"]["confidence"])
    
    # Average technical confidences
    for ticker, analysis in technicals.items():
        if analysis and "assessment" in analysis and "confidence" in analysis["assessment"]:
            confidences.append(analysis["assessment"]["confidence"])
    
    # Risk always has high confidence (it's deterministic)
    if risk:
        confidences.append(0.95)
    
    if not confidences:
        logger.warning("No confidence scores available, defaulting to 0.5")
        return 0.5  # Default to medium confidence
    
    overall_confidence = sum(confidences) / len(confidences)
    logger.info(f"Overall confidence: {overall_confidence:.0%} (from {len(confidences)} sources)")
    
    return overall_confidence

