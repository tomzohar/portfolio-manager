import sys
import shutil
import subprocess
import importlib.util
import os

def check_step(name, status, message=""):
    symbol = "✅" if status else "❌"
    print(f"{symbol} {name}: {message}")
    return status

def validate_environment():
    print("--- 🔍 Validating Cursor Agent Environment ---")
    all_good = True

    # 1. Check Python Version
    py_ver = sys.version_info
    is_valid_py = py_ver.major == 3 and py_ver.minor >= 8
    check_step("Python Version", is_valid_py, f"Found {py_ver.major}.{py_ver.minor} (Requires 3.8+)")
    if not is_valid_py: all_good = False

    # 2. Check Virtual Environment
    in_venv = sys.prefix != sys.base_prefix
    check_step("Virtual Environment", in_venv, "Active" if in_venv else "Warning: Running in global scope (not recommended)")
    
    # 3. Check Cursor Agent CLI
    # We check for 'cursor-agent' command availability
    agent_path = shutil.which("cursor-agent")
    if not agent_path:
        # Fallback check for Windows users who might reference the JS file directly
        agent_path = shutil.which("cursor-agent.cmd") or shutil.which("cursor-agent.exe")
    
    has_cli = agent_path is not None
    check_step("Cursor Agent CLI", has_cli, f"Found at: {agent_path}" if has_cli else "Command 'cursor-agent' not found in PATH")
    if not has_cli: all_good = False

    # 4. Check Node.js (Required for CLI)
    node_path = shutil.which("node")
    has_node = node_path is not None
    check_step("Node.js Runtime", has_node, "Installed" if has_node else "Not found (Required for cursor-agent)")
    if not has_node: all_good = False

    # 5. Check SDK Installation
    # We try to import the module installed via 'pip install -e .'
    try:
        import cursor_agent_sdk
        sdk_loc = os.path.dirname(cursor_agent_sdk.__file__)
        check_step("SDK Installation", True, f"Imported successfully from {sdk_loc}")
    except ImportError:
        check_step("SDK Installation", False, "Module 'cursor_agent_sdk' not found. Did you run 'pip install -e .' inside the sdk folder?")
        all_good = False

    print("-" * 40)
    if all_good:
        print("🚀 READY! You can run your orchestration scripts.")
    else:
        print("⚠️  ISSUES FOUND. Please fix the items marked with ❌.")

if __name__ == "__main__":
    validate_environment()