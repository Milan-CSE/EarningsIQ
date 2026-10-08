"""Download/prepare a ticker slice.

Live path: EDGAR + FMP/Alpha Vantage + yfinance.
Offline path (default): copy labeled fixtures into data/{ticker}/.
Never fabricate a figure if a source is missing.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from ingestion.edgar import load_fixture_filing
from ingestion.asr import transcribe_fixture
from ingestion.chunker import chunk_text

ROOT = Path(__file__).resolve().parents[1]


def run(ticker: str) -> dict:
    ticker = ticker.upper()
    out = ROOT / "data" / ticker
    out.mkdir(parents=True, exist_ok=True)
    filing = None
    for form in ("10k", "10q", "8k"):
        try:
            filing = load_fixture_filing(ticker, form)
            (out / f"{form}.json").write_text(json.dumps(filing, indent=2))
            break
        except Exception:
            continue
    transcript_path = ROOT / "fixtures" / "transcripts" / f"{ticker.lower()}.txt"
    utterances = []
    if transcript_path.exists():
        utterances = transcribe_fixture(transcript_path)
        (out / "transcript.json").write_text(json.dumps(utterances, indent=2))
    chunks = []
    if filing and "text" in filing:
        chunks = chunk_text(filing["text"])
        (out / "chunks.json").write_text(json.dumps(chunks, indent=2))
    prices = ROOT / "fixtures" / "panel.csv"
    summary = {
        "ticker": ticker,
        "source": "FIXTURE",
        "filing": bool(filing),
        "utterances": len(utterances),
        "chunks": len(chunks),
        "prices": prices.exists(),
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    tick = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(json.dumps(run(tick), indent=2))
