"""Typed graph state. Pydantic if installed; dataclasses otherwise."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

try:
    from pydantic import BaseModel, Field

    class Claim(BaseModel):
        id: str
        text: str
        numeric_value: float | None = None
        unit: str | None = None
        metric: str | None = None
        citations: list[str] = Field(default_factory=list)
        verified: bool = False
        status: Literal["supported", "contradicted", "unsupported", "hedged"] = "unsupported"
        confidence: float = 0.0
        note: str = ""

    class AgentStep(BaseModel):
        name: str
        status: str
        summary: str
        retries: int = 0
        cost_usd: float = 0.0
        latency_ms: int = 0

    class GraphState(BaseModel):
        ticker: str
        quarter: str
        claims: list[Claim] = Field(default_factory=list)
        citations: list[dict[str, Any]] = Field(default_factory=list)
        risks: list[dict[str, Any]] = Field(default_factory=list)
        summary: str = ""
        retries: int = 0
        inject_broken: bool = False
        trace: list[AgentStep] = Field(default_factory=list)

except ImportError:

    @dataclass
    class Claim:
        id: str
        text: str
        numeric_value: float | None = None
        unit: str | None = None
        metric: str | None = None
        citations: list[str] = field(default_factory=list)
        verified: bool = False
        status: str = "unsupported"
        confidence: float = 0.0
        note: str = ""

    @dataclass
    class AgentStep:
        name: str
        status: str
        summary: str
        retries: int = 0
        cost_usd: float = 0.0
        latency_ms: int = 0

    @dataclass
    class GraphState:
        ticker: str
        quarter: str
        claims: list[Claim] = field(default_factory=list)
        citations: list[dict] = field(default_factory=list)
        risks: list[dict] = field(default_factory=list)
        summary: str = ""
        retries: int = 0
        inject_broken: bool = False
        trace: list[AgentStep] = field(default_factory=list)
