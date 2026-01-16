"""
Logging utilities for agent development cycle.

Provides structured logging with dual output (console + file) and support
for verbose mode via environment variables.
"""

import os
import json
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Dict, List
from enum import Enum


class LogLevel(str, Enum):
    """Log severity levels."""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


def ms_to_seconds(ms: int) -> int:
    """
    Convert milliseconds to seconds.
    
    Args:
        ms: Duration in milliseconds
        
    Returns:
        Duration in seconds (rounded down)
    """
    return ms // 1000


class AgentLogger:
    """
    Centralized logger for agent workflow.
    
    Features:
    - Dual output: console + JSON file
    - Verbosity control via AGENT_VERBOSE env var
    - Structured log entries for programmatic analysis
    - Session tracking and summaries
    """
    
    def __init__(self, session_name: str = None):
        """
        Initialize logger.
        
        Args:
            session_name: Optional name for this session (default: timestamp)
        """
        self.verbose = os.getenv("AGENT_VERBOSE", "0") == "1"
        self.log_dir = Path(os.getenv("AGENT_LOG_DIR", "./agent-sessions"))
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Session identification
        self.session_name = session_name or datetime.now().strftime("%Y%m%d_%H%M%S")
        self.start_time = datetime.now()
        
        # Log file setup
        self.log_file = self.log_dir / f"run_{self.session_name}.log"
        self.summary_file = self.log_dir / f"summary_{self.session_name}.json"
        
        # Session tracking
        self.events: List[Dict[str, Any]] = []
        self.phase_timings: Dict[str, Dict[str, Any]] = {}
        self.agent_calls: List[Dict[str, Any]] = []
        self.agent_sessions: Dict[str, str] = {}  # Track session ID per agent
        self.files_modified: set = set()
        self.errors: List[Dict[str, Any]] = []
        
        self._log_event("SESSION_START", {"session": self.session_name})
    
    def _log_event(self, event_type: str, data: Dict[str, Any], level: LogLevel = LogLevel.INFO):
        """
        Record a structured event to the log file.
        
        Args:
            event_type: Type of event (e.g., AGENT_START, TOOL_CALL)
            data: Event-specific data
            level: Log level
        """
        event = {
            "timestamp": datetime.now().isoformat(),
            "elapsed_ms": int((datetime.now() - self.start_time).total_seconds() * 1000),
            "level": level.value,
            "event_type": event_type,
            "data": data
        }
        
        self.events.append(event)
        
        # Write to file immediately for crash recovery
        with open(self.log_file, "a") as f:
            f.write(json.dumps(event) + "\n")
    
    def phase_start(self, phase_name: str, description: str = None):
        """Mark the start of a major phase."""
        # Only log to file, formatter handles console output
        self.phase_timings[phase_name] = {
            "start": datetime.now(),
            "description": description
        }
        
        self._log_event("PHASE_START", {
            "phase": phase_name,
            "description": description
        })
    
    def phase_end(self, phase_name: str, success: bool = True, summary: Dict[str, Any] = None):
        """Mark the end of a phase."""
        if phase_name not in self.phase_timings:
            return
        
        duration_ms = int((datetime.now() - self.phase_timings[phase_name]["start"]).total_seconds() * 1000)
        self.phase_timings[phase_name]["duration_ms"] = duration_ms
        self.phase_timings[phase_name]["success"] = success
        
        # Only log to file, formatter handles console output
        self._log_event("PHASE_END", {
            "phase": phase_name,
            "duration_ms": duration_ms,
            "success": success,
            "summary": summary or {}
        })
    
    def agent_start(self, agent_name: str, prompt: str, session_id: Optional[str] = None):
        """Log the start of an agent invocation."""
        # Track session ID for this agent
        if session_id:
            self.agent_sessions[agent_name] = session_id
        
        # Only log to file, formatter handles console output
        call_record = {
            "agent": agent_name,
            "start": datetime.now(),
            "session_id": session_id,
            "prompt": prompt
        }
        self.agent_calls.append(call_record)
        
        self._log_event("AGENT_START", {
            "agent": agent_name,
            "session_id": session_id,
            "prompt_length": len(prompt)
        })
    
    def agent_end(self, agent_name: str, success: bool = True, output_length: int = 0):
        """Log the completion of an agent invocation."""
        # Find the most recent call for this agent
        for call in reversed(self.agent_calls):
            if call["agent"] == agent_name and "duration_ms" not in call:
                duration_ms = int((datetime.now() - call["start"]).total_seconds() * 1000)
                call["duration_ms"] = duration_ms
                call["success"] = success
                call["output_length"] = output_length
                
                # Only log to file, formatter handles console output
                self._log_event("AGENT_END", {
                    "agent": agent_name,
                    "duration_ms": duration_ms,
                    "success": success,
                    "output_length": output_length
                })
                break
    
    def stream_agent_response(self, agent_name: str, text: str):
        """
        Stream agent response text to console.
        
        Args:
            agent_name: Name of the agent
            text: Text chunk to display
        """
        if self.verbose:
            # Indent agent output for clarity
            for line in text.split('\n'):
                if line.strip():
                    print(f"  │ {line}")
        
        # Always log to file
        self._log_event("AGENT_OUTPUT", {
            "agent": agent_name,
            "text": text
        }, level=LogLevel.DEBUG)
    
    def log_tool_call(self, agent_name: str, tool_name: str, tool_input: Dict[str, Any]):
        """
        Log a tool call made by an agent.
        
        Args:
            agent_name: Name of the agent making the call
            tool_name: Name of the tool being called
            tool_input: Tool input parameters
        """
        # Only log to file, formatter handles console output
        
        # Track file modifications
        if tool_name in ["edit_file", "write_file", "search_replace"]:
            if "file_path" in tool_input:
                self.files_modified.add(tool_input["file_path"])
            elif "target_file" in tool_input:
                self.files_modified.add(tool_input["target_file"])
        
        self._log_event("TOOL_CALL", {
            "agent": agent_name,
            "tool": tool_name,
            "input": tool_input
        })
    
    def log_error(self, error: Exception, context: Dict[str, Any] = None, agent_response_tail: str = None):
        """
        Log an error with full context.
        
        Args:
            error: The exception that occurred
            context: Additional context about the error
            agent_response_tail: Last N characters of agent response before error
        """
        error_data = {
            "type": type(error).__name__,
            "message": str(error),
            "traceback": traceback.format_exc(),
            "context": context or {},
            "agent_response_tail": agent_response_tail
        }
        
        self.errors.append(error_data)
        
        # Only log to file, formatter handles console output
        self._log_event("ERROR", error_data, level=LogLevel.ERROR)
    
    def log_test_result(self, test_name: str, status: str, error_summary: Optional[str] = None):
        """Log test execution results."""
        # Only log to file, formatter handles console output
        self._log_event("TEST_RESULT", {
            "test": test_name,
            "status": status,
            "error_summary": error_summary
        })
    
    def log_review(self, decision: str, critique: List[str], security_concerns: bool):
        """Log code review results."""
        # Only log to file, formatter handles console output
        self._log_event("CODE_REVIEW", {
            "decision": decision,
            "critique": critique,
            "security_concerns": security_concerns
        })
    
    def generate_summary(self) -> Dict[str, Any]:
        """
        Generate session summary.
        
        Returns:
            Summary dictionary
        """
        total_duration_ms = int((datetime.now() - self.start_time).total_seconds() * 1000)
        
        summary = {
            "session_name": self.session_name,
            "start_time": self.start_time.isoformat(),
            "end_time": datetime.now().isoformat(),
            "total_duration_ms": total_duration_ms,
            "agent_sessions": self.agent_sessions,  # Track which session ID each agent used
            "phases": {
                name: {
                    "duration_ms": data.get("duration_ms", 0),
                    "success": data.get("success", False)
                }
                for name, data in self.phase_timings.items()
            },
            "agent_calls": [
                {
                    "agent": call["agent"],
                    "duration_ms": call.get("duration_ms", 0),
                    "success": call.get("success", False),
                    "session_id": call.get("session_id")
                }
                for call in self.agent_calls
            ],
            "files_modified": sorted(list(self.files_modified)),
            "error_count": len(self.errors),
            "errors": [
                {
                    "type": err["type"],
                    "message": err["message"]
                }
                for err in self.errors
            ]
        }
        
        # Save to file
        with open(self.summary_file, "w") as f:
            f.write(json.dumps(summary, indent=2))
        
        return summary
    
    def print_summary(self):
        """Print a formatted summary to console."""
        summary = self.generate_summary()
        
        print("\n" + "="*60)
        print("  SESSION SUMMARY")
        print("="*60)
        total_duration_s = ms_to_seconds(summary['total_duration_ms'])
        print(f"Duration: {total_duration_s}s")
        print(f"Files Modified: {len(summary['files_modified'])}")
        
        if summary['files_modified']:
            for file in summary['files_modified'][:10]:  # Show first 10
                print(f"  - {file}")
            if len(summary['files_modified']) > 10:
                print(f"  ... and {len(summary['files_modified']) - 10} more")
        
        print(f"\nAgent Calls: {len(summary['agent_calls'])}")
        
        if summary['agent_sessions']:
            print("\nAgent Sessions:")
            for agent, session_id in summary['agent_sessions'].items():
                print(f"  - {agent}: ...{session_id[-8:]}")
        
        print(f"\nErrors: {summary['error_count']}")
        
        if summary['errors']:
            print("\nErrors encountered:")
            for err in summary['errors']:
                print(f"  - {err['type']}: {err['message']}")
        
        print(f"\nLog file: {self.log_file}")
        print(f"Summary file: {self.summary_file}")
        print("="*60 + "\n")
