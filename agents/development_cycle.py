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
MAX_RETRIES = 3
MAX_REVIEW_CYCLES = 3  # Maximum number of Review -> Fix loops

if SDK_PATH not in sys.path:
    sys.path.insert(0, SDK_PATH)

try:
    from cursor_agent_sdk import query, CursorAgentOptions, AssistantMessage, TextBlock, ResultMessage
except ImportError:
    print(f"Error: Could not import cursor_agent_sdk from {SDK_PATH}")
    sys.exit(1)

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

class CodeReview(BaseModel):
    decision: ReviewDecision
    critique: List[str] = Field(description="List of specific issues found that need fixing")
    security_concerns: bool = Field(description="True if potential security issues were found")

# --- UTILITIES ---

T = TypeVar("T", bound=BaseModel)

def extract_json(response_text: str, model: Type[T]) -> T:
    """Robustly extracts JSON from LLM text."""
    json_match = re.search(r"```(?:json)?(.*?)```", response_text, re.DOTALL)
    if json_match:
        json_str = json_match.group(1).strip()
    else:
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
        raise

# --- AGENT WRAPPER ---

async def run_agent(agent_name: str, prompt: str, schema: Optional[Type[T]] = None, session_id: str = None, cwd: str = None) -> tuple[Optional[T], str]:
    print(f"\n🔹 [{agent_name}] processing..." + (f" (Session: ...{session_id[-6:]})" if session_id else " (Fresh Context)"))
    
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

    try:
        async for msg in query(prompt=prompt, options=options):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        full_response.append(block.text)
            elif isinstance(msg, ResultMessage):
                final_session_id = msg.session_id
    
    except Exception as e:
        print(f"❌ Error in {agent_name}: {e}")
        return None, session_id

    result_text = "".join(full_response)
    print(f"✅ [{agent_name}] Done.")
    
    parsed_result = None
    if schema:
        try:
            parsed_result = extract_json(result_text, schema)
        except ValueError:
            print(f"❌ Failed to parse output from {agent_name}")

    return parsed_result, final_session_id

# --- WORKFLOW FUNCTIONS ---

async def main():
    print("🚀 STARTING AGENT DEVELOPMENT CYCLE (Structured + Loop)")
    
    task_description = input("Enter the coding task: ")
    if not task_description: return

    cwd = os.getcwd()
    builder_session = None
    
    # Track all modified files across the entire session to give the Reviewer full context
    all_modified_files: Set[str] = set()

    # --- PHASE 1: TDD ---
    print("\n--- 🧪 PHASE 1: CREATING VERIFICATION TEST ---")
    prompt_tdd = (
        f"read developer.md and act as the developer.\n"
        f"TASK: {task_description}\n"
        f"STEP 1: Create a verification script that tests the expected functionality.\n"
        f"Do NOT implement logic yet. Only create the test.\n"
        f"The test MUST fail currently."
    )
    
    test_result, builder_session = await run_agent(
        "BUILDER", prompt_tdd, schema=TestCreation, cwd=cwd
    )
    
    if not test_result: return
    print(f"📝 Test Plan: {test_result.test_plan_summary}")

    # --- PHASE 2: IMPLEMENTATION ---
    print("\n--- 🔨 PHASE 2: IMPLEMENTATION ---")
    
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
            "BUILDER", prompt_impl, schema=ImplementationResult, session_id=builder_session, cwd=cwd
        )
        
        if impl_result:
            all_modified_files.update(impl_result.files_modified) # Track files
            
            if impl_result.status == TestStatus.PASS:
                print(f"🎉 Tests Passed! Files: {impl_result.files_modified}")
                impl_success = True
                break
            else:
                print(f"⚠️ Tests Failed: {impl_result.error_summary}")

    if not impl_success:
        print("❌ Failed to implement feature. Aborting.")
        return

    # --- PHASE 3: REVIEW LOOP ---
    print("\n--- 🔄 PHASE 3: REVIEW & REFINEMENT LOOP ---")
    
    review_approved = False
    
    for cycle in range(1, MAX_REVIEW_CYCLES + 1):
        print(f"\n🔎 Review Cycle {cycle}/{MAX_REVIEW_CYCLES}")
        
        # 1. REVIEWER (Always Fresh Session)
        files_list_str = ", ".join(list(all_modified_files))
        reviewer_prompt = (
            f"You are a Senior Software Engineer.\n"
            f"Task: '{task_description}'.\n"
            f"Files modified so far: {files_list_str}\n"
            f"Review for logic, security, and style.\n"
        )

        review_result, _ = await run_agent(
            "REVIEWER", reviewer_prompt, schema=CodeReview, cwd=cwd
        )

        if not review_result:
            print("⚠️ Reviewer failed to output JSON. Skipping cycle.")
            continue

        if review_result.decision == ReviewDecision.APPROVED:
            print("\n✅ CODE REVIEW APPROVED!")
            review_approved = True
            break
        
        # 2. HANDLE FEEDBACK
        print("\n📝 Reviewer Requested Changes:")
        for item in review_result.critique:
            print(f" - {item}")
        
        if cycle == MAX_REVIEW_CYCLES:
            print("❌ Max review cycles reached without approval.")
            break

        print("\n🔧 Builder applying fixes...")
        
        fix_prompt = (
            f"The Code Reviewer requested these changes:\n"
            f"{json.dumps(review_result.critique)}\n"
            f"1. Fix these issues.\n"
            f"2. Run `{test_result.test_file_name}` to ensure NO regressions.\n"
            f"3. If tests fail, fix them before replying."
        )
        
        fix_result, builder_session = await run_agent(
            "BUILDER", fix_prompt, schema=ImplementationResult, session_id=builder_session, cwd=cwd
        )

        if fix_result:
            all_modified_files.update(fix_result.files_modified) # Add any new files touched during fix
            if fix_result.status == TestStatus.FAIL:
                print(f"⚠️ Warning: Builder's fixes caused tests to fail: {fix_result.error_summary}")
                # We continue the loop, hoping the next review catches it or the builder fixes it next time.
            else:
                print("✅ Fixes applied & tests passed. Sending back to reviewer...")

    # --- FINALIZATION ---
    if review_approved:
        print("\n🏁 Workflow Complete. Updating Documentation...")
        final_prompt = "Update documentation and create a learning session file."
        await run_agent("BUILDER", final_prompt, session_id=builder_session, cwd=cwd)
    else:
        print("\n⛔ Workflow ended without final approval.")

if __name__ == '__main__':
    asyncio.run(main())