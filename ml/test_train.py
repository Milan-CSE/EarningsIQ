from __future__ import annotations

import unittest

from ml.train import generate_panel, walk_forward_masks, FEATURES


class WalkForwardTests(unittest.TestCase):
    def test_split_is_temporal_not_random(self):
        df = generate_panel()
        train, valid, test = walk_forward_masks(df)
        self.assertTrue((df.loc[train, "quarter_idx"] <= df.loc[valid, "quarter_idx"].min()).all())
        self.assertTrue((df.loc[valid, "quarter_idx"] < df.loc[test, "quarter_idx"].min()).all())
        self.assertEqual(set(FEATURES) <= set(df.columns), True)
        # Comment contract: a random split would leak future quarters into train.
        self.assertIn("2023-Q4", set(df.loc[train, "quarter"]))
        self.assertNotIn("2024-Q4", set(df.loc[train, "quarter"]))


if __name__ == "__main__":
    unittest.main()
