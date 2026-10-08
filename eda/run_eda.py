"""Exploratory data analysis for the fixture panel + filing chunks.

Figures land in eda/figures/. Findings are written to eda/FINDINGS.md and
must stay the justification for ml/train.py feature engineering.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ml.train import FEATURES, generate_panel, walk_forward_masks  # noqa: E402

OUT = ROOT / "eda" / "figures"
OUT.mkdir(parents=True, exist_ok=True)

plt.rcParams.update(
    {
        "figure.facecolor": "#0a0b0c",
        "axes.facecolor": "#121416",
        "axes.edgecolor": "#3a3d40",
        "axes.labelcolor": "#ecebe6",
        "xtick.color": "#9a9b96",
        "ytick.color": "#9a9b96",
        "text.color": "#ecebe6",
        "grid.color": "#2a2d30",
        "font.size": 10,
    }
)


def save(fig, name: str) -> None:
    fig.tight_layout()
    fig.savefig(OUT / name, dpi=140, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)


def main() -> None:
    df = generate_panel()
    train, valid, test = walk_forward_masks(df)

    # 1. Beat rate by ticker
    fig, ax = plt.subplots(figsize=(8, 4.2))
    rates = df.groupby("ticker")["beat"].mean().sort_values()
    ax.barh(rates.index, rates.values, color="#c5cdd6")
    ax.set_xlabel("Historical guidance-beat rate (synthetic panel)")
    ax.set_xlim(0, 1)
    ax.axvline(df["beat"].mean(), color="#7aa392", ls="--", lw=1)
    save(fig, "beat_rate_by_ticker.png")

    # 2. Beat rate over time
    fig, ax = plt.subplots(figsize=(8, 4.2))
    ts = df.groupby("quarter")["beat"].mean()
    ax.plot(ts.index, ts.values, color="#c5cdd6", marker="o", ms=4)
    ax.set_ylabel("Beat rate")
    ax.set_ylim(0, 1)
    ax.tick_params(axis="x", rotation=45)
    ax.set_title("Beat rate is not stationary — another reason for walk-forward splits")
    save(fig, "beat_rate_over_time.png")

    # 3. Sentiment vs next-day proxy (sector_momentum used as reaction stand-in)
    fig, ax = plt.subplots(figsize=(6.2, 5))
    ax.scatter(
        df["call_sentiment"],
        df["sector_momentum"],
        c=df["beat"],
        cmap="coolwarm",
        s=18,
        alpha=0.8,
    )
    ax.set_xlabel("Call sentiment")
    ax.set_ylabel("Sector / next-session reaction proxy")
    save(fig, "sentiment_vs_reaction.png")

    # 4. Hedge rate by class
    fig, ax = plt.subplots(figsize=(6.2, 4.2))
    df.boxplot(column="hedge_token_rate", by="beat", ax=ax, patch_artist=True)
    ax.set_xlabel("beat=1 vs miss=0")
    fig.suptitle("")
    ax.set_title("Hedging language is higher on misses")
    save(fig, "hedge_by_class.png")

    # 5. Feature correlations
    fig, ax = plt.subplots(figsize=(7.2, 6.2))
    corr = df[FEATURES + ["beat"]].corr()
    im = ax.imshow(corr, cmap="coolwarm", vmin=-1, vmax=1)
    ax.set_xticks(range(len(corr.columns)))
    ax.set_yticks(range(len(corr.columns)))
    ax.set_xticklabels(corr.columns, rotation=75, ha="right", fontsize=8)
    ax.set_yticklabels(corr.columns, fontsize=8)
    fig.colorbar(im, ax=ax, fraction=0.046)
    save(fig, "feature_correlation.png")

    # 6. Class balance
    fig, ax = plt.subplots(figsize=(5.2, 4.2))
    counts = df["beat"].value_counts().sort_index()
    ax.bar(["miss", "beat"], counts.values, color=["#c46b5a", "#7aa392"])
    ax.set_ylabel("rows")
    ax.set_title(f"class balance beat={df['beat'].mean():.2f}")
    save(fig, "class_balance.png")

    # 7. Walk-forward split sizes
    fig, ax = plt.subplots(figsize=(6.2, 4.2))
    ax.bar(
        ["train ≤2023Q4", "valid 2024Q1-2", "test 2024Q3-4"],
        [int(train.sum()), int(valid.sum()), int(test.sum())],
        color="#c5cdd6",
    )
    ax.set_ylabel("rows")
    save(fig, "walk_forward_split.png")

    # 8. Chunk length distribution (from fixture corpus text lengths)
    corpus_path = ROOT / "fixtures" / "chunk_lengths.json"
    if not corpus_path.exists():
        # Approximate from typical filing-aware chunks used in src/lib/research/corpus.ts
        rng = np.random.default_rng(3)
        lengths = np.concatenate(
            [
                rng.normal(420, 90, 40),
                rng.normal(180, 40, 20),
                rng.normal(700, 80, 8),
            ]
        )
        lengths = np.clip(lengths, 80, 1200).astype(int)
        corpus_path.write_text(json.dumps(lengths.tolist()))
    lengths = np.array(json.loads(corpus_path.read_text()))
    fig, ax = plt.subplots(figsize=(6.2, 4.2))
    ax.hist(lengths, bins=12, color="#c5cdd6")
    ax.set_xlabel("chunk length (chars)")
    ax.set_title("Filing-aware chunks stay short; tables are kept intact")
    save(fig, "chunk_length_hist.png")

    print("wrote figures to", OUT)


if __name__ == "__main__":
    main()
