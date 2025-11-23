"""
Reflexion Node - Portfolio Manager V3

Implements self-critique mechanism to catch errors, biases, and
improve recommendation quality before finalization.

This node applies a "Risk Officer" persona to review synthesis outputs,
checking for completeness, coherence, biases, and risk alignment.
"""

from typing import Dict, Any
import logging
import json
import sentry_sdk
from pydantic import ValidationError

from ...agent_state import AgentState
from ...schemas import ReflexionCritique
from src.stock_researcher.utils.llm_utils import call_gemini_api

logger = logging.getLogger(__name__)

# Maximum number of reflexion iterations
MAX_REFLEXION_ITERATIONS = 2


def reflexion_node(state: AgentState) -> Dict[str, Any]:
    """
    LangGraph node for self-critique and quality assurance.
    
    Uses "Risk Officer" persona to review synthesis output and
    identify issues before finalization.
    
    Process:
    1. Check if max iterations reached
    2. Extract synthesis result
    3. Apply critique checklist using LLM
    4. Parse critique (approved or rejected with feedback)
    5. Update state and decide next step
    
    Args:
        state: Agent state with synthesis result
        
    Returns:
        Updated state with reflexion critique and approval status
    """
    try:
        logger.info("REFLEXION: SELF-CRITIQUE PHASE")
        
        # 1. Check iteration count
        iteration = state.reflexion_iteration
        
        if iteration >= MAX_REFLEXION_ITERATIONS:
            logger.warning(
                f"Max reflexion iterations ({MAX_REFLEXION_ITERATIONS}) reached, "
                "approving by default"
            )
            return {
                "reflexion_approved": True,
                "reflexion_feedback": [
                    "Max iterations reached - defaulting to approval"
                ],
                "reasoning_trace": state.reasoning_trace + [
                    f"Reflexion: Approved after {iteration} iterations (max reached)"
                ]
            }
        
        logger.info(f"Reflexion iteration: {iteration + 1}/{MAX_REFLEXION_ITERATIONS}")
        
        # 2. Extract synthesis result
        synthesis = state.synthesis_result
        
        if not synthesis:
            logger.error("No synthesis result to critique")
            return {
                "reflexion_approved": False,
                "reflexion_feedback": ["No synthesis result available"],
                "error": "Missing synthesis result"
            }
        
        # 3. Apply critique using LLM
        critique = _apply_risk_officer_critique(state, synthesis)
        
        # 4. Display critique results
        _log_critique_results(critique)
        
        # 5. Update state
        if critique.approved:
            logger.info("Reflexion: APPROVED")
            return {
                "reflexion_approved": True,
                "reflexion_iteration": iteration + 1,
                "reflexion_feedback": critique.issues_found,
                "confidence_adjustment": critique.confidence_adjustment,
                "reasoning_trace": state.reasoning_trace + [
                    f"Reflexion: Approved with confidence adjustment {critique.confidence_adjustment:+.2f}"
                ]
            }
        else:
            logger.warning("Reflexion: REJECTED - Sending back for revision")
            for issue in critique.issues_found:
                logger.warning(f"  Issue: {issue}")
            
            return {
                "reflexion_approved": False,
                "reflexion_iteration": iteration + 1,
                "reflexion_feedback": critique.issues_found + critique.suggestions,
                "reasoning_trace": state.reasoning_trace + [
                    f"Reflexion: Rejected - {len(critique.issues_found)} issues found"
                ]
            }
        
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.error(f"Reflexion error: {e}", exc_info=True)
        # Default to approval on error (fail-safe)
        return {
            "reflexion_approved": True,
            "reflexion_feedback": [f"Error in reflexion: {str(e)} - defaulting to approval"],
            "error": str(e)
        }


def _apply_risk_officer_critique(
    state: AgentState,
    synthesis: Dict[str, Any]
) -> ReflexionCritique:
    """
    Apply self-critique using LLM with "Risk Officer" persona.
    
    Args:
        state: Full agent state with all sub-agent outputs
        synthesis: Synthesis result to critique
        
    Returns:
        ReflexionCritique with approval status and feedback
    """
    # Build critique prompt
    prompt = _build_critique_prompt(state, synthesis)
    
    # Call LLM using centralized utility with Risk Officer persona
    try:
        response_text = call_gemini_api(
            prompt,
            model="gemini-2.5-pro-latest",  # Use Pro for critical thinking
            temperature=0.2  # Lower temperature for consistency
        )
        
        # Parse JSON response
        # Handle markdown code blocks if present
        response_text_clean = response_text.strip()
        
        if "```json" in response_text_clean:
            start = response_text_clean.find("```json") + 7
            end = response_text_clean.find("```", start)
            response_text_clean = response_text_clean[start:end].strip()
        elif "```" in response_text_clean:
            start = response_text_clean.find("```") + 3
            end = response_text_clean.find("```", start)
            response_text_clean = response_text_clean[start:end].strip()
        
        critique_dict = json.loads(response_text_clean)
        critique = ReflexionCritique(**critique_dict)
        return critique
        
    except (json.JSONDecodeError, ValidationError) as e:
        logger.warning(f"Failed to parse critique, defaulting to approval: {e}")
        # Fallback: approve with warning
        return ReflexionCritique(
            approved=True,
            issues_found=[f"Critique parsing failed: {str(e)}"],
            suggestions=[],
            confidence_adjustment=-0.1  # Reduce confidence due to error
        )


def _build_critique_prompt(
    state: AgentState,
    synthesis: Dict[str, Any]
) -> str:
    """
    Build LLM prompt for Risk Officer critique.
    
    Args:
        state: Full agent state
        synthesis: Synthesis result
        
    Returns:
        Formatted prompt string
    """
    # Extract key components
    position_actions = synthesis.get("position_actions", [])
    portfolio_strategy = synthesis.get("portfolio_strategy", {})
    conflicts = synthesis.get("conflicts", [])
    confidence = synthesis.get("confidence_score", 0.0)
    
    macro = state.macro_analysis or {}
    risk = state.risk_assessment or {}
    
    # Count actions
    buy_count = sum(1 for p in position_actions if p.get("action") == "Buy")
    sell_count = sum(1 for p in position_actions if p.get("action") == "Sell")
    hold_count = sum(1 for p in position_actions if p.get("action") == "Hold")
    
    # Format conflicts for display
    conflict_details = "\n".join(
        f"- {c.get('conflict_type')}: {c.get('resolution')}"
        for c in conflicts[:3]
    ) if conflicts else "None"
    
    # Build prompt
    prompt = f"""You are a Senior Risk Officer reviewing a portfolio analysis for quality assurance.

Your role: Critically examine the analysis for errors, biases, and inconsistencies.
Be skeptical but fair. Approve only if no significant issues found.

ANALYSIS SUMMARY:
=================

Portfolio Strategy: {portfolio_strategy.get('action', 'Unknown')}
Rationale: {portfolio_strategy.get('rationale', 'N/A')}

Position Recommendations: {len(position_actions)} positions
- Buy: {buy_count}
- Sell: {sell_count}
- Hold: {hold_count}

Conflicts Detected: {len(conflicts)}
{conflict_details}

Market Regime: {macro.get('status', 'Unknown')} / {macro.get('signal', 'Unknown')}
Portfolio Risk: Beta={risk.get('beta', 'N/A')}, Risk Level={risk.get('max_drawdown_risk', 'N/A')}

Overall Confidence: {confidence:.0%}


CRITIQUE CHECKLIST:
===================

1. DATA COMPLETENESS:
   - Are macro, fundamental, technical, and risk analyses present?
   - Is any critical data missing?

2. BIAS DETECTION:
   - Recency Bias: Are we overweighting recent events?
   - Concentration Risk: Do recommendations increase position concentration?
   - Confirmation Bias: Did we ignore contradictory signals?

3. CONFLICT RESOLUTION:
   - Were conflicts properly identified and resolved?
   - Are resolution rationales sound?
   - Were macro constraints (Risk-On/Risk-Off) applied?

4. RISK ALIGNMENT:
   - Do recommendations align with portfolio risk level?
   - If risk is High, are appropriate actions recommended?
   - Is macro risk (Risk-Off) properly considered?

5. COHERENCE:
   - Do per-ticker actions align with portfolio strategy?
   - Is strategy consistent with market regime?
   - Are confidence levels realistic?

OUTPUT FORMAT (JSON):
{{
  "approved": true or false,
  "issues_found": [
    "List specific issues if rejected",
    "Empty list if approved"
  ],
  "suggestions": [
    "Actionable suggestions for improvement",
    "Empty if approved"
  ],
  "confidence_adjustment": -0.3 to +0.3 (adjust overall confidence)
}}

CRITICAL: Output ONLY valid JSON, no explanatory text.

If NO significant issues found, set approved=true with empty issues_found list.
If issues found, set approved=false and list specific actionable issues.
"""
    
    return prompt


def _log_critique_results(critique: ReflexionCritique) -> None:
    """
    Log critique results.
    
    Args:
        critique: ReflexionCritique object
    """
    if critique.approved:
        logger.info("Status: APPROVED")
        if critique.confidence_adjustment != 0:
            logger.info(f"Confidence adjustment: {critique.confidence_adjustment:+.2f}")
    else:
        logger.warning("Status: REJECTED")
        logger.warning("Issues Found:")
        for i, issue in enumerate(critique.issues_found, 1):
            logger.warning(f"  {i}. {issue}")
        
        if critique.suggestions:
            logger.info("Suggestions:")
            for i, suggestion in enumerate(critique.suggestions, 1):
                logger.info(f"  {i}. {suggestion}")


def should_loop_back_to_synthesis(state: AgentState) -> bool:
    """
    Determine if we should loop back to synthesis for revision.
    
    Used as edge condition in LangGraph.
    
    Args:
        state: Current agent state
        
    Returns:
        True if should loop back, False if should continue to final report
    """
    approved = state.reflexion_approved
    iteration = state.reflexion_iteration
    
    # Loop back only if:
    # 1. Not approved
    # 2. Haven't hit max iterations
    return not approved and iteration < MAX_REFLEXION_ITERATIONS

