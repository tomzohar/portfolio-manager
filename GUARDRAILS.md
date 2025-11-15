# Autonomous Portfolio Manager: Guardrails

This document outlines the safety mechanisms and operational limits built into the Autonomous Portfolio Manager agent. These guardrails are designed to ensure cost control, data privacy, resource management, and operational stability.

---

## 1. Cost Control

To prevent excessive or runaway costs from API usage (LLM, SerpAPI, Polygon), the following limits are automatically enforced during each agent run. A violation of these rules will result in the immediate termination of the analysis.

| Guardrail                 | Limit                                   | Action on Violation |
| ------------------------- | --------------------------------------- | ------------------- |
| **Max LLM Calls**         | 20 calls per analysis                   | Terminate Run       |
| **Max Ticker API Calls**  | 3 data calls (news/technicals) per ticker | Terminate Run       |
| **Total Estimated Cost**  | $1.00 per analysis                      | Terminate Run       |
| **Repetitive Tool Calls** | 2 calls with identical arguments        | Terminate Run       |

-   **Implementation**: Cost tracking is managed within the `AgentState`. A dedicated `GuardrailNode` inspects the state before each agent decision cycle and enforces these limits. Tools are responsible for reporting their API usage.

---

## 2. Data Privacy

Protecting portfolio and user data is critical. The agent adheres to the following data handling policies.

| Policy                    | Description                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| **PII Redaction**         | All data is processed through a PII redaction utility before being used in prompts or logs.              |
| **Minimal Data in Prompts** | State formatting utilities (`format_state_for_llm`) send only aggregated, non-sensitive data to the LLM. |
| **Secure Logging**        | No sensitive portfolio details (e.g., exact values, holdings) are written to logs.                         |

---

## 3. Resource Management

To ensure the agent operates within reasonable memory and time constraints, the following resource limits are in place.

| Guardrail                  | Limit                        | Action on Violation      |
| -------------------------- | ---------------------------- | ------------------------ |
| **Max Portfolio Size**     | 100 positions                | Prohibit Analysis Start  |
| **Tool Batch Size Limit**  | 20 tickers per API call      | Enforced by Tools        |

-   **Implementation**: The `parse_portfolio` tool validates the portfolio size. Data analysis tools (`analyze_news`, `analyze_technicals`) internally manage batching to stay within their limits. The agent's prompt includes instructions to make batched calls for larger portfolios.

---

## 4. Operational Safety

To prevent the agent from getting stuck, failing silently, or performing illogical actions, the following operational guardrails are active.

| Guardrail                   | Description                                                                                             | Action on Violation |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------- |
| **State Transition Validation** | The graph validates that the `AgentState` is logical after each critical node (e.g., `portfolio` exists after parsing). | Terminate Run       |
| **Max Iterations**          | The agent cannot exceed the `max_iterations` value set at runtime (default: 10).                          | Generate Report     |
| **Comprehensive Error Tracking** | All tool and system errors are logged in `AgentState`. The main process exits with an error code if any failures occurred. | Exit with non-zero status |
