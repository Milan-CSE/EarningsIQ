"""ASR pipeline.

Production: faster-whisper on earnings-call audio.
This environment has no call recordings, so we parse a timestamped transcript
fixture (MAEC-style) instead of inventing words.
"""

from __future__ import annotations

import re
from pathlib import Path

LINE_RE = re.compile(r"\[(\d{2}:\d{2}:\d{2})\]\s+([^:]{2,80}):\s+(.+)")
HEDGE_RE = re.compile(
    r"\b(believe|approximately|cautious|uneven|challenging|not providing|visibility|early innings|we think|near term|mixed)\b",
    re.I,
)


def parse_transcript(raw: str) -> list[dict]:
    rows = []
    for m in LINE_RE.finditer(raw):
        rows.append(
            {
                "timestamp": m.group(1),
                "speaker": m.group(2).strip(),
                "text": m.group(3).strip(),
                "char_start": m.start(),
                "char_end": m.end(),
            }
        )
    return rows


def transcribe_fixture(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"No audio/transcript fixture at {path}. Refusing to fabricate a call.")
    return parse_transcript(path.read_text())
