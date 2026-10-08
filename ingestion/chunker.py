"""Filing-aware chunker. See eda/FINDINGS.md — never split a table across chunks."""

from __future__ import annotations

import re

ITEM_RE = re.compile(r"^(Item\s+\d+[A-Z]?(?:\.\d+)?[.:].+)$", re.I | re.M)
TABLE_HINT = re.compile(
    r"(in millions|Net sales\s+|Revenue\s+|Diluted EPS|Cost of sales|Gross margin\s+|Operating income)",
    re.I,
)


def chunk_text(text: str, *, max_chars: int = 720) -> list[dict]:
    headings = [(m.start(), m.group(1).strip()) for m in ITEM_RE.finditer(text)]
    if not headings:
        headings = [(0, "Body")]
    slices: list[tuple[str, int, int]] = []
    for i, (start, heading) in enumerate(headings):
        end = headings[i + 1][0] if i + 1 < len(headings) else len(text)
        slices.append((heading, start, end))
    chunks: list[dict] = []
    for heading, start, end in slices:
        body = text[start:end]
        for piece in _split_preserving_tables(body, max_chars):
            rel = body.find(piece)
            char_start = start + max(rel, 0)
            chunks.append(
                {
                    "section": heading,
                    "char_start": char_start,
                    "char_end": char_start + len(piece),
                    "text": re.sub(r"\s+", " ", piece).strip(),
                    "table": bool(TABLE_HINT.search(piece)),
                }
            )
    return [c for c in chunks if len(c["text"]) > 40]


def _split_preserving_tables(text: str, max_chars: int) -> list[str]:
    blocks = [b.strip() for b in re.split(r"\n{2,}", text) if b.strip()]
    out: list[str] = []
    buf = ""
    for block in blocks:
        is_table = bool(TABLE_HINT.search(block) or re.search(r"\s{2,}\d{2,}", block))
        if is_table:
            if buf:
                out.append(buf)
                buf = ""
            out.append(block)
            continue
        candidate = f"{buf}\n\n{block}" if buf else block
        if len(candidate) > max_chars and buf:
            out.append(buf)
            buf = block
        else:
            buf = candidate
    if buf:
        out.append(buf)
    return out
