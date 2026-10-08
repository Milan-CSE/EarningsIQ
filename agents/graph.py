"""Retrieval -> analyst -> risk -> critic -> synthesis.

Production orchestration: LangGraph. This module is a typed stand-in that is
independently runnable without the LangGraph extra, using the same node
contract. The live desk in src/lib/research/pipeline.ts is the product path.
"""

from __future__ import annotations

import time
from pathlib import Path

from agents.state import AgentStep, Claim, GraphState

ROOT = Path(__file__).resolve().parents[1]
PROMPTS = ROOT / "agents" / "prompts"


def _prompt(name: str) -> str:
    path = PROMPTS / name
    return path.read_text() if path.exists() else name


def _step(name: str, summary: str, retries: int = 0) -> AgentStep:
    return AgentStep(name=name, status="ok", summary=summary, retries=retries, latency_ms=5)


def retrieval_node(state: GraphState) -> GraphState:
    state.trace.append(_step("retrieval", f"Hybrid retrieve for {state.ticker} {state.quarter}"))
    return state


def analyst_node(state: GraphState) -> GraphState:
    _prompt("analyst.v1.md")
    if not state.claims:
        state.claims = [
            Claim(
                id="seed",
                text="Fixture pipeline requires the TypeScript desk for numeric extraction.",
                citations=["cite-fixture"],
                verified=True,
                status="supported",
                confidence=0.5,
                note="Python graph is a contract/smoke path; numbers live in the TS corpus.",
            )
        ]
        state.citations = [{"id": "cite-fixture", "excerpt": "FIXTURE"}]
    state.trace.append(_step("analyst", f"{len(state.claims)} claims"))
    return state


def risk_node(state: GraphState) -> GraphState:
    _prompt("risk.v1.md")
    state.risks = state.risks or [{"label": "hedge scan", "severity": "low", "evidence": "see TS desk"}]
    state.trace.append(_step("risk", f"{len(state.risks)} findings"))
    return state


def critic_node(state: GraphState) -> GraphState:
    _prompt("critic.v1.md")
    if state.inject_broken:
        state.claims.append(
            Claim(
                id="injected",
                text="Revenue was $1,000,000 million.",
                numeric_value=1_000_000,
                citations=[],
                verified=False,
                status="unsupported",
                note="Injected unsupported claim for critic routing test.",
            )
        )
    retries = 0
    bad = [c for c in state.claims if not c.citations]
    if bad:
        retries = 1
        state.claims = [c for c in state.claims if c.citations]
    state.retries = retries
    state.trace.append(_step("critic", "citation check", retries=retries))
    return state


def synthesis_node(state: GraphState) -> GraphState:
    _prompt("synthesis.v1.md")
    n = len(state.claims)
    state.summary = (
        f"{state.ticker} {state.quarter}: {n} verified claims. "
        "This is a research summary of a frozen fixture corpus, not investment advice."
    )
    state.trace.append(_step("synthesis", "drafted brief"))
    return state


def run_graph(ticker: str, quarter: str, *, inject_broken: bool = False) -> GraphState:
    t0 = time.time()
    state = GraphState(ticker=ticker.upper(), quarter=quarter, inject_broken=inject_broken)
    for node in (retrieval_node, analyst_node, risk_node, critic_node, synthesis_node):
        state = node(state)
    _ = t0
    return state
