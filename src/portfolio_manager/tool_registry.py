"""
Tool Registry and Decorator System

This module provides a decorator-based tool registration system that automatically:
1. Registers tools in a central registry
2. Validates tool signatures
3. Generates tool descriptions for LLM prompts
4. Provides tool introspection capabilities

Adding a new tool is as simple as:
    @tool(name="my_tool", description="Does something useful")
    def my_tool_function(param: str) -> ToolResult:
        ...
"""

from typing import Dict, Any, Callable, List, Optional, get_type_hints
from dataclasses import dataclass, field
from inspect import signature, Parameter
import logging

from .agent_state import ToolResult, AgentState

logger = logging.getLogger(__name__)


@dataclass
class ToolMetadata:
    """Metadata for a registered tool"""
    name: str
    description: str
    function: Callable
    parameters: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    examples: List[str] = field(default_factory=list)
    state_aware: bool = False
    
    def get_prompt_description(self) -> str:
        """
        Generate a formatted description for the LLM prompt.
        
        Returns:
            Formatted string describing the tool, its parameters, and usage
        """
        lines = [f"**{self.name}**"]
        lines.append(f"  Description: {self.description}")
        
        if self.parameters:
            lines.append("  Parameters:")
            for param_name, param_info in self.parameters.items():
                param_type = param_info.get('type', 'any')
                param_desc = param_info.get('description', 'No description')
                required = param_info.get('required', True)
                req_str = "(required)" if required else "(optional)"
                lines.append(f"    - {param_name} ({param_type}) {req_str}: {param_desc}")
        else:
            lines.append("  Parameters: None")
        
        if self.examples:
            lines.append("  Examples:")
            for example in self.examples:
                lines.append(f"    {example}")
        
        return "\n".join(lines)
    
    def to_langchain_tool_schema(self) -> Dict[str, Any]:
        """
        Convert to LangChain tool schema format.
        Useful for future integrations.
        """
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }


class ToolRegistry:
    """
    Central registry for all agent tools.
    Supports automatic registration via decorator and dynamic tool discovery.
    """
    
    def __init__(self):
        self._tools: Dict[str, ToolMetadata] = {}
    
    def register_tool(self, metadata: ToolMetadata):
        """Registers a tool using a ToolMetadata object."""
        if metadata.name in self._tools:
            logger.warning(f"Tool '{metadata.name}' is being re-registered (overwriting previous)")
        self._tools[metadata.name] = metadata
        logger.debug(f"Registered tool: {metadata.name}")

    def register(   
        self,
        name: str,
        description: str,
        parameters: Optional[Dict[str, Dict[str, Any]]] = None,
        examples: Optional[List[str]] = None,
        state_aware: bool = False,
    ) -> Callable:
        """
        Decorator for registering a tool.
        
        Args:
            name: Unique tool name (used in agent decisions)
            description: Human-readable description of what the tool does
            parameters: Dict describing each parameter (type, description, required)
            examples: List of example invocations
            state_aware: If True, the state will be passed to the tool
        
        Returns:
            Decorator function
        """
        def decorator(func: Callable) -> Callable:
            # Extract parameter info from function signature if not provided
            if parameters is None:
                extracted_params = self._extract_parameters(func, state_aware)
            else:
                extracted_params = parameters
            
            # Create and register metadata
            metadata = ToolMetadata(
                name=name,
                description=description,
                function=func,
                parameters=extracted_params,
                examples=examples or [],
                state_aware=state_aware
            )
            
            self.register_tool(metadata)
            
            return func
        
        return decorator
    
    def _extract_parameters(self, func: Callable, state_aware: bool) -> Dict[str, Dict[str, Any]]:
        """
        Extract parameter information from function signature using type hints.
        """
        params = {}
        sig = signature(func)
        type_hints = get_type_hints(func)
        
        for i, (param_name, param) in enumerate(sig.parameters.items()):
            # Skip the first argument if the tool is state-aware
            if state_aware and i == 0:
                continue

            param_type = type_hints.get(param_name, Any)
            param_info = {
                "type": str(param_type).replace("typing.", ""),
                "description": "Auto-extracted parameter",
                "required": param.default == Parameter.empty
            }
            params[param_name] = param_info
        
        return params
    
    def get_tool(self, name: str) -> Optional[ToolMetadata]:
        """Get tool metadata by name"""
        return self._tools.get(name)
    
    def get_tool_function(self, name: str) -> Optional[Callable]:
        """Get the actual tool function by name"""
        metadata = self.get_tool(name)
        return metadata.function if metadata else None
    
    def list_tools(self) -> List[str]:
        """Get list of all registered tool names"""
        return list(self._tools.keys())
    
    def get_all_metadata(self) -> Dict[str, ToolMetadata]:
        """Get all tool metadata"""
        return self._tools.copy()
    
    def execute_tool(self, name: str, state: Optional[AgentState] = None, **kwargs) -> ToolResult:
        """
        Execute a tool by name with given arguments.
        
        Args:
            name: Tool name
            **kwargs: Arguments to pass to the tool
        
        Returns:
            ToolResult from the tool execution
        """
        metadata = self.get_tool(name)
        
        if not metadata:
            logger.error(f"Unknown tool requested: {name}")
            return ToolResult(
                success=False,
                data=None,
                error=f"Unknown tool: {name}. Available tools: {', '.join(self.list_tools())}",
                confidence_impact=0.0,
            )
        
        try:
            logger.info(f"Executing tool: {name} with args: {kwargs}")
            
            # If the tool is state-aware, pass the state as the first argument
            if metadata.state_aware:
                if state is None:
                    raise ValueError(f"Tool '{name}' is state-aware but no state was provided.")
                return metadata.function(state, **kwargs)
            else:
                return metadata.function(**kwargs)
        except TypeError as e:
            logger.error(f"Tool {name} called with invalid arguments: {e}")
            return ToolResult(
                success=False,
                data=None,
                error=f"Invalid arguments for {name}: {str(e)}",
                confidence_impact=0.0,
            )
        except Exception as e:
            logger.error(f"Tool {name} execution failed: {e}", exc_info=True)
            return ToolResult(
                success=False,
                data=None,
                error=f"Tool execution failed: {str(e)}",
                confidence_impact=-0.1,
            )
    
    def generate_prompt_section(self) -> str:
        """
        Generate the tools section for the agent's system prompt.
        
        Returns:
            Formatted string listing all available tools with descriptions
        """
        lines = ["Available Tools:"]
        lines.append("")
        
        for i, (name, metadata) in enumerate(self._tools.items(), 1):
            lines.append(f"{i}. {metadata.get_prompt_description()}")
            lines.append("")
        
        return "\n".join(lines)
    
    def validate_tool_call(self, tool_name: str, args: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Validate a tool call before execution.
        
        Args:
            tool_name: Name of the tool to call
            args: Arguments for the tool
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        metadata = self.get_tool(tool_name)
        
        if not metadata:
            return False, f"Tool '{tool_name}' not found"
        
        # Check required parameters
        for param_name, param_info in metadata.parameters.items():
            if param_info.get("required", True) and param_name not in args:
                return False, f"Missing required parameter: {param_name}"
        
        return True, None


# Global registry instance
_global_registry = ToolRegistry()


def tool(
    name: str,
    description: str,
    parameters: Optional[Dict[str, Dict[str, Any]]] = None,
    examples: Optional[List[str]] = None,
    state_aware: bool = False
) -> Callable:
    """
    Convenience decorator using the global registry.
    
    Example:
        @tool(
            name="my_tool",
            description="Does something",
            parameters={"param1": {"type": "str", "description": "A parameter"}}
        )
        def my_tool(param1: str) -> ToolResult:
            ...
    """
    return _global_registry.register(
        name=name,
        description=description,
        parameters=parameters,
        examples=examples,
        state_aware=state_aware
    )


def get_registry() -> ToolRegistry:
    """Get the global tool registry"""
    return _global_registry


def execute_tool(name: str, state: Optional[AgentState] = None, **kwargs) -> ToolResult:
    """Execute a tool from the global registry"""
    return _global_registry.execute_tool(name, state=state, **kwargs)


def list_tools() -> List[str]:
    """List all registered tools"""
    return _global_registry.list_tools()


def generate_tools_prompt() -> str:
    """Generate the tools section for the agent prompt"""
    return _global_registry.generate_prompt_section()

