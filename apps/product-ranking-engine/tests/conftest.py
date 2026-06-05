"""Pytest configuration for product ranking engine tests."""

import pytest
import asyncio
from config import get_settings


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def settings():
    """Get application settings."""
    return get_settings()


@pytest.fixture(autouse=True)
def reset_settings():
    """Reset settings between tests."""
    yield
    # Reset to defaults
    get_settings.cache_clear()


def pytest_configure(config):
    """Configure pytest."""
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
