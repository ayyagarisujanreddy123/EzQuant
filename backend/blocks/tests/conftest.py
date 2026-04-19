"""
Shared fixtures for block tests.

Pulls SPY once per session so we don't hammer yfinance across tests.
"""
import pytest

from backend.blocks.source import universe


@pytest.fixture(scope="session")
def spy_df():
    out = universe(
        {},
        {"symbol": "SPY", "start": "2015-01-01", "end": "2023-12-31", "interval": "1d"},
    )
    return out["df"]
