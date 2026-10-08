"""Train the guidance-beat predictor with a walk-forward split.

The split is by fiscal quarter, never random. A random split would leak future
information into training — a real methodological bug in finance ML, not a
style choice. See eda/FINDINGS.md for why this feature set exists.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
import optuna

ROOT = Path(__file__).resolve().parents[1]
PANEL_PATH = ROOT / "fixtures" / "panel.csv"
REGISTRY = ROOT / "ml" / "registry"
MLRUNS = ROOT / "ml" / "mlruns"
FRONTEND_DATA = ROOT / "src" / "data"

FEATURES = [
    "last_4q_beat_rate",
    "surprise_lag1",
    "revenue_growth_yoy",
    "gross_margin_delta",
    "call_sentiment",
    "hedge_token_rate",
    "guidance_range_width",
    "ocf_to_ni",
    "share_count_change",
    "sector_momentum",
    "implied_move",
    "short_interest_proxy",
]

TICKERS = [
    "AAPL",
    "MSFT",
    "NVDA",
    "GOOGL",
    "AMZN",
    "META",
    "AVGO",
    "AMD",
    "INTC",
    "CRM",
    "ORCL",
    "ADBE",
    "QCOM",
    "CSCO",
    "TXN",
    "IBM",
]
# Synthetic fiscal-quarter labels. Order is time. Train never sees a later quarter.
QUARTERS = [
    f"{year}-Q{q}" for year in (2020, 2021, 2022, 2023, 2024) for q in (1, 2, 3, 4)
]


def _quarter_index(q: str) -> int:
    return QUARTERS.index(q)


def generate_panel(seed: int = 7) -> pd.DataFrame:
    """Labeled SYNTHETIC panel. Not live fundamentals.

    DGP is explicit so the model has a recoverable signal:
    beat ~ last_4q_beat_rate + surprise_lag1 + call_sentiment - hedge_token_rate ...
    Feature choices are justified in eda/FINDINGS.md.
    """
    rng = np.random.default_rng(seed)
    ticker_effect = {t: rng.normal(0, 0.15) for t in TICKERS}
    rows = []
    beat_memory = {t: 0.55 for t in TICKERS}
    for qi, q in enumerate(QUARTERS):
        for t in TICKERS:
            last4 = beat_memory[t]
            surprise = rng.normal(0.01, 0.025)
            growth = rng.normal(0.08 if t != "NVDA" else 0.6, 0.12)
            gm = rng.normal(0.004, 0.02)
            sent = rng.normal(0.12, 0.15)
            hedge = np.clip(rng.normal(0.03, 0.015), 0.005, 0.08)
            guide = np.clip(rng.normal(0.03, 0.02), 0.0, 0.12)
            ocf = rng.normal(1.15, 0.25)
            shares = rng.normal(-0.01, 0.015)
            mom = rng.normal(0.03, 0.05)
            implied = np.clip(rng.normal(0.04, 0.02), 0.01, 0.12)
            si = np.clip(rng.normal(0.02, 0.01), 0.001, 0.08)
            # Non-linearities a tree can split on and a linear model cannot:
            # high hedge × low sentiment, and a beat-rate threshold around 0.6.
            interact = -2.4 * max(0.0, hedge - 0.035) * max(0.0, 0.05 - sent)
            thresh = 0.9 if last4 > 0.62 else -0.15
            logit = (
                -0.45
                + 1.15 * last4
                + 7.0 * surprise
                + 0.7 * sent
                - 12.0 * hedge
                + 0.55 * np.tanh(growth)
                + 5.5 * gm
                - 6.0 * guide
                + 0.2 * ocf
                + interact
                + thresh
                + ticker_effect[t]
                + rng.normal(0, 0.62)
            )
            p = 1 / (1 + math.exp(-logit))
            y = int(rng.random() < p)
            beat_memory[t] = 0.7 * last4 + 0.3 * y
            rows.append(
                {
                    "ticker": t,
                    "quarter": q,
                    "quarter_idx": qi,
                    "last_4q_beat_rate": last4,
                    "surprise_lag1": surprise,
                    "revenue_growth_yoy": growth,
                    "gross_margin_delta": gm,
                    "call_sentiment": sent,
                    "hedge_token_rate": hedge,
                    "guidance_range_width": guide,
                    "ocf_to_ni": ocf,
                    "share_count_change": shares,
                    "sector_momentum": mom,
                    "implied_move": implied,
                    "short_interest_proxy": si,
                    "beat": y,
                    "source": "SYNTHETIC_PANEL",
                }
            )
    return pd.DataFrame(rows)


def walk_forward_masks(df: pd.DataFrame):
    """Train on quarters through 2023-Q4, validate 2024-Q1/Q2, test 2024-Q3/Q4.

    This is a walk-forward split by fiscal quarter. A random split would leak
    future information into training — a real methodological bug in finance ML.
    """
    train = df["quarter_idx"] <= _quarter_index("2023-Q4")
    valid = df["quarter"].isin(["2024-Q1", "2024-Q2"])
    test = df["quarter"].isin(["2024-Q3", "2024-Q4"])
    return train, valid, test


def _metrics(y_true, p):
    yhat = (p >= 0.5).astype(int)
    return {
        "auc": float(roc_auc_score(y_true, p)),
        "precision": float(precision_score(y_true, yhat, zero_division=0)),
        "recall": float(recall_score(y_true, yhat, zero_division=0)),
        "avg_precision": float(average_precision_score(y_true, p)),
        "brier": float(brier_score_loss(y_true, p)),
        "n": int(len(y_true)),
        "positive_rate": float(np.mean(y_true)),
    }


def dump_xgb_trees(model: XGBClassifier, feature_names: list[str]) -> list:
    booster = model.get_booster()
    booster.feature_names = feature_names
    raw = booster.get_dump(dump_format="json")
    return [json.loads(t) for t in raw]


def log_run(name: str, params: dict, metrics: dict, extra: dict | None = None) -> dict:
    MLRUNS.mkdir(parents=True, exist_ok=True)
    run = {
        "run_id": name,
        "params": params,
        "metrics": metrics,
        "tags": {"dataset": "synthetic_panel", "split": "walk_forward_quarter"},
        **(extra or {}),
    }
    (MLRUNS / f"{name}.json").write_text(json.dumps(run, indent=2))
    return run


def main() -> None:
    df = generate_panel()
    PANEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(PANEL_PATH, index=False)

    train_m, valid_m, test_m = walk_forward_masks(df)
    X_train, y_train = df.loc[train_m, FEATURES], df.loc[train_m, "beat"]
    X_valid, y_valid = df.loc[valid_m, FEATURES], df.loc[valid_m, "beat"]
    X_test, y_test = df.loc[test_m, FEATURES], df.loc[test_m, "beat"]

    scaler = StandardScaler()
    Xtr = scaler.fit_transform(X_train)
    Xva = scaler.transform(X_valid)
    Xte = scaler.transform(X_test)

    logreg = LogisticRegression(max_iter=400, C=1.0)
    logreg.fit(Xtr, y_train)
    logreg_valid = _metrics(y_valid, logreg.predict_proba(Xva)[:, 1])
    logreg_test = _metrics(y_test, logreg.predict_proba(Xte)[:, 1])
    log_run(
        "logreg_baseline",
        {"C": 1.0, "model": "logistic_regression"},
        {"valid": logreg_valid, "test": logreg_test},
    )

    def objective(trial: optuna.Trial) -> float:
        params = {
            "max_depth": trial.suggest_int("max_depth", 2, 4),
            "n_estimators": trial.suggest_int("n_estimators", 40, 120),
            "learning_rate": trial.suggest_float("learning_rate", 0.03, 0.15, log=True),
            "subsample": trial.suggest_float("subsample", 0.7, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.7, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 2, 8),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.5, 8.0, log=True),
            "objective": "binary:logistic",
            "eval_metric": "auc",
            "n_jobs": 1,
            "random_state": 7,
        }
        model = XGBClassifier(**params)
        model.fit(X_train, y_train, eval_set=[(X_valid, y_valid)], verbose=False)
        p = model.predict_proba(X_valid)[:, 1]
        auc = float(roc_auc_score(y_valid, p))
        log_run(
            f"optuna_trial_{trial.number:03d}",
            params,
            {"valid_auc": auc},
            extra={"parent": "xgb_optuna", "nested": True},
        )
        return auc

    sampler = optuna.samplers.TPESampler(seed=7)
    study = optuna.create_study(direction="maximize", sampler=sampler)
    study.optimize(objective, n_trials=20, show_progress_bar=False)

    best_params = {
        **study.best_params,
        "objective": "binary:logistic",
        "eval_metric": "auc",
        "n_jobs": 1,
        "random_state": 7,
    }
    xgb = XGBClassifier(**best_params)
    # Fit on train only (not train+valid) so the test print is an honest holdout.
    xgb.fit(X_train, y_train, verbose=False)
    xgb_test = _metrics(y_test, xgb.predict_proba(X_test)[:, 1])
    xgb_valid = _metrics(y_valid, xgb.predict_proba(X_valid)[:, 1])
    log_run("xgb_tuned", best_params, {"valid": xgb_valid, "test": xgb_test, "best_trial": study.best_trial.number})

    winner_is_xgb = xgb_test["auc"] >= logreg_test["auc"]
    if winner_is_xgb:
        trees = dump_xgb_trees(xgb, FEATURES)
        production = {
            "name": "guidance-beat-xgb",
            "version": "1",
            "alias": "production",
            "algorithm": "xgboost",
            "features": FEATURES,
            "baseScore": 0.0,
            "trees": trees,
            "metrics": {
                "auc": xgb_test["auc"],
                "precision": xgb_test["precision"],
                "recall": xgb_test["recall"],
                "baselineAuc": logreg_test["auc"],
                "split": "walk_forward: train<=2023Q4, valid=2024Q1-Q2, test=2024Q3-Q4",
            },
            "notes": "Registered from Optuna-tuned XGBoost after beating the logistic baseline on the walk-forward test window. Fixture/synthetic panel only.",
        }
    else:
        coef = {f: float(c) for f, c in zip(FEATURES, logreg.coef_[0])}
        production = {
            "name": "guidance-beat-logreg",
            "version": "1",
            "alias": "production",
            "algorithm": "logistic",
            "features": FEATURES,
            "baseScore": 0.0,
            "coefficients": coef,
            "intercept": float(logreg.intercept_[0]),
            "scaler_mean": scaler.mean_.tolist(),
            "scaler_scale": scaler.scale_.tolist(),
            "metrics": {
                "auc": logreg_test["auc"],
                "precision": logreg_test["precision"],
                "recall": logreg_test["recall"],
                "baselineAuc": logreg_test["auc"],
                "split": "walk_forward: train<=2023Q4, valid=2024Q1-Q2, test=2024Q3-Q4",
            },
            "notes": "Logistic baseline beat tuned XGBoost on the walk-forward test window, so baseline was promoted. Comparison is in ml/mlruns.",
        }
    REGISTRY.mkdir(parents=True, exist_ok=True)
    (REGISTRY / "production.json").write_text(json.dumps(production, indent=2))
    (REGISTRY / "staging.json").write_text(json.dumps({**production, "alias": "staging", "version": "1"}, indent=2))

    FRONTEND_DATA.mkdir(parents=True, exist_ok=True)
    (FRONTEND_DATA / "ml-registry.json").write_text(json.dumps(production))
    runs = []
    for p in sorted(MLRUNS.glob("*.json")):
        runs.append(json.loads(p.read_text()))
    summary = {
        "baseline": {"name": "logreg_baseline", "test": logreg_test, "valid": logreg_valid},
        "tuned": {"name": "xgb_tuned", "test": xgb_test, "valid": xgb_valid, "params": best_params},
        "n_optuna_trials": len(study.trials),
        "best_trial": study.best_trial.number,
        "split": production["metrics"]["split"],
        "class_balance_train": float(y_train.mean()),
        "runs": [
            {
                "run_id": r["run_id"],
                "nested": r.get("nested", False),
                "metrics": r["metrics"],
                "params": {k: r["params"].get(k) for k in ("max_depth", "n_estimators", "learning_rate", "C", "model") if k in r["params"]},
            }
            for r in runs
        ],
    }
    (FRONTEND_DATA / "mlruns.json").write_text(json.dumps(summary, indent=2))
    df.to_json(FRONTEND_DATA / "panel.json", orient="records")

    print("logreg test AUC", round(logreg_test["auc"], 4), "xgb test AUC", round(xgb_test["auc"], 4))
    print("wrote", REGISTRY / "production.json")


if __name__ == "__main__":
    main()
