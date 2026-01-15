import sys
import os
import asyncio
import json
import re
from typing import Type, TypeVar, Optional, List, Set
from pydantic import BaseModel, Field
from enum import Enum

# --- CONFIGURATION ---
SDK_PATH = r'/Users/tomzohar/projects/stocks-researcher/cursor-agent-sdk-python/src'
MAX_RETRIES = 5
MAX_REVIEW_CYCLES = 5  # Maximum number of Review -> Fix loops

if SDK_PATH not in sys.path:
    sys.path.insert(0, SDK_PATH)

try:
    from cursor_agent_sdk import query, CursorAgentOptions, AssistantMessage, TextBlock, ResultMessage, ToolUseBlock
except ImportError:
    print(f"Error: Could not import cursor_agent_sdk from {SDK_PATH}")
    sys.exit(1)

# Import logging utilities
from logging_utils import AgentLogger
from console_formatters import RichFormatter

# --- STRUCTURED DATA MODELS (Pydantic) ---

class TestCreation(BaseModel):
    test_file_name: str = Field(description="The name of the test file created (e.g., test_fib.py)")
    test_plan_summary: str = Field(description="A brief summary of what is being tested")

class TestStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"

class ImplementationResult(BaseModel):
    status: TestStatus = Field(description="The result of running the tests")
    files_modified: List[str] = Field(description="List of files that were created or modified in this step")
    error_summary: Optional[str] = Field(description="If failed, a short summary of the error", default=None)

class ReviewDecision(str, Enum):
    APPROVED = "APPROVED"
    REQUEST_CHANGES = "REQUEST_CHANGES"

class Severity(str, Enum):
    CRITICAL = "CRITICAL"  # Logic bugs, security, crashes
    MINOR = "MINOR"        # Style, naming, comments

class CritiqueItem(BaseModel):
    file_path: str = Field(description="The file containing the issue")
    severity: Severity
    comment: str = Field(description="Specific feedback")

class CodeReview(BaseModel):
    decision: ReviewDecision
    critique: List[CritiqueItem] = Field(description="List of specific issues found that need fixing, each with severity and location")
    security_concerns: bool

# --- UTILITIES ---

T = TypeVar("T", bound=BaseModel)

def extract_json(response_text: str, model: Type[T]) -> T:
    """Robustly extracts JSON from LLM text."""
    # Strategy 1: Look for ```json specifically (not just any code block)
    json_match = re.search(r"```json\s*(.*?)```", response_text, re.DOTALL)
    if json_match:
        json_str = json_match.group(1).strip()
    else:
        # Strategy 2: Find all code blocks and try each one
        all_code_blocks = re.findall(r"```(?:json)?\s*(.*?)```", response_text, re.DOTALL)
        json_str = None
        for block in reversed(all_code_blocks):  # Start from the end
            block = block.strip()
            if block.startswith('{') and block.endswith('}'):
                json_str = block
                break
        
        # Strategy 3: Fallback to finding { } boundaries
        if not json_str:
            start = response_text.find('{')
            end = response_text.rfind('}') + 1
            if start != -1 and end != 0:
                json_str = response_text[start:end]
            else:
                raise ValueError("No JSON found in response")

    try:
        data = json.loads(json_str)
        return model(**data)
    except Exception as e:
        print(f"⚠️ JSON Parse Error: {e}")
        print(f"⚠️ Attempted to parse: {json_str[:200]}...")
        raise

# --- AGENT WRAPPER ---

async def run_agent(
    agent_name: str, 
    prompt: str, 
    schema: Optional[Type[T]] = None, 
    session_id: str = None, 
    cwd: str = None,
    logger: AgentLogger = None,
    formatter: RichFormatter = None
) -> tuple[Optional[T], str]:
    """
    Run an agent with enhanced logging and observability.
    
    Args:
        agent_name: Name of the agent to run
        prompt: Prompt to send to the agent
        schema: Optional Pydantic schema for structured output
        session_id: Optional session ID to resume
        cwd: Working directory
        logger: Logger instance for structured logging
        formatter: Console formatter for rich output
    
    Returns:
        Tuple of (parsed result, session_id)
    """
    from datetime import datetime
    start_time = datetime.now()
    
    # Print agent start (formatter OR fallback, not both)
    if formatter:
        formatter.print_agent_start(agent_name, session_id)
    else:
        print(f"\n🔹 [{agent_name}] processing..." + (f" (Session: ...{session_id[-6:]})" if session_id else " (Fresh Context)"))
    
    # Log agent start to file only (no console output here)
    if logger:
        logger.agent_start(agent_name, prompt, session_id)
    
    if schema:
        schema_json = schema.model_json_schema()
        prompt += f"\n\nIMPORTANT: Output strictly JSON matching this schema:\n{json.dumps(schema_json, indent=2)}\nWrap response in ```json code blocks."

    options = CursorAgentOptions(
        cwd=cwd or os.getcwd(),
        permission_mode="acceptEdits",
        resume=session_id
    )

    full_response = []
    final_session_id = session_id
    
    # Deduplication: track recent text blocks to avoid showing duplicates
    recent_text_blocks = []
    DEDUP_WINDOW = 5  # Check last 5 blocks for duplicates

    try:
        async for msg in query(prompt=prompt, options=options):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        # Check for duplicate text
                        is_duplicate = block.text in recent_text_blocks
                        
                        if not is_duplicate:
                            # Track this text block
                            recent_text_blocks.append(block.text)
                            if len(recent_text_blocks) > DEDUP_WINDOW:
                                recent_text_blocks.pop(0)
                            
                            # Always show agent thoughts in verbose mode, condensed in normal mode
                            if formatter:
                                formatter.stream_agent_output(agent_name, block.text)
                            
                            # Log to file only (avoid double logging)
                            if logger:
                                logger.stream_agent_response(agent_name, block.text)
                        
                        # Always append to full_response (even duplicates) for complete output
                        full_response.append(block.text)
                    
                    elif isinstance(block, ToolUseBlock):
                        # Skip tool calls with empty names
                        if not block.name or not block.name.strip():
                            continue
                        
                        # Use formatter OR logger, not both (to avoid duplicate output)
                        if formatter:
                            formatter.print_tool_call(agent_name, block.name, block.input)
                        
                        # Always log to file
                        if logger:
                            logger.log_tool_call(agent_name, block.name, block.input)
            
            elif isinstance(msg, ResultMessage):
                final_session_id = msg.session_id
    
    except Exception as e:
        # Enhanced error logging with context
        context = {
            "agent_name": agent_name,
            "session_id": session_id or "none",
            "prompt_length": len(prompt),
            "response_length": len("".join(full_response))
        }
        
        agent_response_tail = "".join(full_response)
        
        if formatter:
            formatter.print_error(e, context)
        else:
            print(f"❌ Error in {agent_name}: {e}")
        
        if logger:
            logger.log_error(e, context, agent_response_tail)
        
        return None, session_id

    result_text = "".join(full_response)
    
    # Calculate duration
    duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
    
    # Log agent completion
    if logger:
        logger.agent_end(agent_name, success=True, output_length=len(result_text))
    
    if formatter:
        formatter.print_agent_end(agent_name, success=True, duration_ms=duration_ms, output_length=len(result_text))
    else:
        print(f"✅ [{agent_name}] Done.")
    
    parsed_result = None
    if schema:
        try:
            parsed_result = extract_json(result_text, schema)
        except ValueError as e:
            if formatter:
                formatter.print_error(e, {"agent": agent_name, "issue": "JSON parsing failed"})
            else:
                print(f"❌ Failed to parse output from {agent_name}")
            
            if logger:
                logger.log_error(e, {"agent": agent_name}, result_text[-500:])

    return parsed_result, final_session_id

# --- WORKFLOW FUNCTIONS ---

async def main():
    # Initialize logging and formatting
    verbose = os.getenv("AGENT_VERBOSE", "0") == "1"
    logger = AgentLogger()
    formatter = RichFormatter(verbose=verbose)
    
    print("🚀 STARTING AGENT DEVELOPMENT CYCLE (Structured + Loop)")
    if verbose:
        print("💬 Verbose mode enabled (AGENT_VERBOSE=1)")
    
    try:
        task_description = input("Enter the coding task: ")
        if not task_description: return

        cwd = os.getcwd()
        builder_session = None
        
        # Track all modified files across the entire session to give the Reviewer full context
        all_modified_files: Set[str] = set()

        # --- PHASE 1: TDD ---
        formatter.print_phase_header(
            "PHASE 1: CREATING VERIFICATION TEST",
            "Creating tests using Test-Driven Development approach"
        )
        logger.phase_start("PHASE_1_TDD", "Creating verification test")
        
        prompt_tdd = (
            f"read developer.md and act as the developer.\n"
            f"TASK: {task_description}\n"
            f"STEP 1: Create a verification script that tests the expected functionality.\n"
            f"Do NOT implement logic yet. Only create the test.\n"
            f"The test MUST fail currently."
        )
        
        test_result, builder_session = await run_agent(
            "BUILDER", prompt_tdd, schema=TestCreation, cwd=cwd,
            logger=logger, formatter=formatter
        )
        
        if not test_result:
            logger.phase_end("PHASE_1_TDD", success=False)
            return
        
        print(f"📝 Test Plan: {test_result.test_plan_summary}")
        
        phase_summary = {
            "test_file": test_result.test_file_name,
            "summary": test_result.test_plan_summary
        }
        logger.phase_end("PHASE_1_TDD", success=True, summary=phase_summary)
        formatter.print_phase_end("PHASE_1_TDD", success=True, 
                                  duration_ms=logger.phase_timings["PHASE_1_TDD"]["duration_ms"],
                                  summary=phase_summary)

        # --- PHASE 2: IMPLEMENTATION ---
        formatter.print_phase_header(
            "PHASE 2: IMPLEMENTATION",
            f"Implementing code to pass {test_result.test_file_name}"
        )
        logger.phase_start("PHASE_2_IMPLEMENTATION", "Implementing feature")
        
        impl_success = False
        for attempt in range(1, MAX_RETRIES + 1):
            print(f"\n🔄 Implementation Attempt {attempt}/{MAX_RETRIES}")
            
            prompt_impl = (
                f"STEP 2 (Attempt {attempt}):\n"
                f"1. Implement code to satisfy `{test_result.test_file_name}`.\n"
                f"2. Run the test file.\n"
                f"3. Output status in JSON."
            )
            
            impl_result, builder_session = await run_agent(
                "BUILDER", prompt_impl, schema=ImplementationResult, 
                session_id=builder_session, cwd=cwd,
                logger=logger, formatter=formatter
            )
            
            if impl_result:
                all_modified_files.update(impl_result.files_modified)
                logger.files_modified.update(impl_result.files_modified)
                
                # Log test result
                logger.log_test_result(
                    test_result.test_file_name,
                    impl_result.status.value,
                    impl_result.error_summary
                )
                formatter.print_test_result(
                    test_result.test_file_name,
                    impl_result.status.value,
                    impl_result.error_summary
                )
                
                if impl_result.status == TestStatus.PASS:
                    print(f"🎉 Tests Passed! Files: {impl_result.files_modified}")
                    impl_success = True
                    break
                else:
                    print(f"⚠️ Tests Failed: {impl_result.error_summary}")

        if not impl_success:
            print("❌ Failed to implement feature. Aborting.")
            logger.phase_end("PHASE_2_IMPLEMENTATION", success=False)
            formatter.print_phase_end("PHASE_2_IMPLEMENTATION", success=False,
                                      duration_ms=logger.phase_timings["PHASE_2_IMPLEMENTATION"]["duration_ms"])
            return
        
        phase_summary = {
            "attempts": attempt,
            "files_modified": len(all_modified_files)
        }
        logger.phase_end("PHASE_2_IMPLEMENTATION", success=True, summary=phase_summary)
        formatter.print_phase_end("PHASE_2_IMPLEMENTATION", success=True,
                                  duration_ms=logger.phase_timings["PHASE_2_IMPLEMENTATION"]["duration_ms"],
                                  summary=phase_summary)

        # --- PHASE 3: REVIEW LOOP ---
        formatter.print_phase_header(
            "PHASE 3: REVIEW & REFINEMENT LOOP",
            "Code review and iterative refinement"
        )
        logger.phase_start("PHASE_3_REVIEW", "Code review loop")
        
        review_approved = False
        review_history = []  # Store the conversation history explicitly
        
        for cycle in range(1, MAX_REVIEW_CYCLES + 1):
            print(f"\n🔎 Review Cycle {cycle}/{MAX_REVIEW_CYCLES}")
            
            # 1. CONSTRUCT CONTEXT AWARE PROMPT
            files_list_str = ", ".join(list(all_modified_files))
            
            # Progressive Leniency: Be stricter in early cycles, looser in later ones
            focus_instruction = "Focus on Logic, Security, and Style."
            if cycle > 3:
                focus_instruction = "Focus ONLY on CRITICAL Logic or Security bugs. Ignore style/naming preferences to ensure convergence."

            history_context = ""
            if review_history:
                history_context = "\nPREVIOUS REVIEW HISTORY:\n" + "\n".join(review_history)

            reviewer_prompt = (
                f"You are a Senior Software Engineer. You are reviewing a feature implementation.\n"
                f"Task: '{task_description}'.\n"
                f"Files modified: {files_list_str}\n"
                f"Test Status: {'PASS' if impl_success else 'FAIL'} (The builder has verified functionality via tests).\n\n"
                f"INSTRUCTIONS:\n"
                f"1. {focus_instruction}\n"
                f"2. Check if previous feedback (if any) was addressed.\n"
                f"3. If only MINOR issues remain and this is cycle > 2, prefer APPROVING.\n"
                f"{history_context}"
            )

            # We keep the reviewer session fresh to ensure it reads the *current* file state
            # but we inject the history via prompt.
            review_result, _ = await run_agent(
            "REVIEWER", reviewer_prompt, schema=CodeReview, cwd=cwd,
            logger=logger, formatter=formatter
            )

            if not review_result:
                print("⚠️ Reviewer failed to output JSON. Skipping cycle.")
                continue

            # 2. ANALYZE DECISION WITH SEVERITY
            # Filter out minor issues if we are in late cycles
            critical_issues = [c for c in review_result.critique if c.severity == Severity.CRITICAL]
            minor_issues = [c for c in review_result.critique if c.severity == Severity.MINOR]

            # Auto-override: If only minor issues exist and we are deep in cycles, force approve
            if review_result.decision == ReviewDecision.REQUEST_CHANGES:
                if cycle > 3 and not critical_issues:
                    print("⚠️ Overriding Reviewer: Only minor issues remaining in late cycle. Approving.")
                    review_result.decision = ReviewDecision.APPROVED
            
            # Log result
            logger.log_review(
                review_result.decision.value,
                [c.comment for c in review_result.critique], # Simplified for logger
                review_result.security_concerns
            )
            formatter.print_review_result(
                review_result.decision.value,
                [f"[{c.severity.value}] {c.comment}" for c in review_result.critique],
                review_result.security_concerns
            )

            if review_result.decision == ReviewDecision.APPROVED:
                print("\n✅ CODE REVIEW APPROVED!")
                review_approved = True
                break
            
            # 3. PREPARE FEEDBACK FOR BUILDER
            if cycle == MAX_REVIEW_CYCLES:
                print("❌ Max review cycles reached without approval.")
                break

            print("\n🔧 Builder applying fixes...")
            
            # Construct specific feedback list
            feedback_list = [f"{c.file_path}: {c.comment} ({c.severity.value})" for c in review_result.critique]
            
            # Add to history for the next reviewer to see
            review_history.append(f"Cycle {cycle} Feedback: {json.dumps(feedback_list)}")

            fix_prompt = (
                f"The Code Reviewer requested these changes:\n"
                f"{json.dumps(feedback_list)}\n\n"
                f"INSTRUCTIONS:\n"
                f"1. Fix the CRITICAL issues first.\n"
                f"2. Address MINOR issues if possible without breaking tests.\n"
                f"3. Run `{test_result.test_file_name}` to ensure NO regressions.\n"
                f"4. If tests fail, fix them before replying."
            )
            
            fix_result, builder_session = await run_agent(
                "BUILDER", fix_prompt, schema=ImplementationResult, 
                session_id=builder_session, cwd=cwd,
                logger=logger, formatter=formatter
            )

            if fix_result:
                all_modified_files.update(fix_result.files_modified)
                logger.files_modified.update(fix_result.files_modified)
                
                # Log successful fix attempt to history
                review_history.append(f"Cycle {cycle} Fixes: Builder updated {fix_result.files_modified}")
            
            # Log test result
            logger.log_test_result(
                test_result.test_file_name,
                fix_result.status.value,
                fix_result.error_summary
            )
            formatter.print_test_result(
                test_result.test_file_name,
                fix_result.status.value,
                fix_result.error_summary
            )
            
            if fix_result.status == TestStatus.FAIL:
                print(f"⚠️ Warning: Builder's fixes caused tests to fail: {fix_result.error_summary}")
            else:
                print("✅ Fixes applied & tests passed. Sending back to reviewer...")
        
        phase_summary = {
            "cycles": cycle,
            "approved": review_approved
        }
        logger.phase_end("PHASE_3_REVIEW", success=review_approved, summary=phase_summary)
        formatter.print_phase_end("PHASE_3_REVIEW", success=review_approved,
                              duration_ms=logger.phase_timings["PHASE_3_REVIEW"]["duration_ms"],
                              summary=phase_summary)

        # --- FINALIZATION ---
        if review_approved:
            formatter.print_phase_header("FINALIZATION", "Updating documentation")
            logger.phase_start("PHASE_4_FINALIZATION", "Documentation and cleanup")
            
            final_prompt = "Update documentation and create a learning session file."
            await run_agent(
                "BUILDER", final_prompt,
                session_id=builder_session, cwd=cwd,
                logger=logger, formatter=formatter
            )
            
            logger.phase_end("PHASE_4_FINALIZATION", success=True)
            formatter.print_phase_end("PHASE_4_FINALIZATION", success=True,
                                      duration_ms=logger.phase_timings["PHASE_4_FINALIZATION"]["duration_ms"])
            print("\n🏁 Workflow Complete!")
        else:
            print("\n⛔ Workflow ended without final approval.")
    
    except Exception as e:
        # Log any unexpected errors
        print(f"\n💥 Unexpected error occurred: {type(e).__name__}: {e}")
        if logger:
            logger.log_error(e, {"context": "main workflow"})
        raise
    
    finally:
        # ALWAYS generate and print session summary, even on errors
        if logger and formatter:
            try:
                summary = logger.generate_summary()
                summary['log_file'] = str(logger.log_file)
                summary['summary_file'] = str(logger.summary_file)
                formatter.print_summary(summary)
            except Exception as summary_error:
                print(f"\n⚠️ Failed to generate summary: {summary_error}")
                # At minimum, print basic info
                print(f"Log file: {logger.log_file if logger else 'N/A'}")
                print(f"Summary file: {logger.summary_file if logger else 'N/A'}")

if __name__ == '__main__':
    asyncio.run(main())