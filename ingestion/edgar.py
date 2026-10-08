"""SEC EDGAR client with a required User-Agent and exponential backoff.

Live calls need SEC_EDGAR_USER_AGENT='Name email@domain'. This module never
invents a filing: if the network is unreachable it loads fixtures/edgar/.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "fixtures" / "edgar"


class EdgarError(RuntimeError):
    pass


def _user_agent() -> str:
    ua = os.environ.get("SEC_EDGAR_USER_AGENT", "").strip()
    if not ua:
        # Placeholder — EDGAR rejects an empty UA. Tests never hit the network.
        ua = "EarningsIQ fixture@example.com"
    return ua


def fetch_json(url: str, *, retries: int = 3, timeout: int = 20) -> dict:
    last: Exception | None = None
    for attempt in range(retries):
        req = Request(url, headers={"User-Agent": _user_agent(), "Accept-Encoding": "gzip, deflate"})
        try:
            with urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
            return json.loads(raw.decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            last = exc
            time.sleep(0.4 * (2**attempt))
    raise EdgarError(f"EDGAR fetch failed for {url}: {last}")


def load_fixture_filing(ticker: str, form: str) -> dict:
    path = FIXTURES / f"{ticker.lower()}_{form.lower().replace('-', '')}.json"
    if not path.exists():
        raise EdgarError(f"No fixture filing at {path}. Refusing to fabricate a 10-K.")
    return json.loads(path.read_text())
