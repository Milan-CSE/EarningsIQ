# Run EarningsIQ on your computer

You do **not** need Docker for the research desk. Node 22+ is enough.

## 1. Unzip

```
unzip earningsiq.zip
cd earningsiq
```

## 2. Install and start the desk

```
npm install
npm run dev
```

Then open [http://localhost:8080](http://localhost:8080) in a browser.

Pick AAPL, MSFT, or NVDA and run a briefing. Every number in the report is cited against a frozen fixture filing — this is **not investment advice**.

## 3. Optional: tests and the Python ML sidecar

```
npm run test:eval
```

Python 3.11+ (optional — only for retraining the guidance-beat model):

```
python -m pip install -e .
python -m ml.train
python eda/run_eda.py
PYTHONPATH=. python -m unittest ingestion.test_ingestion agents.test_graph eval.test_eval ml.test_train
```

Copy `.env.example` to `.env` only if you later want live EDGAR / LLM keys. The desk runs without them.

## What you get

| Path | What it is |
| --- | --- |
| `src/` | Interactive research desk (TanStack Start) |
| `src/lib/research/` | Hybrid retrieval, agent graph, eval harness |
| `ml/` | Walk-forward LogReg vs XGBoost + registry |
| `eda/` | Feature-engineering findings and charts |
| `fixtures/` | Labeled offline filings, transcripts, panel |
| `docker-compose.yml` | Optional Postgres / MLflow / Langfuse sidecar |

If `ml/registry/production.json` is missing, the briefing still drafts the cited report but the guidance-beat signal fails loudly instead of scoring a stale pickle.
