import { createServerFn } from "@tanstack/react-start";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { COMPANIES, DOCUMENTS, CHUNKS, XBRL_FACTS, PRICES, companyByTicker } from "./corpus.ts";
import { getJob, listJobs, runPipeline } from "./pipeline.ts";
import { hybridRetrieve, runRetrievalSmoke } from "./retrieve.ts";
import { loadRegisteredModel, registryPath } from "./model.ts";
import { evaluateRetrieval, evaluatePipeline, GOLDEN } from "./eval.ts";
import { chunkDocument } from "./chunker.ts";
import { parseTimestampedTranscript, hedgeRate } from "./asr.ts";

export const getUniverse = createServerFn({ method: "GET" }).handler(async () => {
  return {
    companies: COMPANIES,
    dataMode: "fixture" as const,
    disclaimer:
      "Fixture universe only. Submitting a ticker runs the agent team against frozen filings, not live EDGAR.",
  };
});

export const submitResearch = createServerFn({ method: "POST" })
  .validator((input: { ticker: string; quarter?: string }) => input)
  .handler(async ({ data }) => {
    const report = await runPipeline({ ticker: data.ticker, quarter: data.quarter });
    return report;
  });

export const fetchJob = createServerFn({ method: "GET" })
  .validator((input: { jobId: string }) => input)
  .handler(async ({ data }) => {
    const job = getJob(data.jobId);
    if (!job) return { ok: false as const, error: "Unknown job. Run a briefing from the desk." };
    return { ok: true as const, report: job };
  });

export const fetchJobs = createServerFn({ method: "GET" }).handler(async () => listJobs());

export const retrievalHealth = createServerFn({ method: "GET" }).handler(async () => {
  return runRetrievalSmoke();
});

export const probeRetrieve = createServerFn({ method: "POST" })
  .validator((input: { query: string; ticker: string }) => input)
  .handler(async ({ data }) => {
    const hits = hybridRetrieve(data.query, { ticker: data.ticker.toUpperCase(), k: 6 });
    return hits.map((h) => ({
      id: h.id,
      ticker: h.ticker,
      section: h.section,
      docType: h.docType,
      score: h.score,
      excerpt: h.text.slice(0, 320),
      citation: h.citation,
    }));
  });

export const getCorpusBundle = createServerFn({ method: "GET" })
  .validator((input: { ticker: string }) => input)
  .handler(async ({ data }) => {
    const ticker = data.ticker.toUpperCase();
    const company = companyByTicker(ticker);
    if (!company) return { ok: false as const, error: "Unknown ticker in fixture universe." };
    const documents = DOCUMENTS.filter((d) => d.ticker === ticker).map((d) => ({
      ...d,
      preview: d.text.slice(0, 900),
      utterances: d.docType === "transcript" ? parseTimestampedTranscript(d.text) : [],
      hedge: d.docType === "transcript" ? hedgeRate(d.text) : null,
      autoChunks: chunkDocument(d).length,
    }));
    return {
      ok: true as const,
      company,
      documents,
      chunks: CHUNKS.filter((c) => c.ticker === ticker),
      facts: XBRL_FACTS.filter((f) => f.ticker === ticker),
      prices: PRICES.filter((p) => p.ticker === ticker),
    };
  });

export const fetchModelCard = createServerFn({ method: "GET" }).handler(async () => {
  const path = registryPath();
  if (!path) {
    return { ok: false as const, error: "MLflow registry unavailable — no production alias loaded." };
  }
  const model = loadRegisteredModel();
  const runsPath = join(process.cwd(), "src/data/mlruns.json");
  const runs = existsSync(runsPath) ? JSON.parse(readFileSync(runsPath, "utf8")) : null;
  return {
    ok: true as const,
    model: {
      name: model.name,
      version: model.version,
      alias: model.alias,
      algorithm: model.algorithm,
      features: model.features,
      metrics: model.metrics,
      notes: (model as { notes?: string }).notes,
      coefficients: model.coefficients ?? null,
    },
    runs,
    registryPath: path,
  };
});

export const fetchEvalReport = createServerFn({ method: "GET" }).handler(async () => {
  const retrieval = evaluateRetrieval();
  const pipeline = await evaluatePipeline();
  return {
    nGolden: GOLDEN.length,
    retrieval,
    pipeline: {
      criticCaughtInjected: pipeline.criticCaughtInjected,
      allCited: pipeline.allCited,
      numeric: pipeline.numeric,
      reportClaims: pipeline.reportClaims,
    },
  };
});

export const fetchFindings = createServerFn({ method: "GET" }).handler(async () => {
  const p = join(process.cwd(), "eda/FINDINGS.md");
  const markdown = existsSync(p) ? readFileSync(p, "utf8") : "";
  const figures = [
    { src: "/eda/beat_rate_by_ticker.png", title: "Beat rate by ticker", note: "Sticky but not stationary — last_4q_beat_rate." },
    { src: "/eda/beat_rate_over_time.png", title: "Beat rate over time", note: "Drift by quarter is why the split is walk-forward." },
    { src: "/eda/sentiment_vs_reaction.png", title: "Tone vs reaction proxy", note: "Weak positive; not used alone." },
    { src: "/eda/hedge_by_class.png", title: "Hedging by class", note: "Higher hedge-token rate on misses." },
    { src: "/eda/feature_correlation.png", title: "Feature correlations", note: "Scale-free fundamentals + tone." },
    { src: "/eda/class_balance.png", title: "Class balance", note: "Usable ~55/45. No resampling." },
    { src: "/eda/walk_forward_split.png", title: "Walk-forward split", note: "Train ≤2023Q4, valid 2024H1, test 2024H2." },
    { src: "/eda/chunk_length_hist.png", title: "Chunk lengths", note: "Bimodal: narrative vs intact tables." },
  ];
  return { markdown, figures };
});
