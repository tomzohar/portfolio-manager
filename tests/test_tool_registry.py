"""
Comprehensive tests for the tool registry system.

Tests cover:
- ToolMetadata class and methods
- ToolRegistry class and all its methods
- @tool decorator functionality
- Parameter extraction and validation
- Tool execution and error handling
- Prompt generation
- Registry singleton behavior
"""

import pytest
from typing import List, Optional
from unittest.mock import Mock, patch
import logging

from src.portfolio_manager.tool_registry import (
    ToolMetadata,
    ToolRegistry,
    tool,
    get_registry,
    execute_tool,
    list_tools,
    generate_tools_prompt,
    _global_registry,
)
from src.portfolio_manager.agent_state import ToolResult


class TestToolMetadata:
    """Tests for ToolMetadata dataclass"""
    
    def test_tool_metadata_creation(self):
        """Test creating basic ToolMetadata"""
        def dummy_func():
            pass
        
        metadata = ToolMetadata(
            name="test_tool",
            description="A test tool",
            function=dummy_func,
        )
        
        assert metadata.name == "test_tool"
        assert metadata.description == "A test tool"
        assert metadata.function == dummy_func
        assert metadata.parameters == {}
        assert metadata.examples == []
    
    def test_tool_metadata_with_parameters(self):
        """Test ToolMetadata with parameters"""
        def dummy_func(param1: str, param2: int):
            pass
        
        parameters = {
            "param1": {
                "type": "str",
                "description": "First parameter",
                "required": True
            },
            "param2": {
                "type": "int",
                "description": "Second parameter",
                "required": False
            }
        }
        
        metadata = ToolMetadata(
            name="test_tool",
            description="A test tool",
            function=dummy_func,
            parameters=parameters,
        )
        
        assert len(metadata.parameters) == 2
        assert "param1" in metadata.parameters
        assert metadata.parameters["param1"]["required"] is True
        assert metadata.parameters["param2"]["required"] is False
    
    def test_get_prompt_description_basic(self):
        """Test generating prompt description without parameters"""
        def dummy_func():
            pass
        
        metadata = ToolMetadata(
            name="simple_tool",
            description="Does something simple",
            function=dummy_func,
        )
        
        prompt = metadata.get_prompt_description()
        
        assert "**simple_tool**" in prompt
        assert "Does something simple" in prompt
        assert "Parameters: None" in prompt
    
    def test_get_prompt_description_with_parameters(self):
        """Test generating prompt description with parameters"""
        def dummy_func(ticker: str, limit: int = 10):
            pass
        
        parameters = {
            "ticker": {
                "type": "str",
                "description": "Stock ticker symbol",
                "required": True
            },
            "limit": {
                "type": "int",
                "description": "Number of results",
                "required": False
            }
        }
        
        metadata = ToolMetadata(
            name="fetch_data",
            description="Fetches stock data",
            function=dummy_func,
            parameters=parameters,
        )
        
        prompt = metadata.get_prompt_description()
        
        assert "**fetch_data**" in prompt
        assert "Fetches stock data" in prompt
        assert "ticker (str) (required): Stock ticker symbol" in prompt
        assert "limit (int) (optional): Number of results" in prompt
    
    def test_get_prompt_description_with_examples(self):
        """Test generating prompt description with examples"""
        def dummy_func():
            pass
        
        metadata = ToolMetadata(
            name="example_tool",
            description="Tool with examples",
            function=dummy_func,
            examples=[
                'execute_tool("example_tool")',
                'example_tool()'
            ]
        )
        
        prompt = metadata.get_prompt_description()
        
        assert "Examples:" in prompt
        assert 'execute_tool("example_tool")' in prompt
        assert 'example_tool()' in prompt
    
    def test_to_langchain_tool_schema(self):
        """Test conversion to LangChain tool schema"""
        def dummy_func(param1: str):
            pass
        
        parameters = {
            "param1": {
                "type": "str",
                "description": "A parameter",
                "required": True
            }
        }
        
        metadata = ToolMetadata(
            name="langchain_tool",
            description="For LangChain",
            function=dummy_func,
            parameters=parameters,
        )
        
        schema = metadata.to_langchain_tool_schema()
        
        assert schema["name"] == "langchain_tool"
        assert schema["description"] == "For LangChain"
        assert schema["parameters"] == parameters


class TestToolRegistry:
    """Tests for ToolRegistry class"""
    
    def test_registry_initialization(self):
        """Test creating a new registry"""
        registry = ToolRegistry()
        
        assert registry.list_tools() == []
        assert registry.get_all_metadata() == {}
    
    def test_register_tool_basic(self):
        """Test registering a basic tool"""
        registry = ToolRegistry()
        
        @registry.register(
            name="test_tool",
            description="A test tool"
        )
        def test_tool_func() -> ToolResult:
            return ToolResult(success=True, data="OK", error=None, confidence_impact=0.0)
        
        assert "test_tool" in registry.list_tools()
        metadata = registry.get_tool("test_tool")
        assert metadata is not None
        assert metadata.name == "test_tool"
        assert metadata.description == "A test tool"
    
    def test_register_tool_with_parameters(self):
        """Test registering a tool with explicit parameters"""
        registry = ToolRegistry()
        
        parameters = {
            "ticker": {
                "type": "str",
                "description": "Stock ticker",
                "required": True
            }
        }
        
        @registry.register(
            name="fetch_tool",
            description="Fetches data",
            parameters=parameters
        )
        def fetch_tool_func(ticker: str) -> ToolResult:
            return ToolResult(success=True, data=ticker, error=None, confidence_impact=0.0)
        
        metadata = registry.get_tool("fetch_tool")
        assert metadata.parameters == parameters
    
    def test_register_tool_auto_extract_parameters(self):
        """Test automatic parameter extraction from function signature"""
        registry = ToolRegistry()
        
        @registry.register(
            name="auto_params",
            description="Auto parameter extraction"
        )
        def auto_params_func(ticker: str, limit: int = 10) -> ToolResult:
            return ToolResult(success=True, data=None, error=None, confidence_impact=0.0)
        
        metadata = registry.get_tool("auto_params")
        assert "ticker" in metadata.parameters
        assert "limit" in metadata.parameters
        assert metadata.parameters["ticker"]["required"] is True
        assert metadata.parameters["limit"]["required"] is False
    
    def test_register_duplicate_tool_warning(self, caplog):
        """Test that re-registering a tool logs a warning"""
        registry = ToolRegistry()
        
        @registry.register(name="dup_tool", description="First")
        def tool1():
            pass
        
        with caplog.at_level(logging.WARNING):
            @registry.register(name="dup_tool", description="Second")
            def tool2():
                pass
        
        assert "re-registered" in caplog.text.lower() or "overwriting" in caplog.text.lower()
    
    def test_get_tool(self):
        """Test getting tool metadata"""
        registry = ToolRegistry()
        
        @registry.register(name="my_tool", description="My tool")
        def my_tool_func():
            pass
        
        metadata = registry.get_tool("my_tool")
        assert metadata is not None
        assert metadata.name == "my_tool"
        
        # Test non-existent tool
        assert registry.get_tool("nonexistent") is None
    
    def test_get_tool_function(self):
        """Test getting the actual tool function"""
        registry = ToolRegistry()
        
        def original_func():
            return "result"
        
        @registry.register(name="func_tool", description="Function tool")
        def func_tool():
            return "result"
        
        retrieved_func = registry.get_tool_function("func_tool")
        assert retrieved_func is not None
        assert callable(retrieved_func)
        assert retrieved_func() == "result"
        
        # Test non-existent tool
        assert registry.get_tool_function("nonexistent") is None
    
    def test_list_tools(self):
        """Test listing all registered tools"""
        registry = ToolRegistry()
        
        @registry.register(name="tool1", description="Tool 1")
        def tool1():
            pass
        
        @registry.register(name="tool2", description="Tool 2")
        def tool2():
            pass
        
        @registry.register(name="tool3", description="Tool 3")
        def tool3():
            pass
        
        tools = registry.list_tools()
        assert len(tools) == 3
        assert "tool1" in tools
        assert "tool2" in tools
        assert "tool3" in tools
    
    def test_get_all_metadata(self):
        """Test getting all tool metadata"""
        registry = ToolRegistry()
        
        @registry.register(name="tool_a", description="Tool A")
        def tool_a():
            pass
        
        @registry.register(name="tool_b", description="Tool B")
        def tool_b():
            pass
        
        all_metadata = registry.get_all_metadata()
        assert len(all_metadata) == 2
        assert "tool_a" in all_metadata
        assert "tool_b" in all_metadata
        assert isinstance(all_metadata["tool_a"], ToolMetadata)
    
    def test_execute_tool_success(self):
        """Test successful tool execution"""
        registry = ToolRegistry()
        
        @registry.register(name="add_tool", description="Adds numbers")
        def add_tool(a: int, b: int) -> ToolResult:
            return ToolResult(
                success=True,
                data={"result": a + b},
                error=None,
                confidence_impact=0.1
            )
        
        result = registry.execute_tool("add_tool", a=5, b=3)
        
        assert result.success is True
        assert result.data["result"] == 8
        assert result.confidence_impact == 0.1
    
    def test_execute_tool_unknown(self):
        """Test executing an unknown tool"""
        registry = ToolRegistry()
        
        result = registry.execute_tool("nonexistent_tool")
        
        assert result.success is False
        assert "Unknown tool" in result.error
        assert result.confidence_impact == 0.0
    
    def test_execute_tool_invalid_arguments(self):
        """Test executing a tool with invalid arguments"""
        registry = ToolRegistry()
        
        @registry.register(name="req_param", description="Requires params")
        def req_param(required_arg: str) -> ToolResult:
            return ToolResult(success=True, data=None, error=None, confidence_impact=0.0)
        
        # Missing required argument
        result = registry.execute_tool("req_param")
        
        assert result.success is False
        assert "Invalid arguments" in result.error
    
    def test_execute_tool_exception_handling(self):
        """Test that tool execution errors are caught"""
        registry = ToolRegistry()
        
        @registry.register(name="error_tool", description="Raises error")
        def error_tool() -> ToolResult:
            raise ValueError("Something went wrong")
        
        result = registry.execute_tool("error_tool")
        
        assert result.success is False
        assert "Tool execution failed" in result.error
        assert result.confidence_impact == -0.1
    
    def test_generate_prompt_section(self):
        """Test generating the tools prompt section"""
        registry = ToolRegistry()
        
        @registry.register(name="tool1", description="First tool")
        def tool1():
            pass
        
        @registry.register(name="tool2", description="Second tool")
        def tool2():
            pass
        
        prompt = registry.generate_prompt_section()
        
        assert "Available Tools:" in prompt
        assert "**tool1**" in prompt
        assert "First tool" in prompt
        assert "**tool2**" in prompt
        assert "Second tool" in prompt
    
    def test_validate_tool_call_success(self):
        """Test validating a correct tool call"""
        registry = ToolRegistry()
        
        parameters = {
            "required_param": {
                "type": "str",
                "description": "Required",
                "required": True
            },
            "optional_param": {
                "type": "int",
                "description": "Optional",
                "required": False
            }
        }
        
        @registry.register(name="val_tool", description="Validation tool", parameters=parameters)
        def val_tool(required_param: str, optional_param: int = 10):
            pass
        
        # Valid call with required param
        is_valid, error = registry.validate_tool_call("val_tool", {"required_param": "value"})
        assert is_valid is True
        assert error is None
        
        # Valid call with all params
        is_valid, error = registry.validate_tool_call(
            "val_tool",
            {"required_param": "value", "optional_param": 5}
        )
        assert is_valid is True
        assert error is None
    
    def test_validate_tool_call_missing_required(self):
        """Test validating a tool call with missing required parameter"""
        registry = ToolRegistry()
        
        parameters = {
            "required_param": {
                "type": "str",
                "description": "Required",
                "required": True
            }
        }
        
        @registry.register(name="val_tool", description="Validation tool", parameters=parameters)
        def val_tool(required_param: str):
            pass
        
        is_valid, error = registry.validate_tool_call("val_tool", {})
        
        assert is_valid is False
        assert "Missing required parameter" in error
        assert "required_param" in error
    
    def test_validate_tool_call_unknown_tool(self):
        """Test validating a call to an unknown tool"""
        registry = ToolRegistry()
        
        is_valid, error = registry.validate_tool_call("unknown_tool", {})
        
        assert is_valid is False
        assert "not found" in error


class TestToolDecorator:
    """Tests for the @tool decorator"""
    
    def test_tool_decorator_basic(self):
        """Test using @tool decorator with global registry"""
        # Clear existing tools to avoid conflicts
        _global_registry._tools.clear()
        
        @tool(name="decorated_tool", description="A decorated tool")
        def decorated_tool() -> ToolResult:
            return ToolResult(success=True, data="decorated", error=None, confidence_impact=0.0)
        
        assert "decorated_tool" in list_tools()
        
        result = execute_tool("decorated_tool")
        assert result.success is True
        assert result.data == "decorated"
    
    def test_tool_decorator_with_parameters(self):
        """Test @tool decorator with explicit parameters"""
        _global_registry._tools.clear()
        
        @tool(
            name="param_tool",
            description="Tool with params",
            parameters={
                "user_name": {
                    "type": "str",
                    "description": "User name parameter",
                    "required": True
                }
            }
        )
        def param_tool(user_name: str) -> ToolResult:
            return ToolResult(success=True, data=f"Hello {user_name}", error=None, confidence_impact=0.0)
        
        metadata = get_registry().get_tool("param_tool")
        assert "user_name" in metadata.parameters
        
        result = execute_tool("param_tool", user_name="World")
        assert result.success is True
        assert result.data == "Hello World"
    
    def test_tool_decorator_with_examples(self):
        """Test @tool decorator with examples"""
        _global_registry._tools.clear()
        
        @tool(
            name="example_tool",
            description="Tool with examples",
            examples=["example_tool()", "execute_tool('example_tool')"]
        )
        def example_tool() -> ToolResult:
            return ToolResult(success=True, data=None, error=None, confidence_impact=0.0)
        
        metadata = get_registry().get_tool("example_tool")
        assert len(metadata.examples) == 2
        assert "example_tool()" in metadata.examples


class TestGlobalFunctions:
    """Tests for global convenience functions"""
    
    def test_get_registry(self):
        """Test getting the global registry"""
        registry = get_registry()
        
        assert isinstance(registry, ToolRegistry)
        assert registry is _global_registry
    
    def test_list_tools_global(self):
        """Test global list_tools function"""
        _global_registry._tools.clear()
        
        @tool(name="global_tool1", description="Global 1")
        def global_tool1():
            pass
        
        @tool(name="global_tool2", description="Global 2")
        def global_tool2():
            pass
        
        tools = list_tools()
        assert "global_tool1" in tools
        assert "global_tool2" in tools
    
    def test_execute_tool_global(self):
        """Test global execute_tool function"""
        _global_registry._tools.clear()
        
        @tool(name="exec_tool", description="Execution tool")
        def exec_tool(value: int) -> ToolResult:
            return ToolResult(success=True, data=value * 2, error=None, confidence_impact=0.0)
        
        result = execute_tool("exec_tool", value=5)
        
        assert result.success is True
        assert result.data == 10
    
    def test_generate_tools_prompt_global(self):
        """Test global generate_tools_prompt function"""
        _global_registry._tools.clear()
        
        @tool(name="prompt_tool", description="For prompt generation")
        def prompt_tool():
            pass
        
        prompt = generate_tools_prompt()
        
        assert "Available Tools:" in prompt
        assert "**prompt_tool**" in prompt
        assert "For prompt generation" in prompt


class TestParameterExtraction:
    """Tests for automatic parameter extraction"""
    
    def test_extract_simple_types(self):
        """Test extracting simple type hints"""
        registry = ToolRegistry()
        
        @registry.register(name="simple_types", description="Simple types")
        def simple_types(s: str, i: int, f: float, b: bool):
            pass
        
        metadata = registry.get_tool("simple_types")
        params = metadata.parameters
        
        assert "s" in params
        assert "i" in params
        assert "f" in params
        assert "b" in params
    
    def test_extract_list_types(self):
        """Test extracting List type hints"""
        registry = ToolRegistry()
        
        @registry.register(name="list_types", description="List types")
        def list_types(strings: List[str], numbers: List[int]):
            pass
        
        metadata = registry.get_tool("list_types")
        params = metadata.parameters
        
        assert "strings" in params
        assert "numbers" in params
        assert "List" in params["strings"]["type"]
    
    def test_extract_optional_parameters(self):
        """Test extracting optional parameters with defaults"""
        registry = ToolRegistry()
        
        @registry.register(name="optional_params", description="Optional params")
        def optional_params(required: str, optional: int = 10, opt_str: str = "default"):
            pass
        
        metadata = registry.get_tool("optional_params")
        params = metadata.parameters
        
        assert params["required"]["required"] is True
        assert params["optional"]["required"] is False
        assert params["opt_str"]["required"] is False
    
    def test_extract_optional_type_hint(self):
        """Test extracting Optional type hints"""
        registry = ToolRegistry()
        
        @registry.register(name="opt_type", description="Optional type")
        def opt_type(value: Optional[str] = None):
            pass
        
        metadata = registry.get_tool("opt_type")
        params = metadata.parameters
        
        assert "value" in params
        # Should recognize as optional due to default value
        assert params["value"]["required"] is False


class TestEdgeCases:
    """Tests for edge cases and error conditions"""
    
    def test_empty_registry(self):
        """Test operations on empty registry"""
        registry = ToolRegistry()
        
        assert registry.list_tools() == []
        assert registry.get_tool("anything") is None
        assert registry.get_tool_function("anything") is None
        
        prompt = registry.generate_prompt_section()
        assert "Available Tools:" in prompt
    
    def test_tool_with_no_parameters(self):
        """Test tool with no parameters"""
        registry = ToolRegistry()
        
        @registry.register(name="no_params", description="No parameters")
        def no_params() -> ToolResult:
            return ToolResult(success=True, data="OK", error=None, confidence_impact=0.0)
        
        metadata = registry.get_tool("no_params")
        assert metadata.parameters == {}
        
        result = registry.execute_tool("no_params")
        assert result.success is True
    
    def test_tool_with_kwargs(self):
        """Test tool that accepts **kwargs"""
        registry = ToolRegistry()
        
        @registry.register(name="kwargs_tool", description="Accepts kwargs")
        def kwargs_tool(**kwargs) -> ToolResult:
            return ToolResult(success=True, data=kwargs, error=None, confidence_impact=0.0)
        
        result = registry.execute_tool("kwargs_tool", a=1, b=2, c=3)
        assert result.success is True
        assert result.data == {"a": 1, "b": 2, "c": 3}
    
    def test_tool_without_return_type_hint(self):
        """Test tool without return type annotation"""
        registry = ToolRegistry()
        
        @registry.register(name="no_return_type", description="No return type")
        def no_return_type():
            return ToolResult(success=True, data="OK", error=None, confidence_impact=0.0)
        
        # Should still work
        result = registry.execute_tool("no_return_type")
        assert result.success is True
    
    def test_registry_isolation(self):
        """Test that separate registry instances are independent"""
        registry1 = ToolRegistry()
        registry2 = ToolRegistry()
        
        @registry1.register(name="tool1", description="Tool 1")
        def tool1():
            pass
        
        @registry2.register(name="tool2", description="Tool 2")
        def tool2():
            pass
        
        assert "tool1" in registry1.list_tools()
        assert "tool1" not in registry2.list_tools()
        assert "tool2" in registry2.list_tools()
        assert "tool2" not in registry1.list_tools()


class TestLogging:
    """Tests for logging behavior"""
    
    def test_tool_registration_logging(self, caplog):
        """Test that tool registration logs debug message"""
        registry = ToolRegistry()
        
        with caplog.at_level(logging.DEBUG):
            @registry.register(name="log_tool", description="Logged")
            def log_tool():
                pass
        
        assert "Registered tool: log_tool" in caplog.text
    
    def test_tool_execution_logging(self, caplog):
        """Test that tool execution logs info message"""
        registry = ToolRegistry()
        
        @registry.register(name="exec_log", description="Execution logging")
        def exec_log(param: str) -> ToolResult:
            return ToolResult(success=True, data=None, error=None, confidence_impact=0.0)
        
        with caplog.at_level(logging.INFO):
            registry.execute_tool("exec_log", param="test")
        
        assert "Executing tool: exec_log" in caplog.text
    
    def test_unknown_tool_logging(self, caplog):
        """Test that unknown tool logs error"""
        registry = ToolRegistry()
        
        with caplog.at_level(logging.ERROR):
            registry.execute_tool("unknown")
        
        assert "Unknown tool requested" in caplog.text
    
    def test_tool_error_logging(self, caplog):
        """Test that tool execution errors are logged"""
        registry = ToolRegistry()
        
        @registry.register(name="error_log", description="Error logging")
        def error_log() -> ToolResult:
            raise RuntimeError("Test error")
        
        with caplog.at_level(logging.ERROR):
            registry.execute_tool("error_log")
        
        assert "Tool error_log execution failed" in caplog.text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

