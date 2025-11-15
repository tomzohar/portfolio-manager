"""
Centralized Error and Message Reporting

This module provides an abstraction layer for capturing exceptions and messages,
sending them to a configured error tracking service (e.g., Sentry). This allows
the application to be decoupled from a specific service, making it easier to
switch providers in the future.
"""
import sentry_sdk


def capture_error(error: Exception):
    """
    Abstracted function to capture an exception and send it to an error tracking service.
    Currently uses Sentry.
    
    Args:
        error: The exception object to report.
    """
    sentry_sdk.capture_exception(error)


def capture_message(message: str, level: str = "info", **kwargs):
    """
    Abstracted function to capture a message and send it to an error tracking service.
    Currently uses Sentry.

    Args:
        message: The message string to report.
        level: The severity level of the message (e.g., 'info', 'warning', 'error').
        **kwargs: Additional keyword arguments to pass to the capture service.
    """
    sentry_sdk.capture_message(message, level=level, **kwargs)
