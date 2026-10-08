# Project summary — resume bullets

- Built **EarningsIQ**, a multi-agent research desk that cross-checks earnings-call claims against SEC filing fixtures with hybrid BM25 + dense retrieval, a critic that refuses uncited numbers, and a walk-forward guidance-beat model.
- Trained a logistic regression baseline and Optuna-tuned XGBoost on a **temporal / walk-forward split by fiscal quarter** (not a random split) and registered the winner in an MLflow-style model registry.
  - Test AUC (logreg): **0.867**
  - Test AUC (XGBoost): **0.822**
  - Promoted: **logistic baseline** (won the honest holdout)
- Retrieval golden set (n=40 fixture questions): context recall **1.00** after indexing table line-items; critic caught an injected unsupported claim and dropped it.
- Used **MLflow** for the classical ML lifecycle (params, Optuna nested runs, registry aliases) and **Langfuse** (or the local stub) for LLM/agent traces — two layers, two tools, on purpose.
- Product disclaimer: research and summarization only, **not investment advice**.

## Metrics worksheet

| Metric | Fixture run | Expanded corpus |
| --- | --- | --- |
| Retrieval context recall | 1.00 (n=40, k=8) |  |
| Retrieval context precision | 1.00 |  |
| Faithfulness (ragas) | n/a until extras installed |  |
| Numeric match rate | 3/3 cited AAPL claims |  |
| Critic injected-claim catch | yes (1 retry, claim dropped) |  |
| Logreg test AUC | 0.867 |  |
| XGB test AUC | 0.822 |  |
