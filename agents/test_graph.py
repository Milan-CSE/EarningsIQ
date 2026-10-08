from __future__ import annotations

import unittest

from agents.graph import run_graph


class GraphTests(unittest.TestCase):
    def test_end_to_end_trace_order(self):
        state = run_graph("AAPL", "2024-Q4")
        self.assertEqual([s.name for s in state.trace], ["retrieval", "analyst", "risk", "critic", "synthesis"])
        self.assertIn("not investment advice", state.summary.lower())
        self.assertTrue(all(c.citations for c in state.claims))

    def test_critic_routes_injected_claim(self):
        state = run_graph("AAPL", "2024-Q4", inject_broken=True)
        self.assertGreaterEqual(state.retries, 1)
        self.assertFalse(any("1,000,000" in c.text for c in state.claims))


if __name__ == "__main__":
    unittest.main()
