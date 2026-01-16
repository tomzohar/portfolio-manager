"""
Console formatting utilities using Rich library.

Provides colored, structured output for the agent development cycle.
"""

from typing import Optional
from rich.console import Console
from rich.theme import Theme
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.syntax import Syntax
from rich.text import Text


# Custom theme for agent output
AGENT_THEME = Theme({
    "builder": "bold blue",
    "reviewer": "bold yellow",
    "phase": "bold green",
    "error": "bold red",
    "warning": "bold orange3",
    "success": "bold green",
    "info": "cyan",
    "tool": "magenta",
    "dim": "dim",
})


class RichFormatter:
    """
    Rich-based console formatter for enhanced agent output.
    
    Provides:
    - Color-coded output by agent and message type
    - Progress spinners
    - Structured panels
    - Syntax highlighting for code
    """
    
    def __init__(self, verbose: bool = False):
        """
        Initialize formatter.
        
        Args:
            verbose: Whether to show detailed output
        """
        self.console = Console(theme=AGENT_THEME)
        self.verbose = verbose
        self._current_progress: Optional[Progress] = None
    
    def print_phase_header(self, phase_name: str, description: Optional[str] = None):
        """
        Print a phase header with visual separation.
        
        Args:
            phase_name: Name of the phase
            description: Optional description
        """
        content = f"[phase]{phase_name}[/phase]"
        if description:
            content += f"\n[dim]{description}[/dim]"
        
        self.console.print()
        self.console.print(Panel(content, border_style="green", expand=False))
        self.console.print()
    
    def print_phase_end(self, phase_name: str, success: bool, duration_s: int, summary: Optional[dict] = None):
        """
        Print phase completion summary.
        
        Args:
            phase_name: Name of the phase
            success: Whether phase succeeded
            duration_s: Duration in seconds
            summary: Optional summary data
        """
        status_style = "success" if success else "error"
        status_icon = "✅" if success else "❌"
        
        text = Text()
        text.append(f"{status_icon} Phase '", style=status_style)
        text.append(phase_name, style="bold")
        text.append(f"' completed in {duration_s}s", style=status_style)
        
        self.console.print(text)
        
        if summary:
            for key, value in summary.items():
                self.console.print(f"   [dim]-[/dim] {key}: {value}")
        
        self.console.print()
    
    def print_agent_start(self, agent_name: str, session_id: Optional[str] = None):
        """
        Print agent start message.
        
        Args:
            agent_name: Name of the agent
            session_id: Optional session ID
        """
        agent_style = self._get_agent_style(agent_name)
        session_info = f" [dim](Session: ...{session_id[-6:]})[/dim]" if session_id else " [dim](Fresh Context)[/dim]"
        
        self.console.print(f"\n🔹 [{agent_style}]{agent_name}[/{agent_style}] Starting...{session_info}")
    
    def print_agent_end(self, agent_name: str, success: bool, duration_s: int, output_length: int):
        """
        Print agent completion message.
        
        Args:
            agent_name: Name of the agent
            success: Whether agent succeeded
            duration_s: Duration in seconds
            output_length: Length of output in characters
        """
        agent_style = self._get_agent_style(agent_name)
        status_icon = "✅" if success else "❌"
        
        self.console.print(
            f"{status_icon} [{agent_style}]{agent_name}[/{agent_style}] "
            f"Completed in {duration_s}s ({output_length:,} chars)"
        )
    
    def stream_agent_output(self, agent_name: str, text: str):
        """
        Stream agent output with indentation and coloring.
        
        Args:
            agent_name: Name of the agent
            text: Text to display
        """
        agent_style = self._get_agent_style(agent_name)
        
        if self.verbose:
            # Show full agent output with visual separator
            for line in text.split('\n'):
                if line.strip():
                    self.console.print(f"  [dim]│[/dim] {line}")
        # In normal mode, don't show text chunks to keep output clean
        # (tool calls and results provide enough visibility)
    
    def print_tool_call(self, agent_name: str, tool_name: str, tool_input: Optional[dict] = None):
        """
        Print a tool call message.
        
        Args:
            agent_name: Name of the agent making the call
            tool_name: Name of the tool
            tool_input: Optional tool input parameters
        """
        # Skip if tool name is empty or invalid
        if not tool_name or not str(tool_name).strip() or str(tool_name).lower() in ['none', 'null', '']:
            return
        
        agent_style = self._get_agent_style(agent_name)
        self.console.print(f"  🔧 [{agent_style}]{agent_name}[/{agent_style}] Tool: [tool]{tool_name}[/tool]")
        
        if self.verbose and tool_input:
            for key, value in tool_input.items():
                # Skip empty values
                if value is None or value == "":
                    continue
                # Smart truncation for file paths
                value_str = str(value)
                if len(value_str) > 80:
                    # For file paths, show beginning and end
                    if '/' in value_str or '\\' in value_str:
                        # It's likely a path - show start and end
                        parts = value_str.split('/')
                        if len(parts) > 3:
                            # Show first part and last 2 parts
                            value_str = f"{parts[0]}/.../{'/'.join(parts[-2:])}"
                        else:
                            value_str = value_str[:77] + "..."
                    else:
                        value_str = value_str[:77] + "..."
                self.console.print(f"     [dim]-[/dim] {key}: [info]{value_str}[/info]")
    
    def print_error(self, error: Exception, context: Optional[dict] = None):
        """
        Print an error with context.
        
        Args:
            error: The exception
            context: Optional context dictionary
        """
        self.console.print(f"\n[error]❌ ERROR: {type(error).__name__}[/error]")
        self.console.print(f"[error]{error}[/error]")
        
        if context:
            self.console.print("\n[warning]Context:[/warning]")
            for key, value in context.items():
                self.console.print(f"  [dim]-[/dim] {key}: {value}")
    
    def print_test_result(self, test_name: str, status: str, error_summary: Optional[str] = None):
        """
        Print test execution result.
        
        Args:
            test_name: Name of the test
            status: Test status (PASS/FAIL)
            error_summary: Optional error summary
        """
        status_icon = "✅" if status == "PASS" else "❌"
        status_style = "success" if status == "PASS" else "error"
        
        self.console.print(f"{status_icon} Test: [bold]{test_name}[/bold] - [{status_style}]{status}[/{status_style}]")
        
        if error_summary:
            self.console.print(f"   [error]Error: {error_summary}[/error]")
    
    def print_review_result(self, decision: str, critique: list, security_concerns: bool):
        """
        Print code review results.
        
        Args:
            decision: Review decision (APPROVED/REQUEST_CHANGES)
            critique: List of critique items
            security_concerns: Whether security concerns exist
        """
        decision_icon = "✅" if decision == "APPROVED" else "📝"
        decision_style = "success" if decision == "APPROVED" else "warning"
        
        self.console.print(f"\n{decision_icon} Code Review: [{decision_style}]{decision}[/{decision_style}]")
        
        if critique:
            self.console.print("\n[info]Feedback:[/info]")
            for item in critique:
                self.console.print(f"  [dim]-[/dim] {item}")
        
        if security_concerns:
            self.console.print("\n[error]⚠️  Security concerns raised![/error]")
    
    def print_code_block(self, code: str, language: str = "python"):
        """
        Print syntax-highlighted code.
        
        Args:
            code: Code to display
            language: Programming language for syntax highlighting
        """
        if self.verbose:
            syntax = Syntax(code, language, theme="monokai", line_numbers=True)
            self.console.print(syntax)
    
    def print_summary(self, summary: dict):
        """
        Print session summary.
        
        Args:
            summary: Summary dictionary
        """
        self.console.print()
        self.console.print(Panel("[phase]SESSION SUMMARY[/phase]", border_style="green"))
        
        from logging_utils import ms_to_seconds
        total_duration_s = ms_to_seconds(summary['total_duration_ms'])
        self.console.print(f"[info]Duration:[/info] {total_duration_s}s")
        self.console.print(f"[info]Files Modified:[/info] {len(summary['files_modified'])}")
        
        if summary['files_modified']:
            for file in summary['files_modified'][:10]:
                self.console.print(f"  [dim]-[/dim] {file}")
            if len(summary['files_modified']) > 10:
                self.console.print(f"  [dim]... and {len(summary['files_modified']) - 10} more[/dim]")
        
        self.console.print(f"\n[info]Agent Calls:[/info] {len(summary['agent_calls'])}")
        
        if summary.get('agent_sessions'):
            self.console.print("\n[info]Agent Sessions:[/info]")
            for agent, session_id in summary['agent_sessions'].items():
                self.console.print(f"  [dim]-[/dim] {agent}: [dim]...{session_id[-8:]}[/dim]")
        
        self.console.print(f"\n[info]Errors:[/info] {summary['error_count']}")
        
        if summary['errors']:
            self.console.print("\n[error]Errors encountered:[/error]")
            for err in summary['errors']:
                self.console.print(f"  [dim]-[/dim] [error]{err['type']}:[/error] {err['message']}")
        
        self.console.print(f"\n[dim]Log file:[/dim] {summary.get('log_file', 'N/A')}")
        self.console.print(f"[dim]Summary file:[/dim] {summary.get('summary_file', 'N/A')}")
        self.console.print()
    
    def start_progress(self, description: str) -> Progress:
        """
        Start a progress spinner.
        
        Args:
            description: Description of the task
            
        Returns:
            Progress object (should be used with context manager)
        """
        progress = Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TimeElapsedColumn(),
            console=self.console
        )
        
        self._current_progress = progress
        return progress
    
    def _get_agent_style(self, agent_name: str) -> str:
        """
        Get the Rich style for an agent name.
        
        Args:
            agent_name: Name of the agent
            
        Returns:
            Style name
        """
        agent_lower = agent_name.lower()
        
        if "builder" in agent_lower or "developer" in agent_lower:
            return "builder"
        elif "reviewer" in agent_lower or "review" in agent_lower:
            return "reviewer"
        else:
            return "info"
