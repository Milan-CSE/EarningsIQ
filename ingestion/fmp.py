"""Financial Modeling Prep / Alpha Vantage client.

Needs FMP_API_KEY or ALPHAVANTAGE_API_KEY for live calls. Tests and the desk
use labeled fixtures and never invent a fundamental.
"""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def has_live_key() -> bool:
    return bool(os.environ.get("FMP_API_KEY") or os.environ.get("ALPHAVANTAGE_API_KEY"))


def load_panel_fixture() -> Path:
    path = ROOT / "fixtures" / "panel.csv"
    if not path.exists():
        raise FileNotFoundError("fixtures/panel.csv missing. Refusing to fabricate fundamentals.")
    return path
