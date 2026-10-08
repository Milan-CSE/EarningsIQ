"""Eval smoke tests. ragas/deepeval are optional extras; this gate is deterministic."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from eval.numeric import extract_numbers, close_enough

ROOT = Path(__file__).resolve().parents[1]


class NumericTests(unittest.TestCase):
    def test_millions_and_billions(self):
        self.assertTrue(close_enough(extract_numbers("$201,183 million")[0], 201183))
        self.assertTrue(close_enough(extract_numbers("$94.9 billion")[0], 94900))


class GoldenTests(unittest.TestCase):
    def test_golden_file_exists_and_is_labeled(self):
        payload = json.loads((ROOT / "eval" / "golden.json").read_text())
        self.assertGreaterEqual(len(payload["items"]), 10)
        self.assertIn("Scale", payload["scale"] + payload["note"])


if __name__ == "__main__":
    unittest.main()
