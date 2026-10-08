# EarningsIQ

A multi-agent financial **research** desk. It ingests a public-company-style 10-K / 10-Q / 8-K and an earnings-call transcript, retrieves passages with hybrid RAG, and runs a five-node agent team:

`retrieval → analyst → risk → critic → synthesis`

The critic will not let a numeric claim through without a matching citation. If you inject an unsupported number, it routes back to the analyst and drops the claim rather than publishing it.

**This is a research and summarization tool. It is not investment advice**, a solicitation, or a recommendation to buy, sell, or hold any security. Figures in the running desk come from a **frozen fixture corpus**, labeled as such — not a live EDGAR, broker, or market-data feed.

## Architecture

```
  [Briefing UI]  TanStack Start / Vite
        |
        v
  Fast server functions
        |
        +--> hybrid retrieve (BM25 + TF-IDF dense stand-in, RRF, rerank)
        +--> analyst / risk / critic / synthesis   (Langfuse traces)
        +--> guidance-beat model from MLflow registry
        |
        v
  cited report + confidence trail + research signal

  Python sidecar (docker-compose): Postgres+pgvector, MLflow, Langfuse
  ml/train.py  -- walk-forward LogReg vs XGBoost + Optuna
  eda/         -- FINDINGS.md is the feature contract
```

### Why both MLflow and Langfuse

They cover different layers. **MLflow** tracks the classical guidance-beat model: parameters, Optuna nested trials, artifacts, and the staging/production registry alias the API actually loads. **Langfuse** traces the LLM/agent graph: prompts, latency, cost. Using one tool for both would blur those jobs. Keeping both is an architectural decision, not an oversight.

Dense retrieval in production is `BAAI/bge-large-en-v1.5` plus `BAAI/bge-reranker-large`. This environment uses a BM25 + TF-IDF stand-in so we do not download a 1GB encoder at request time (`src/lib/research/retrieve.ts`). ASR production is faster-whisper; here we parse timestamped MAEC-style transcript fixtures.

## Fixture universe

AAPL (FY2024 10-K + call), MSFT (FY2024 10-K + call), NVDA (Q1 FY2025 10-Q + call).

## Setup (interactive desk)

**On your own computer** — Node 22+, then:

```
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080). Pick AAPL / MSFT / NVDA and run a briefing. You should see cited claims, a critic trail, and a guidance-beat probability loaded from `ml/registry/production.json`. If that file is missing the desk **fails loudly** instead of scoring a stale pickle.

See [RUN_LOCALLY.md](RUN_LOCALLY.md) for the unzip-and-run checklist.


## Eval suite

```
npm run test:eval
PYTHONPATH=. python -m unittest ingestion.test_ingestion agents.test_graph eval.test_eval ml.test_train
```

The golden set is 40 questions in `src/lib/research/eval.ts` (a 10-item sample also lives in `eval/golden.json`). Scale to 150–200 by adding tickers/quarters to the fixture corpus and repeating the three kinds: factual lookup, numeric extraction, cross-document call-vs-filing. Keep `mustInclude` as a **literal span from the source**.

## Classical ML

```
python -m ml.train
python eda/run_eda.py
```

Split is **walk-forward by fiscal quarter** (train ≤ 2023-Q4, valid 2024-Q1/Q2, test 2024-Q3/Q4). A random split would leak future information into training — that is a real methodological bug in finance ML, which is why the cut is temporal. Feature choices are justified in [`eda/FINDINGS.md`](eda/FINDINGS.md). Runs are in `ml/mlruns/` (file-backed MLflow stand-in). The winner is promoted to `ml/registry/production.json`.

On the current synthetic panel the logistic baseline beat tuned XGBoost on the honest test window, so the baseline is production. That comparison is the point; do not report one AUC in isolation.

## Python sidecar / Docker

```
cp .env.example .env   # fill keys if you want live EDGAR later
docker compose up
```

`infra/render.yaml` is a one-command Render config. Do not deploy without credentials.

## Credentials

Batch these into `.env` (gitignored). The desk does not block on them — it mocks/fixtures instead.

- `SEC_EDGAR_USER_AGENT` — `"Name email@domain"`
- `FMP_API_KEY` or `ALPHAVANTAGE_API_KEY`
- `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `XAI_API_KEY`
- `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` (optional)
- `MLFLOW_TRACKING_URI` (defaults to local compose)
- `DATABASE_URL` (defaults to local Postgres)

## License

MIT
