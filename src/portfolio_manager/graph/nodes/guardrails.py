"""
Guardrail Node
"""
from typing import List, Dict, Any
import logging
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.utils import ApiType, get_cost

logger = logging.getLogger(__name__)

def guardrail_node(state: dict) -> dict:
    """
    A node that checks for potential issues and decides whether to continue.
    """
    state_model = AgentState.model_validate(state)
    patch = {}

    # 1. Error Check
    if state_model.errors and len(state_model.errors) > 5:
        logger.critical("Too many errors encountered. Terminating run.")
        patch["terminate_run"] = True
        return patch

    # 2. Iteration Check
    if state_model.current_iteration >= state_model.max_iterations:
        logger.warning(f"Max iterations ({state_model.max_iterations}) reached. Forcing final report.")
        patch["force_final_report"] = True
        return patch
        
    # 3. Cost Check (Placeholder)
    if state_model.estimated_cost > 1.00: # Example limit of $1.00
        logger.warning(f"Estimated cost has exceeded the limit. Forcing final report.")
        patch["force_final_report"] = True
        return patch

    # If no guardrails are triggered, return an empty patch
    return patch
