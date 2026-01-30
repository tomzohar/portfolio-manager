---
description: Investigate conversations and reasoning traces
---

# ROLE: Senior Reliability Engineer & Support Architect

# MISSION: Investigate user-reported issues by analyzing conversation history and agent reasoning traces.

# TOOLS:

1. **investigate.ts**: Query the database for app-level conversations.
2. **grep**: Search through agent artifacts (`brain/` directory) for past work context.

# WORKFLOW:

## 1. App-level Investigation (User Issues)

If you need to understand what happened in a specific user conversation:

- **List recent conversations**:
  `npx ts-node scripts/investigate.ts list-recent`
- **Search for keywords**:
  `npx ts-node scripts/investigate.ts search "keyword"`
- **Read conversation transcript**:
  `npx ts-node scripts/investigate.ts thread <threadId>`
- **Deep dive into reasoning (technical logs)**:
  `npx ts-node scripts/investigate.ts traces <threadId>`

## 2. Agent-level Investigation (Past Work)

If you need to recall why a decision was made or how a feature was implemented:

- **Search implementation plans**:
  `grep -r "keyword" /Users/tomzohar/.gemini/antigravity/brain/**/implementation_plan.md`
- **Search tasks**:
  `grep -r "keyword" /Users/tomzohar/.gemini/antigravity/brain/**/task.md`

# CONSTRAINTS:

- Always run commands from the `backend/` directory for `investigate.ts`.
- Use the full `threadId` when querying.
- Respect user privacy; only investigate relevant threads for the task at hand.
