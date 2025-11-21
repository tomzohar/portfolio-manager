import pytest
from unittest.mock import patch, MagicMock
from src.portfolio_manager.agent_state import create_initial_state

# Since we are testing the main entry point, we need to import it carefully
# We will patch 'run_autonomous_analysis' to avoid running the full graph
import run_portfolio_manager


@pytest.fixture
def mock_sys_exit():
    """Fixture to mock sys.exit to prevent test runner from exiting."""
    with patch("sys.exit") as mock_exit:
        yield mock_exit


class TestPortfolioManagerEntryPoint:
    """Test suite for the main entry point in run_portfolio_manager.py."""

    @patch("sys.argv", ["run_portfolio_manager.py"])
    @patch("run_portfolio_manager.update_gsheet_prices")
    @patch("run_portfolio_manager.run_autonomous_analysis")
    @patch("run_portfolio_manager.send_pushover_message")
    def test_run_exits_0_on_success(self, mock_pushover, mock_run_analysis, mock_update_prices, mock_sys_exit):
        """
        Tests that the main function exits with status 0 on a successful run.
        """
        # Arrange: Mock a successful final state
        successful_state = create_initial_state()
        successful_state["final_report"] = "This is a successful report."
        successful_state["errors"] = []
        mock_run_analysis.return_value = successful_state

        # Act
        run_portfolio_manager.main()

        # Assert
        mock_sys_exit.assert_called_once_with(0)
        mock_pushover.assert_called_once()

    @patch("sys.argv", ["run_portfolio_manager.py"])
    @patch("run_portfolio_manager.update_gsheet_prices")
    @patch("run_portfolio_manager.run_autonomous_analysis")
    @patch("run_portfolio_manager.send_pushover_message")
    @patch("run_portfolio_manager.capture_message")
    def test_run_exits_1_on_workflow_errors(self, mock_capture_message, mock_pushover, mock_run_analysis, mock_update_prices, mock_sys_exit):
        """
        Tests that the main function exits with status 1 if the workflow completes with errors.
        """
        # Arrange: Mock a final state with errors
        error_state = create_initial_state()
        error_state["final_report"] = "This is a report with errors."
        error_state["errors"] = ["Tool failed", "Another error"]
        mock_run_analysis.return_value = error_state

        # Act
        run_portfolio_manager.main()

        # Assert
        mock_sys_exit.assert_called_once_with(1)
        mock_capture_message.assert_called_once_with(
            "Portfolio analysis completed with 2 errors.",
            level="warning"
        )
        mock_pushover.assert_called_once()

    @patch("sys.argv", ["run_portfolio_manager.py"])
    @patch("run_portfolio_manager.update_gsheet_prices")
    @patch("run_portfolio_manager.run_autonomous_analysis")
    @patch("run_portfolio_manager.capture_error")
    @patch("run_portfolio_manager.send_pushover_message")
    def test_run_exits_1_on_fatal_exception(self, mock_pushover, mock_capture_error, mock_run_analysis, mock_update_prices, mock_sys_exit):
        """
        Tests that the main function exits with status 1 on a fatal exception
        and reports to Sentry.
        """
        # Arrange: Mock the analysis to raise a fatal exception
        test_exception = ValueError("A fatal error occurred")
        mock_run_analysis.side_effect = test_exception

        # Act
        run_portfolio_manager.main()

        # Assert
        mock_sys_exit.assert_called_once_with(1)
        mock_capture_error.assert_called_once_with(test_exception)
        mock_pushover.assert_called_once()

    @patch("sys.argv", ["run_portfolio_manager.py"])
    @patch("run_portfolio_manager.update_gsheet_prices")
    @patch("run_portfolio_manager.run_autonomous_analysis")
    @patch("run_portfolio_manager.send_pushover_message")
    def test_run_exits_1_if_no_report_is_generated(self, mock_pushover, mock_run_analysis, mock_update_prices, mock_sys_exit):
        """
        Tests that the main function exits with status 1 if no final report is generated.
        """
        # Arrange: Mock a state with no final report
        no_report_state = create_initial_state()
        no_report_state["final_report"] = None
        mock_run_analysis.return_value = no_report_state

        # Act
        run_portfolio_manager.main()

        # Assert
        mock_sys_exit.assert_called_once_with(1)
        mock_pushover.assert_not_called()

    @patch("sys.argv", ["run_portfolio_manager.py", "--no-notification"])
    @patch("run_portfolio_manager.update_gsheet_prices")
    @patch("run_portfolio_manager.run_autonomous_analysis")
    @patch("run_portfolio_manager.send_pushover_message")
    def test_run_with_no_notification_flag_suppresses_pushover(self, mock_pushover, mock_run_analysis, mock_update_prices, mock_sys_exit):
        """
        Tests that running with --no-notification suppresses the Pushover message on success.
        """
        # Arrange: Mock a successful final state
        successful_state = create_initial_state()
        successful_state["final_report"] = "This is a successful report."
        successful_state["errors"] = []
        mock_run_analysis.return_value = successful_state

        # Act
        run_portfolio_manager.main()

        # Assert
        mock_sys_exit.assert_called_once_with(0)
        mock_pushover.assert_not_called()

    @patch("sys.argv", ["run_portfolio_manager.py", "--no-notification"])
    @patch("run_portfolio_manager.update_gsheet_prices")
    @patch("run_portfolio_manager.run_autonomous_analysis")
    @patch("run_portfolio_manager.send_pushover_message")
    @patch("run_portfolio_manager.capture_error")
    def test_run_with_no_notification_flag_suppresses_error_pushover(self, mock_capture_error, mock_pushover, mock_run_analysis, mock_update_prices, mock_sys_exit):
        """
        Tests that running with --no-notification suppresses the Pushover message on fatal error.
        """
        # Arrange: Mock a fatal exception
        test_exception = ValueError("Fatal error")
        mock_run_analysis.side_effect = test_exception

        # Act
        run_portfolio_manager.main()

        # Assert
        mock_sys_exit.assert_called_once_with(1)
        mock_pushover.assert_not_called()
        mock_capture_error.assert_called_once_with(test_exception)
