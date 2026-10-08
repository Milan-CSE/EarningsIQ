from __future__ import annotations

import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class RegistryPresence(unittest.TestCase):
    def test_production_alias_exists(self):
        path = ROOT / "ml" / "registry" / "production.json"
        self.assertTrue(path.exists(), "production alias missing")


if __name__ == "__main__":
    unittest.main()
