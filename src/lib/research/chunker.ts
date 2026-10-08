import type { Chunk, Document } from "./types.ts";

const ITEM_RE = /^(Item\s+\d+[A-Z]?(?:\.\d+)?[.:].+)$/gim;
const TABLE_HINT = /(in millions|Net sales\s+|Revenue\s+|Diluted EPS|Cost of sales|Gross margin\s+|Operating income\s+|Weighted-average)/i;

/**
 * Filing-aware chunker: split on Item/section headings and never break a
 * table block across chunks. Justified by eda/FINDINGS.md ("Chunks should
 * not swallow tables" / bimodal length distribution).
 */
export function chunkDocument(doc: Document, maxChars = 720): Chunk[] {
  const headings = collectHeadings(doc);
  const slices: { heading: string; start: number; end: number }[] = [];
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].charStart;
    const end = i + 1 < headings.length ? headings[i + 1].charStart : doc.text.length;
    slices.push({ heading: headings[i].heading, start, end });
  }
  if (slices.length === 0) {
    slices.push({ heading: doc.sectionIndex[0]?.heading ?? "Body", start: 0, end: doc.text.length });
  }

  const chunks: Chunk[] = [];
  for (const slice of slices) {
    const body = doc.text.slice(slice.start, slice.end);
    for (const piece of splitPreservingTables(body, maxChars)) {
      const rel = body.indexOf(piece);
      const charStart = slice.start + Math.max(0, rel);
      const charEnd = charStart + piece.length;
      const ts = piece.match(/\[(\d{2}:\d{2}:\d{2})\]/);
      chunks.push({
        id: `${doc.id}:${charStart}-${charEnd}`,
        docId: doc.id,
        ticker: doc.ticker,
        quarter: doc.quarter,
        docType: doc.docType,
        section: slice.heading,
        charStart,
        charEnd,
        timestamp: doc.docType === "transcript" ? ts?.[1] : undefined,
        text: piece.replace(/\s+/g, " ").trim(),
        table: TABLE_HINT.test(piece),
      });
    }
  }
  return chunks.filter((c) => c.text.length > 40);
}

function collectHeadings(doc: Document): { heading: string; charStart: number }[] {
  if (doc.sectionIndex.length) return [...doc.sectionIndex].sort((a, b) => a.charStart - b.charStart);
  const found: { heading: string; charStart: number }[] = [];
  for (const m of doc.text.matchAll(ITEM_RE)) {
    if (m.index === undefined) continue;
    found.push({ heading: m[1].trim(), charStart: m.index });
  }
  return found;
}

function splitPreservingTables(text: string, maxChars: number): string[] {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) out.push(buf.trim());
    buf = "";
  };
  for (const block of blocks) {
    const isTable = TABLE_HINT.test(block) || /\s{2,}\d{2,}/.test(block);
    if (isTable) {
      flush();
      out.push(block);
      continue;
    }
    if ((buf + "\n\n" + block).length > maxChars && buf) {
      flush();
    }
    buf = buf ? `${buf}\n\n${block}` : block;
    if (buf.length > maxChars) flush();
  }
  flush();
  return out;
}
