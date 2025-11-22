# Test Suite Documentation

## Overview

This test suite provides comprehensive coverage for the Stock Researcher application, including the autonomous Portfolio Manager Agent (V3) with multi-agent architecture. All tests use mocking to avoid making real API calls, ensuring fast, reliable, and cost-free testing during development.

## Test Structure

```
tests/
├── __init__.py                           # Package initialization
├── conftest.py                           # Shared pytest fixtures
│
├── analysis/                             # Analysis module tests
│   ├── test_risk_calculator.py          # Risk metrics calculations (26 tests)
│   └── test_technical_analyzer.py       # Technical analysis functions (23 tests)
│
├── integrations/                         # External API integration tests
│   ├── test_fred.py                     # FRED API integration (9 tests)
│   └── test_polygon.py                  # Polygon.io integration (12 tests)
│
├── tools/                                # Portfolio Manager tools tests
│   ├── test_analyze_news.py            # News analysis tool (11 tests)
│   ├── test_analyze_technicals.py      # Technical analysis tool (10 tests)
│   ├── test_assess_confidence.py       # Confidence assessment (12 tests)
│   └── test_parse_portfolio.py         # Portfolio parsing tool (9 tests)
│
├── test_macro_agent.py                  # Macro Agent node tests (16 tests)
├── test_fundamental_agent.py            # Fundamental Agent node tests (16 tests)
├── test_technical_agent.py              # Technical Agent node tests (15 tests)
├── test_risk_agent.py                   # Risk Agent node tests (22 tests)
├── test_portfolio_manager_graph.py      # Graph workflow tests
├── test_agent_state.py                  # State management tests
├── test_schemas.py                      # Pydantic schema validation tests
├── test_tool_registry.py                # Tool registry system tests
│
└── Legacy (stock_researcher) tests:
    ├── test_portfolio_parser.py         # Portfolio parsing (7 tests)
    ├── test_news_searcher.py            # News search agent (4 tests)
    ├── test_llm_analyzer.py             # LLM summarization (4 tests)
    ├── test_orchestrator.py             # Workflow orchestration (4 tests)
    └── test_pushover.py                 # Pushover notifications (4 tests)
```


## Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_macro_agent.py

# Run specific test class
pytest tests/test_risk_agent.py::TestRiskAgentNode

# Run specific test method
pytest tests/test_macro_agent.py::TestMacroAgentNode::test_inflationary_regime_detection

# Run tests matching pattern
pytest -k "agent"

# Run analysis module tests
pytest tests/analysis/

# Run integration tests
pytest tests/integrations/

# Run with short traceback
pytest --tb=short

# Run with line-level traceback
pytest --tb=line

# Run and stop at first failure
pytest -x
```

## Mocking Strategy

Following best practices from the user rules and `CODING_AGENT_PROMPT.md`, we **prefer spying on external libraries** instead of mocking when appropriate:

### External APIs (Always Mocked)
- **FRED API**: Mocked `fredapi.Fred` and helper functions
- **Polygon.io API**: Mocked `polygon.RESTClient` and all API calls
- **Google Gemini LLM**: Mocked `call_gemini_api` utility function
- **Google Sheets API**: Mocked `gspread.authorize` and `Credentials.from_service_account_file`
- **SerpAPI**: Mocked `GoogleSearch` class
- **Pushover**: Mocked `http.client.HTTPSConnection`

### Internal Modules (Spy When Appropriate)
- **Pandas operations**: Spy on operations to verify behavior
- **Risk calculations**: Spy on calculation functions to verify logic
- **Technical analysis**: Spy on helper functions for validation

### Mocking Patterns Used

1. **pytest-mock (mocker fixture)** - 97 instances
   ```python
   def test_example(mocker):
       mocker.patch('module.function', return_value=expected_value)
   ```

2. **unittest.mock (@patch decorator)** - 126 instances
   ```python
   @patch('module.ExternalService')
   def test_example(mock_service):
       mock_service.return_value = expected_value
   ```

## Test Statistics

- **Total Tests**: 345
- **Pass Rate**: 100%
- **Execution Time**: ~36 seconds (full suite)

## Benefits

1. **No API Costs**: All external calls are mocked, so no charges incurred
2. **Fast Execution**: All 345 tests run in ~36 seconds
3. **Reliable**: Tests don't depend on external service availability
4. **Safe**: No production side effects (no notifications sent)
5. **Comprehensive**: Covers happy paths, error cases, and edge cases
6. **Maintainable**: Clear separation between unit and integration tests

## Adding New Tests

When adding new functionality:

1. **Choose appropriate test location**:
   - Node tests: `tests/test_*_agent.py`
   - Analysis modules: `tests/analysis/test_*.py`
   - Integrations: `tests/integrations/test_*.py`
   - Tools: `tests/tools/test_*.py`

2. **Use existing fixtures** from `conftest.py`:
   - `sample_portfolio_data()` - Mock Google Sheets data
   - `sample_news_results()` - Mock SerpAPI responses
   - `sample_llm_response()` - Mock LLM outputs
   - `mock_portfolio()` - Portfolio object
   - `initial_state()` - Agent state dictionary

3. **Mock external dependencies** following the existing pattern:
   - Always mock API calls (FRED, Polygon, LLM)
   - Spy on internal functions when appropriate
   - Use `mocker` fixture or `@patch` decorator

4. **Ensure tests are fast** and don't make real API calls

5. **Test both success and error cases**:
   - Happy path
   - Error handling
   - Edge cases (empty data, missing fields, etc.)

6. **Follow naming conventions**:
   - Test files: `test_<module_name>.py`
   - Test classes: `Test<ClassName>`
   - Test functions: `test_<descriptive_name>`

### Example: Unit Test with mocker

```python
def test_macro_agent_success(initial_state, mocker):
    """Test Macro Agent successfully analyzes market regime."""
    # Mock FRED data
    mock_fred_data = {
        "available": True,
        "cpi_yoy": 3.2,
        "gdp_growth": 2.5,
        "yield_spread": 0.8,
        "vix": 16.5,
        "unemployment": 3.8,
        "date": "2024-11-22"
    }
    
    mocker.patch(
        'src.portfolio_manager.graph.nodes.macro_agent._fetch_macro_indicators',
        return_value=mock_fred_data
    )
    
    # Mock LLM response
    mock_llm = '{"status": "Goldilocks", "signal": "Risk-On", "key_driver": "Moderate growth + low inflation", "confidence": 0.9}'
    mocker.patch(
        'src.portfolio_manager.graph.nodes.macro_agent.call_gemini_api',
        return_value=mock_llm
    )
    
    # Execute
    result = macro_agent_node(initial_state)
    
    # Verify
    assert result["macro_analysis"]["status"] == "Goldilocks"
    assert result["macro_analysis"]["signal"] == "Risk-On"
    assert result["macro_analysis"]["confidence"] == 0.9
```

### Example: Unit Test with @patch decorator

```python
from unittest.mock import patch, MagicMock

@patch('src.portfolio_manager.integrations.polygon.RESTClient')
def test_fetch_ohlcv_success(mock_client):
    """Test successful OHLCV data fetching."""
    # Setup mock
    mock_agg = MagicMock()
    mock_agg.open = 100.0
    mock_agg.high = 105.0
    mock_agg.low = 98.0
    mock_agg.close = 102.0
    mock_agg.volume = 1000000
    mock_agg.timestamp = 1700000000000
    
    mock_client.return_value.get_aggs.return_value = [mock_agg]
    
    # Execute
    result = fetch_ohlcv_data("AAPL", timespan="day", limit=30)
    
    # Verify
    assert not result.empty
    assert len(result) == 1
    assert result.iloc[0]["close"] == 102.0
    mock_client.return_value.get_aggs.assert_called_once()
```

## Testing Best Practices

1. **Test Isolation**: Each test should be independent and not rely on other tests
2. **Clear Assertions**: Use descriptive assertion messages
3. **Minimal Mocking**: Mock only what's necessary for the test
4. **Fixture Reuse**: Use shared fixtures from `conftest.py` when appropriate
5. **Descriptive Names**: Test names should clearly indicate what they're testing
6. **Edge Cases**: Always test edge cases and error conditions
7. **No Network Calls**: All external APIs must be mocked (per `CODING_AGENT_PROMPT.md`)

