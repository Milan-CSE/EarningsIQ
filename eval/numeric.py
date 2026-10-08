"""Deterministic numeric-accuracy checker (regex, no LLM)."""

from __future__ import annotations

import re

NUM_RE = re.compile(
    r"\$?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(\s*(?:billion|million|percent|%))?",
    re.I,
)


def extract_numbers(text: str) -> list[float]:
    out: list[float] = []
    for m in NUM_RE.finditer(text):
        n = float(m.group(1).replace(",", ""))
        unit = (m.group(2) or "").lower()
        if "billion" in unit:
            n *= 1000.0
        out.append(n)
    return out


def close_enough(a: float, b: float, tol: float = 0.03) -> bool:
    if b == 0:
        return abs(a - b) < 1
    return abs(a - b) / abs(b) <= tol
