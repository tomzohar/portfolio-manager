"""Graph node for generating the final report."""
import logging
from datetime import datetime
from typing import Dict, Any
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.prompts import get_final_report_prompt
from src.portfolio_manager.utils import format_state_for_final_report, ApiType
from src.stock_researcher.utils.llm_utils import call_gemini_api
from src.portfolio_manager.config import settings

logger = logging.getLogger(__name__)


def final_report_node(state: dict) -> dict:
    """
    Generates the final analysis report based on the complete agent state.
    """
    logger.info("Generating final analysis report...")
    state_model = AgentState.model_validate(state)
    
    try:
        # 1. Format the current state for the LLM
        formatted_state = format_state_for_final_report(state_model)
        
        # 2. Generate the prompt for the final report
        prompt = get_final_report_prompt(formatted_state)
        
        # 3. Call the LLM to generate the report
        final_report = call_gemini_api(prompt, model=settings.AGENT_MODEL)
        
        # 4. Update the state
        return {
            "final_report": final_report,
            "completed_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to generate final report: {e}", exc_info=True)
        # Assuming capture_error is defined elsewhere or will be added.
        # For now, we'll just append the error to state_model.errors
        # and return the error state.
        state_model.errors.append(f"Failed to generate final report: {e}")
        return {
            "errors": state_model.errors,
            "final_report": "Error: Failed to generate the final analysis report."
        }
