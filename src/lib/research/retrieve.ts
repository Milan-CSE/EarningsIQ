import type { Chunk, Citation } from "./types.ts";
import { FIXTURE_LABEL } from "./types.ts";
import { CHUNKS, RETRIEVAL_PROBES } from "./corpus.ts";

const STOP = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "for", "on", "was", "were",
  "is", "are", "at", "by", "as", "with", "from", "that", "this", "be", "it",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%$.,]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/[.,]$/g, ""))
    .filter((t) => t.length > 1 && !STOP.has(t));
}

type Posting = { df: number; tf: Map<string, number> };

function buildIndex(chunks: Chunk[]) {
  const N = chunks.length;
  const postings = new Map<string, Posting>();
  const docLen = new Map<string, number>();
  let totalLen = 0;
  for (const chunk of chunks) {
    const toks = tokenize(chunk.text);
    docLen.set(chunk.id, toks.length);
    totalLen += toks.length;
    const tf = new Map<string, number>();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [term, c] of tf) {
      let p = postings.get(term);
      if (!p) {
        p = { df: 0, tf: new Map() };
        postings.set(term, p);
      }
      p.df += 1;
      p.tf.set(chunk.id, c);
    }
  }
  return { N, postings, docLen, avgdl: totalLen / Math.max(N, 1) };
}

function bm25Score(query: string[], chunkId: string, index: ReturnType<typeof buildIndex>, k1 = 1.5, b = 0.75) {
  const dl = index.docLen.get(chunkId) ?? 0;
  let score = 0;
  for (const term of query) {
    const p = index.postings.get(term);
    if (!p) continue;
    const tf = p.tf.get(chunkId) ?? 0;
    if (!tf) continue;
    const idf = Math.log(1 + (index.N - p.df + 0.5) / (p.df + 0.5));
    const denom = tf + k1 * (1 - b + b * (dl / index.avgdl));
    score += idf * ((tf * (k1 + 1)) / denom);
  }
  return score;
}

function tfidfVec(tokens: string[], index: ReturnType<typeof buildIndex>): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const vec = new Map<string, number>();
  for (const [term, c] of tf) {
    const p = index.postings.get(term);
    const df = p?.df ?? 0;
    const idf = Math.log((index.N + 1) / (df + 1)) + 1;
    vec.set(term, (c / tokens.length) * idf);
  }
  return vec;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [, v] of b) nb += v * v;
  const terms = new Set([...a.keys(), ...b.keys()]);
  for (const t of terms) dot += (a.get(t) ?? 0) * (b.get(t) ?? 0);
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

function rrf(rank: number, k = 60): number {
  return 1 / (k + rank);
}

export type Retrieved = Chunk & { score: number; citation: Citation };

export function hybridRetrieve(
  query: string,
  opts: { ticker?: string; quarter?: string; k?: number } = {},
): Retrieved[] {
  const k = opts.k ?? 8;
  const pool = CHUNKS.filter((c) => {
    if (opts.ticker && c.ticker !== opts.ticker.toUpperCase()) return false;
    if (opts.quarter && c.quarter !== opts.quarter) return false;
    return true;
  });
  if (pool.length === 0) return [];
  const index = buildIndex(pool);
  const qToks = tokenize(query);
  const qVec = tfidfVec(qToks, index);

  const bm25 = pool
    .map((c) => ({ c, s: bm25Score(qToks, c.id, index) }))
    .sort((a, b) => b.s - a.s);
  const dense = pool
    .map((c) => ({ c, s: cosine(qVec, tfidfVec(tokenize(c.text), index)) }))
    .sort((a, b) => b.s - a.s);

  const fused = new Map<string, { chunk: Chunk; score: number }>();
  bm25.forEach((row, i) => {
    const cur = fused.get(row.c.id) ?? { chunk: row.c, score: 0 };
    cur.score += rrf(i + 1);
    fused.set(row.c.id, cur);
  });
  dense.forEach((row, i) => {
    const cur = fused.get(row.c.id) ?? { chunk: row.c, score: 0 };
    cur.score += rrf(i + 1);
    fused.set(row.c.id, cur);
  });

  // Cross-encoder stand-in: lexical overlap + exact numeric match boost.
  // Production swap: BAAI/bge-reranker-large (see ingestion/embeddings.py).
  const ranked = [...fused.values()]
    .map((row) => {
      const toks = new Set(tokenize(row.chunk.text));
      const overlap = qToks.filter((t) => toks.has(t)).length / Math.max(qToks.length, 1);
      const nums = query.match(/[\d,.]+%?/g) ?? [];
      const hit = nums.some((n) => row.chunk.text.includes(n)) ? 0.15 : 0;
      return { ...row, score: row.score + overlap + hit };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  return ranked.map((row) => ({
    ...row.chunk,
    score: row.score,
    citation: toCitation(row.chunk),
  }));
}

export function toCitation(chunk: Chunk): Citation {
  return {
    id: `cite-${chunk.id}`,
    docId: chunk.docId,
    docType: chunk.docType,
    section: chunk.section,
    page: chunk.page,
    charStart: chunk.charStart,
    charEnd: chunk.charEnd,
    timestamp: chunk.timestamp,
    excerpt: chunk.text.slice(0, 280),
    sourceLabel: FIXTURE_LABEL,
  };
}

export function runRetrievalSmoke(): { query: string; ok: boolean; excerpt: string }[] {
  return RETRIEVAL_PROBES.map((probe) => {
    const hits = hybridRetrieve(probe.query, { ticker: probe.ticker, k: 5 });
    const ok = hits.some((h) => h.text.includes(probe.mustInclude));
    return { query: probe.query, ok, excerpt: hits[0]?.text.slice(0, 160) ?? "" };
  });
}
