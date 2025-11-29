# Portfolio Manager: Autonomous Agent Evolution

> **⚠️ NOTE:** This document describes the initial transition to the V2 Autonomous Agent.
> For the current **V3 Supervisor Multi-Agent System**, please refer to `MANAGER_V3.md`.

## Product Vision

Transform the Stock Researcher from a rigid, sequential pipeline into an intelligent, autonomous agent system where the Portfolio Manager acts as the central decision-making entity. The Portfolio Manager will dynamically determine what information it needs, request specific analyses, and iteratively refine its understanding before delivering actionable recommendations.

## Current State vs. Future State

### Current State: Sequential Pipeline
- **Fixed execution order**: Portfolio parsing → News fetching → Parallel analysis → Final recommendation
- **No decision-making**: All agents run every time regardless of need
- **Single-pass reasoning**: The Portfolio Manager receives all data once and produces a final output
- **Resource inefficient**: Fetches news and technical data for all stocks, even if not needed
- **Limited adaptability**: Cannot request deeper analysis on specific stocks or follow-up questions

### Future State: Autonomous Agent System
- **Dynamic workflow**: Portfolio Manager decides what information to gather and in what order
- **Intelligent routing**: Can request specific analyses for specific stocks based on initial findings
- **Iterative reasoning**: Can analyze partial data, identify gaps, and request more information
- **Resource optimized**: Only fetches data for stocks that require attention or deeper investigation
- **Self-correcting**: Can validate its reasoning and request additional context if confidence is low

## Product Requirements

### Functional Requirements

#### FR1: Autonomous Decision-Making
- The Portfolio Manager agent must be able to decide autonomously which tools/agents to invoke
- It should support multi-turn reasoning (analyze → reflect → gather more data → re-analyze)
- It must be able to terminate the workflow when it has sufficient confidence in its recommendations

#### FR2: Dynamic Tool Selection
The Portfolio Manager should have access to the following tools and decide when to use them:

1. **Portfolio Data Tool**: Retrieve current portfolio structure and positions
2. **News Search Tool**: Fetch news for specific tickers (not all at once)
3. **News Analysis Tool**: Summarize and analyze sentiment for specific news sets
4. **Technical Analysis Tool**: Calculate and interpret technical indicators for specific tickers
5. **Historical Performance Tool**: Compare current metrics against historical trends
6. **Position Sizing Tool**: Calculate recommended position adjustments based on risk parameters
7. **Confidence Assessment Tool**: Self-evaluate recommendation confidence and identify gaps

#### FR3: Selective Analysis
- The Portfolio Manager should prioritize which stocks need analysis based on:
  - Portfolio weight (analyze largest positions first)
  - Recent price movements (focus on outliers)
  - User-defined flags or tags in the portfolio
  - Time/cost constraints
- It should be able to perform "quick scans" vs. "deep dives" based on context

#### FR4: State Management
- The system must maintain conversation state across multiple agent invocations
- All intermediate reasoning, data gathered, and partial conclusions must be tracked
- The state should be inspectable for debugging and auditing purposes

#### FR5: Graceful Degradation
- If a tool fails (e.g., news API is down), the agent should adapt its strategy
- It must still produce recommendations based on available data
- Confidence scores should reflect data completeness

### Non-Functional Requirements

#### NFR1: Performance
- Maximum execution time: 5 minutes for a portfolio of up to 20 stocks
- The agent should parallelize independent tool calls when possible
- Cost optimization: Minimize redundant API calls and LLM tokens

#### NFR2: Observability
- Every agent decision (which tool to call, why) must be logged
- The final output must include a "reasoning trace" showing the decision path
- Integration with existing Sentry error monitoring

#### NFR3: Testability
- All tools must be mockable for unit testing
- The agent's decision-making logic must be testable independently of LLM responses
- Support for "replay" mode to reproduce agent behavior from saved state

#### NFR4: Maintainability
- LangGraph implementation must be modular and extensible
- New tools should be easily pluggable without changing core agent logic
- Configuration-driven behavior (e.g., max iterations, confidence thresholds)

#### NFR5: Safety & Guardrails
- The agent must operate within predefined safety limits to control costs and prevent misuse.
- For a detailed overview of the implemented safety mechanisms, see the [Guardrails Documentation](./GUARDRAILS.md).

## Proposed Flow Architecture

### High-Level Agent Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    Portfolio Manager Agent                   │
│                  (Autonomous Decision Maker)                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │  Start Node   │
                    │ (Get Context) │
                    └───────┬───────┘
                            │
                            ▼
                ┌───────────────────────┐
                │   Parse Portfolio     │◄──┐
                │  (Get all positions)  │   │
                └───────┬───────────────┘   │
                        │                   │
                        ▼                   │
            ┌──────────────────────┐        │
            │  Agent Decision Node │        │
            │   - What to analyze? │        │
            │   - Which tools?     │        │
            │   - Done or continue?│        │
            └──────┬───────────────┘        │
                   │                        │
         ┌─────────┼─────────┬──────────┐  │
         │         │         │          │  │
         ▼         ▼         ▼          ▼  │
    ┌────────┐ ┌────────┐ ┌──────┐ ┌─────┐│
    │  News  │ │Tech.   │ │Risk  │ │More?││
    │  Tool  │ │Analysis│ │Assess│ │     ││
    └───┬────┘ └───┬────┘ └──┬───┘ └──┬──┘│
        │          │          │         │  │
        └──────────┴──────────┴─────────┘  │
                   │                        │
                   ▼                        │
         ┌──────────────────┐               │
         │  Reflect & Decide │              │
         │  - Enough info?   │              │
         │  - High confidence?│─────No──────┘
         └──────┬────────────┘
                │ Yes
                ▼
      ┌──────────────────────┐
      │  Generate Final      │
      │  Recommendations     │
      └──────┬───────────────┘
             │
             ▼
    ┌────────────────────┐
    │  Output & Notify   │
    │  - Console Report  │
    │  - WhatsApp        │
    └────────────────────┘
```

### Detailed Agent Behavior

#### Phase 1: Context Gathering (Mandatory)
1. Parse portfolio from Google Sheets
2. Identify key metrics: total value, number of positions, sector allocation
3. Flag positions that exceed risk thresholds (e.g., >20% of portfolio)

#### Phase 2: Initial Assessment (Agent-Driven)
The agent analyzes the portfolio and decides:
- "Do any positions require immediate attention?" (red flags: >25% allocation, recent 20%+ drops)
- "Which stocks should I prioritize?" (rank by size, volatility, or user tags)
- "What type of analysis is needed?" (quick scan vs. deep dive)

#### Phase 3: Iterative Investigation (Dynamic Loop)
The agent can:
- Request news for specific tickers
- Analyze technical indicators for flagged stocks
- Compare current metrics against historical baselines
- Re-assess after each tool call
- **Exit condition**: Either (a) high confidence achieved, (b) max iterations reached, or (c) no more useful tools to call

#### Phase 4: Synthesis & Recommendation
- Consolidate all gathered information
- Generate specific, actionable recommendations (INCREASE/DECREASE/HOLD)
- Include confidence scores and reasoning for each recommendation
- Highlight any data gaps or caveats

#### Phase 5: Output & Notification
- Display structured report in console
- Send summary to WhatsApp (same as current system)
- Log full reasoning trace for audit

## Expected Output

### Console Output Structure

```
═══════════════════════════════════════════════════════════════
            AUTONOMOUS PORTFOLIO ANALYSIS REPORT
═══════════════════════════════════════════════════════════════

Portfolio Summary:
  Total Value: $125,450.00
  Positions: 12
  Analysis Depth: 7 deep dives, 5 quick scans
  Confidence: 87% (High)

─────────────────────────────────────────────────────────────

AGENT REASONING TRACE:

Step 1: Portfolio parsed (12 positions)
  ↳ Identified 3 positions >15% allocation (AAPL, MSFT, NVDA)
  ↳ Decision: Prioritize these for deep analysis

Step 2: Fetched news for AAPL, MSFT, NVDA
  ↳ AAPL: 5 articles, sentiment: +0.72 (Positive)
  ↳ MSFT: 8 articles, sentiment: +0.45 (Neutral-Positive)
  ↳ NVDA: 12 articles, sentiment: -0.30 (Mixed)
  ↳ Decision: NVDA requires technical analysis due to negative sentiment

Step 3: Technical analysis for NVDA
  ↳ RSI: 68 (Approaching overbought)
  ↳ MACD: Bearish crossover detected
  ↳ Decision: Recommend DECREASE position

Step 4: Quick scan of remaining 9 positions
  ↳ No red flags detected
  ↳ Decision: Maintain current allocations

Step 5: Confidence check
  ↳ High confidence (87%) - sufficient data gathered
  ↳ Decision: Generate final recommendations

─────────────────────────────────────────────────────────────

ACTIONABLE RECOMMENDATIONS:

🔴 DECREASE Position:
  • NVDA (NVIDIA): Reduce from 18% to 12% (~$7,500 sale)
    Reason: Negative sentiment + technical bearish signals
    Confidence: 85%

🟡 MONITOR Closely:
  • MSFT (Microsoft): Currently 16% allocation
    Reason: Neutral sentiment, stable technicals, but concentration risk
    Confidence: 78%

🟢 HOLD All Other Positions:
  • AAPL, GOOGL, AMZN, etc.
    Reason: No concerning signals, balanced allocations
    Confidence: 90%

─────────────────────────────────────────────────────────────

Data Coverage:
  ✓ Portfolio structure (100%)
  ✓ News analysis (8/12 stocks - 67%)
  ✓ Technical analysis (3/12 stocks - 25%)
  ⚠ Historical comparison (Not performed - optional)

Execution Time: 2m 34s
API Costs: ~$0.42
Next scheduled run: Tomorrow, 9:00 AM EST

═══════════════════════════════════════════════════════════════
```

### WhatsApp Output (Condensed)

```
📊 Portfolio Analysis Complete

🔴 DECREASE: NVDA (18%→12%)
   Negative sentiment + bearish technicals

🟡 MONITOR: MSFT (16%)
   Concentration risk

🟢 HOLD: All other positions

Confidence: 87%
Full report: Check console logs

Next run: Tomorrow 9AM
```

## Definition of Done

### Must-Have Criteria (MVP)

✅ **DOD-1: Autonomous Decision-Making**
- [ ] Portfolio Manager agent can decide which tools to call based on portfolio state
- [ ] Agent can make at least 3 sequential decisions before generating recommendations
- [ ] Agent reasoning is logged and inspectable

✅ **DOD-2: Selective Analysis**
- [ ] Agent analyzes fewer than 100% of stocks when appropriate (e.g., only largest positions)
- [ ] Execution time is 30%+ faster than sequential pipeline for portfolios with >10 stocks

✅ **DOD-3: State Management**
- [ ] LangGraph state includes: portfolio data, tool call history, intermediate conclusions
- [ ] State can be serialized and inspected for debugging

✅ **DOD-4: Output Quality**
- [ ] Final recommendations include confidence scores
- [ ] Reasoning trace shows clear decision path
- [ ] Output format matches specification above

✅ **DOD-5: Integration**
- [ ] Replaces existing `orchestrator.py` with minimal changes to `main.py`
- [ ] All existing tests pass or are updated to reflect new architecture
- [ ] WhatsApp integration works identically to current system

✅ **DOD-6: Error Handling**
- [ ] If a tool fails, agent adapts strategy and continues
- [ ] System never crashes due to LLM hallucination or invalid tool calls
- [ ] All errors are logged to Sentry with full context

✅ **DOD-7: Performance**
- [ ] Average execution time ≤ 3 minutes for 15-stock portfolio
- [ ] Cost per run ≤ $0.50 in LLM API costs

### Success Metrics

**Primary Metrics:**
1. **Decision Quality**: Agent makes contextually appropriate tool calls (manual review of 10 runs)
2. **Efficiency**: 40% reduction in unnecessary API calls compared to sequential pipeline
3. **Reliability**: 95%+ success rate in production over 30 days

**Secondary Metrics:**
1. Reasoning trace comprehensibility (can non-technical users follow the logic?)
2. Confidence calibration (are 80% confidence recommendations actually correct 80% of the time?)
3. User satisfaction (qualitative feedback on recommendation usefulness)

### Out of Scope (Future Enhancements)

- Human-in-the-loop approval before executing recommendations
- Multi-agent collaboration (e.g., separate agents for different asset classes)
- Learning from past recommendations (feedback loop)
- Real-time streaming updates
- Web dashboard for visualizing agent reasoning

## Implementation Phases

### Phase 1: Core LangGraph Setup (Week 1)
- Set up LangGraph framework
- Define state schema
- Create basic agent loop with 2-3 tools
- Replace orchestrator.py

### Phase 2: Tool Migration (Week 2)
- Migrate all existing agents to LangGraph tools
- Implement selective analysis logic
- Add reasoning trace logging

### Phase 3: Optimization & Testing (Week 3)
- Performance optimization (parallelization, caching)
- Comprehensive testing (unit, integration, end-to-end)
- Update documentation

### Phase 4: Production Deployment (Week 4)
- Deploy to GitHub Actions
- Monitor for 1 week with manual review
- Gather feedback and iterate

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM makes poor tool choices | High | Add validation layer, constrain tool options, extensive testing |
| Infinite loops in agent reasoning | High | Max iteration limit (10), timeout safeguards |
| Increased costs due to more LLM calls | Medium | Budget tracking, early alerts, optimize prompts |
| Complex debugging of agent behavior | Medium | Comprehensive logging, replay capability, LangSmith integration |
| Longer execution time initially | Low | Optimize after MVP, still faster than manual analysis |

## Open Questions

1. **Tool Call Parallelization**: Should the agent be able to request multiple tools in parallel, or strictly sequential?
   - *Recommendation*: Support both - agent can specify when parallel execution is safe

2. **Confidence Threshold**: What confidence level triggers additional analysis?
   - *Recommendation*: Start with 75%, tune based on production data

3. **Max Iterations**: How many reasoning loops before forced termination?
   - *Recommendation*: 10 iterations or 4 minutes, whichever comes first

4. **Prompt Engineering**: How much context to include in each agent decision prompt?
   - *Recommendation*: Include full state summary, last 3 tool results, and clear termination criteria

5. **Backward Compatibility**: Should the system support a "legacy mode" with the sequential pipeline?
   - *Recommendation*: Yes, via config flag for first 30 days

## Conclusion

This evolution from a sequential pipeline to an autonomous agent represents a fundamental shift in how the Stock Researcher operates. Instead of blindly running all analyses, the system will intelligently decide what information it needs, prioritize high-impact stocks, and iteratively refine its understanding before delivering recommendations.

The result will be a faster, more cost-effective, and more intelligent system that can adapt to different portfolio compositions and market conditions. The clear success criteria and phased implementation plan ensure we can validate the approach incrementally and roll back if necessary.

**Next Steps:**
1. Review and approve this product spec
2. Technical design doc (LangGraph architecture details)
3. Begin Phase 1 implementation

