"""Unit tests using fixture files only — no live network."""

from __future__ import annotations

import unittest
from pathlib import Path

from ingestion.chunker import chunk_text
from ingestion.asr import parse_transcript
from ingestion.edgar import load_fixture_filing, EdgarError

ROOT = Path(__file__).resolve().parents[1]

SAMPLE = """Item 7. MD&A
Net sales for 2024 were $391,035 million.

Item 8. Financial Statements
Consolidated Statements of Operations (in millions)
Total net sales                                        391,035     383,285
Gross margin                                           180,683     169,148
"""


class ChunkerTests(unittest.TestCase):
    def test_keeps_table_intact(self):
        chunks = chunk_text(SAMPLE)
        tables = [c for c in chunks if c["table"]]
        self.assertTrue(tables)
        self.assertIn("391,035", tables[0]["text"])
        self.assertTrue(all(c["section"] for c in chunks))


class AsrTests(unittest.TestCase):
    def test_parses_timestamps(self):
        raw = "[00:04:40] Tim Cook, CEO: iPhone revenue for the full year was just over $201 billion."
        rows = parse_transcript(raw)
        self.assertEqual(rows[0]["timestamp"], "00:04:40")
        self.assertIn("201", rows[0]["text"])


class EdgarFixtureTests(unittest.TestCase):
    def test_missing_fixture_does_not_fabricate(self):
        with self.assertRaises(EdgarError):
            load_fixture_filing("ZZZZ", "10-K")

    def test_loads_labeled_aapl_10k(self):
        doc = load_fixture_filing("AAPL", "10-K")
        self.assertIn("FIXTURE", doc["source"])
        self.assertIn("391,035", doc["text"])


if __name__ == "__main__":
    unittest.main()
