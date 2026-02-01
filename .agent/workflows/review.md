---
description: Review uncommitted code changes for quality, standards, and correctness
---

# Code Review Workflow

Follow these steps to review uncommitted changes in the current repository.

## 1. Analyze Uncommitted Changes

First, identify what has been modified.

1.  Run `git status` to see the state of the working directory.
2.  Run `git diff` to see the actual code changes.
    - If `git diff` is empty but there are staged changes, run `git diff --staged`.
    - If there are untracked files that are relevant, read their content using `view_file`.

## 2. Automated Verification

Before looking at the code style, ensure it breaks nothing.

1.  **Linting**: Run `npm run lint` (or the project's equivalent lint command).
    - _Goal_: Ensure no linting errors were introduced.
2.  **Building**: Run `npm run build` (or equivalent).
    - _Goal_: Ensure the project still compiles.
3.  **Testing**: Run `npm run test`
    - _Goal_: Ensure existing tests pass and new code is covered.

> [!NOTE]
> for frontend checks use nx commands

> [!NOTE]
> If any of these fail, STOP and report the failures. The code is not ready for qualitative review until it passes these checks.

## 3. Qualitative Code Review

Read the modified code (from `git diff` or `view_file`) and evaluate it against the following criteria:

### Code Standards & Clean Code

- **DRY (Don't Repeat Yourself)**: Is code duplicated? Could it be refactored into a shared function/component?
- **SOLID Principles**:
  - _Single Responsibility_: Do functions/classes do one thing?
  - _Open/Closed_: Is it easy to extend without modifying?
- **Readability**: Are variable/function names descriptive? Is the logic easy to follow?
- **Comments**: Are complex logic parts explained? (Avoid over-commenting obvious code).

### Specific Implementation Checks

- **Type Safety** (for TS): Are there explicit `any` types? Are interfaces/types defined correctly?
- **Error Handling**: Are errors caught and handled gracefully?
- **Security**: Any obvious security risks (exposed secrets, injection vulnerabilities)?

## 4. Report & Recommendations

Provide a summary of the review.

- **Status**: ✅ APPROVED / ⚠️ NEEDS IMPROVEMENT / ❌ REJECTED
- **Summary**: Brief description of changes.
- **Automated Checks**:
  - Lint: [Pass/Fail]
  - Build: [Pass/Fail]
  - Tests: [Pass/Fail]
- **Qualitative Findings**:
  - List any issues found (refer to specific files/lines).
  - detailed suggestions for refactoring or improvements.

> [!TIP]
> If issues are found, offer to fix them immediately.
