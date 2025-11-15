"""The 'brain' of the agent, responsible for LLM-based decision making."""
import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from src.portfolio_manager.agent_state import AgentState
from src.portfolio_manager.tools import generate_tools_prompt
from src.portfolio_manager.prompts import get_system_prompt
from src.portfolio_manager.utils import format_state_for_llm, format_reasoning_trace, ApiType
from src.portfolio_manager.parsers import parse_agent_decision

logger = logging.getLogger(__name__)


def agent_decision_node(state: AgentState) -> AgentState:
    """
    LLM-powered agent that decides which tool to call next.
    
    This is the "brain" of the autonomous agent. It:
    1. Reviews the current state (portfolio, analysis, confidence)
    2. Reasons about what information is needed
    3. Decides which tool to call (or to stop and generate report)
    4. Returns the decision in the state for the tool_execution_node
    """
    iteration = state["current_iteration"]
    logger.info(f"\n=== Agent Decision Node (Iteration {iteration}) ===")
    
    try:
        # 1. Format the current state for the LLM
        state_summary = format_state_for_llm(state)
        
        # 2. Get the available tools description
        tools_description = generate_tools_prompt()
        
        # 3. Build the full prompt
        system_prompt = get_system_prompt(tools_description)
        user_message = f"""Current State:
{state_summary}

Previous Actions:
{format_reasoning_trace(state["reasoning_trace"])}

Current Iteration: {iteration}/{state["max_iterations"]}
Current Confidence: {state["confidence_score"]:.2%}

Based on this information, what should be your next single action?
"""
        
        # 4. Call the LLM for a decision
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-pro",
            temperature=0.1,  # Lower temperature for more consistent, predictable decisions
        )
        
        messages = [
            ("system", system_prompt),
            ("user", user_message)
        ]
        
        response = llm.invoke(messages)
        
        # Report the LLM call for cost tracking
        state['newly_completed_api_calls'] = [
            {"api_type": ApiType.LLM_GEMINI_2_5_PRO.value, "count": 1}
        ]
        
        # 5. Parse the LLM's decision
        decision = parse_agent_decision(response.content)
        
        # 6. Store the reasoning and decision in the state
        state["agent_reasoning"].append({
            "iteration": iteration,
            "reasoning": decision.get("reasoning", ""),
            "action": decision.get("action", ""),
            "raw_response": response.content
        })
        
        reasoning_text = f"Iteration {iteration}: {decision.get('reasoning', 'No reasoning provided')}"
        
        # 7. Set the next tool call for the execution node
        if decision["action"] == "generate_report":
            state["next_tool_call"] = None  # Signal to generate the final report
            state["reasoning_trace"].append(f"{reasoning_text} -> Decided to generate final report.")
        else:
            state["next_tool_call"] = {
                "tool": decision["action"],
                "args": decision.get("arguments", {})
            }
            state["reasoning_trace"].append(f"{reasoning_text} -> Chose tool: {decision['action']}")
            
    except Exception as e:
        logger.error(f"Agent decision failed in iteration {iteration}: {e}", exc_info=True)
        state["errors"].append(f"Agent decision error: {str(e)}")
        state["next_tool_call"] = None  # Stop the workflow on a critical error
        state["reasoning_trace"].append(f"Iteration {iteration}: Agent decision failed critically. Stopping.")
        state['newly_completed_api_calls'] = [] # Ensure it's cleared on error
    
    return state
