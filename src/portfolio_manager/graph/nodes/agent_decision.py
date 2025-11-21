"""The 'brain' of the agent, responsible for LLM-based decision making."""
import logging
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.tools import generate_tools_prompt
from src.portfolio_manager.prompts import get_system_prompt
from src.portfolio_manager.utils import format_state_for_llm, format_reasoning_trace, ApiType, call_gemini_api
from src.portfolio_manager.parsers import parse_agent_decision
from src.portfolio_manager.error_handler import capture_error
from src.portfolio_manager.config import settings


logger = logging.getLogger(__name__)


def agent_decision_node(state: dict) -> dict:
    """
    LLM-powered agent that decides which tool to call next.
    
    This is the "brain" of the autonomous agent. It:
    1. Reviews the current state (portfolio, analysis, confidence)
    2. Reasons about what information is needed
    3. Decides which tool to call (or to stop and generate report)
    4. Returns the decision in the state for the tool_execution_node
    """
    
    state_model = AgentState.model_validate(state)
    iteration = state_model.current_iteration
    logger.info(f"\n=== Agent Decision Node (Iteration {iteration}) ===")
    
    try:
        # 1. Format the current state for the LLM
        state_summary = format_state_for_llm(state_model)
        
        # 2. Get the available tools description
        tools_description = generate_tools_prompt()
        
        # 3. Build the full prompt
        system_prompt = get_system_prompt(tools_description)
        user_message = f"""Current State:
{state_summary}

Previous Actions:
{format_reasoning_trace(state_model.reasoning_trace)}

Current Iteration: {iteration}/{state_model.max_iterations}
Current Confidence: {state_model.confidence_score:.2%}

Based on this information, what should be your next single action?
"""
        
        full_prompt = f"{system_prompt}\n\n{user_message}"
        
        # 4. Call the LLM for a decision using the model from settings
        response_text = call_gemini_api(full_prompt, model=settings.AGENT_MODEL)
        
        # Report the LLM call for cost tracking
        state_model.newly_completed_api_calls = [
            {"api_type": ApiType.LLM_GEMINI_2_5_PRO.value, "count": 1}
        ]
        
        # 6. Parse the decision
        decision = parse_agent_decision(response_text)
        state_model.agent_reasoning.append(
            {"iteration": iteration, "prompt": full_prompt, "decision": response_text}
        )
        
        # 7. Prepare the state patch
        patch = {
            "agent_reasoning": state_model.agent_reasoning,
            "newly_completed_api_calls": [
                {"api_type": ApiType.LLM_GEMINI_2_5_PRO, "model": settings.AGENT_MODEL, "cost": 0.01} # placeholder
            ]
        }

        if decision["action"] == "generate_report":
            patch["next_tool_call"] = None
            patch["reasoning_trace"] = state_model.reasoning_trace + [f"Iteration {iteration}: Decided to generate final report."]
        else:
            tool_name = decision["action"]
            tool_args = decision.get("arguments", {})
            patch["next_tool_call"] = {"tool": tool_name, "args": tool_args}
            patch["reasoning_trace"] = state_model.reasoning_trace + [f"Iteration {iteration}: Chose tool: {tool_name}"]

        # Increment the iteration counter for the next loop
        patch["current_iteration"] = state_model.current_iteration + 1
        return patch
            
    except Exception as e:
        logger.error(f"Agent decision failed in iteration {iteration}: {e}", exc_info=True)
        capture_error(e)
        # Return a patch to add the error and increment iteration to avoid infinite loops
        return {
            "errors": state_model.errors + [f"Agent decision failed: {e}"],
            "current_iteration": state_model.current_iteration + 1
        }
