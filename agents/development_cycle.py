import sys
import os
import asyncio
import re

# --- CONFIGURATION ---
SDK_PATH = r'/Users/tomzohar/projects/stocks-researcher/cursor-agent-sdk-python/src' # UPDATE THIS
MAX_RETRIES = 3

if SDK_PATH not in sys.path:
    sys.path.insert(0, SDK_PATH)

try:
    from cursor_agent_sdk import query, CursorAgentOptions, AssistantMessage, TextBlock, ResultMessage
except ImportError:
    print(f"Error: Could not import cursor_agent_sdk from {SDK_PATH}")
    sys.exit(1)

# --- AGENT WRAPPER ---

async def run_agent(agent_name: str, prompt: str, session_id: str = None, cwd: str = None) -> tuple[str, str]:
    """
    Runs an agent step. 
    Returns: (full_response_text, new_session_id)
    """
    print(f"\n🔹 [{agent_name}] processing..." + (f" (Resuming Session: ...{session_id[-6:]})" if session_id else ""))
    
    options = CursorAgentOptions(
        cwd=cwd or os.getcwd(),
        permission_mode="acceptEdits", # Auto-approve everything
        resume=session_id
    )

    full_response = []
    final_session_id = session_id

    try:
        async for msg in query(prompt=prompt, options=options):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        text = block.text
                        full_response.append(text)
                        # Optional: Print real-time output loosely
                        # print(text, end='', flush=True) 
            elif isinstance(msg, ResultMessage):
                final_session_id = msg.session_id
    
    except Exception as e:
        print(f"❌ Error in {agent_name}: {e}")
        return "", session_id

    result_text = "".join(full_response)
    print(f"✅ [{agent_name}] Done.")
    return result_text, final_session_id

# --- WORKFLOW FUNCTIONS ---

async def main():
    print("🚀 STARTING AGENT DEVELOPMENT CYCLE (TDD + Review)")
    
    # 1. Get Task
    task_description = input("Enter the coding task (e.g., 'Create a fibonacci.py function'): ")
    if not task_description: return

    cwd = os.getcwd()
    builder_session = None

    # --- PHASE 1: TDD (Create the Test) ---
    print("\n--- 🧪 PHASE 1: CREATING VERIFICATION TEST ---")
    prompt_tdd = (
        f"read developer.md and act as the developer.\n"
        f"TASK: {task_description}\n\n"
        f"STEP 1: Create a verification script (e.g., `test_feature.spec.ts`) that tests the expected functionality.\n"
        f"Do NOT implement the actual logic yet. Only create the test file.\n"
        f"The test MUST fail currently (Red phase).\n"
        f"Output the name of the test file created at the end."
    )
    
    response, builder_session = await run_agent("BUILDER", prompt_tdd, cwd=cwd)
    
    # Simple regex to find the test file name (assuming agent mentions it)
    # We ask the agent to verify the filename in the next step to be safe.
    
    # --- PHASE 2: IMPLEMENTATION LOOP ---
    print("\n--- 🔨 PHASE 2: IMPLEMENTATION & FIXING ---")
    
    success = False
    for attempt in range(1, MAX_RETRIES + 1):
        print(f"\n🔄 Attempt {attempt}/{MAX_RETRIES}")
        
        prompt_impl = (
            f"STEP 2 (Attempt {attempt}):\n"
            f"1. Implement the feature code to satisfy the test.\n"
            f"2. Run the test file you created\n"
            f"3. If it fails, analyze the error, fix the code, and run it again.\n"
            f"4. FINAL REQUIREMENT: End your response with exactly 'STATUS: PASS' if tests pass, or 'STATUS: FAIL' if they still fail."
        )
        
        response, builder_session = await run_agent("BUILDER", prompt_impl, session_id=builder_session, cwd=cwd)
        
        if "STATUS: PASS" in response:
            print("🎉 Tests Passed!")
            success = True
            break
        else:
            print("⚠️ Tests Failed. Retrying...")

    if not success:
        print("❌ Failed to implement feature after max retries. Aborting.")
        return

    # --- PHASE 3: CODE REVIEW ---
    print("\n--- 🕵️ PHASE 3: CODE REVIEW ---")
    
    # We need to know WHAT file to review. We ask the Builder one last time to list the file paths.
    # For simplicity in this script, we ask the Reviewer to "find the recent files".
    
    reviewer_prompt = (
        f"You are a Senior Code Reviewer.\n"
        f"The user just implemented a feature: '{task_description}'.\n"
        f"Identify the new implementation files in the current directory.\n"
        f"Review the code for:\n"
        f"1. Logic bugs\n"
        f"2. Security issues\n"
        f"3. Code style/cleanliness\n\n"
        f"If the code is good, reply exactly: 'REVIEW_DECISION: APPROVED'\n"
        f"If changes are needed, list them and reply: 'REVIEW_DECISION: REQUEST_CHANGES'"
    )

    # Note: No session_id passed here -> Fresh Agent!
    review_response, _ = await run_agent("REVIEWER", reviewer_prompt, cwd=cwd)

    if "REVIEW_DECISION: APPROVED" in review_response:
        print("\n✅ CODE REVIEW PASSED! Feature is ready.")
        final_prompt = f"update documentation and create a file called <feature_name>_session_learning.md and write your learning from this session there."
        await run_agent("BUILDER", final_prompt, session_id=builder_session, cwd=cwd)
    else:
        print("\n📝 REVIEWER REQUESTED CHANGES.")
        print("Refining code based on feedback...")
        
        # --- PHASE 4: REFINEMENT ---
        refine_prompt = (
            f"The Code Reviewer provided this feedback:\n"
            f"{review_response}\n\n"
            f"TASK: Apply these fixes to the code.\n"
            f"IMPORTANT: After fixing, RUN THE TESTS AGAIN to ensure no regressions.\n"
            f"End response with 'STATUS: FIXED'."
        )
        
        await run_agent("BUILDER", refine_prompt, session_id=builder_session, cwd=cwd)
        print("\n✅ Refinement Complete.")

if __name__ == '__main__':
    asyncio.run(main())