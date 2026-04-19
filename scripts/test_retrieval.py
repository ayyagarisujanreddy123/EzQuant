#!/usr/bin/env python3
"""
Smoke-test `retrieve_context` against 10 canonical quant queries.

Usage:
    python scripts/test_retrieval.py
    python scripts/test_retrieval.py --k 3            # show top-3 per query
    python scripts/test_retrieval.py --threshold 0.6  # tighten similarity floor
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.agent.retrieval import retrieve_context  # noqa: E402


CANONICAL_QUERIES = [
    "What is the Information Coefficient and why does it matter?",
    "How do I compute the Sharpe ratio and what is a good value?",
    "Explain the difference between price momentum and returns momentum.",
    "What is overfitting in backtesting and how do I detect it?",
    "Describe the Kelly criterion and when to use fractional Kelly.",
    "What are Fama-French factor models?",
    "How does an exponential moving average differ from a simple moving average?",
    "What is lookahead bias and what are common sources of it?",
    "How should I choose a lookback window for a momentum signal?",
    "Explain IC decay and what the decay curve tells us about a signal.",
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--k", type=int, default=5, help="Top-K chunks to show (default 5).")
    ap.add_argument("--threshold", type=float, default=0.5, help="Similarity floor (default 0.5).")
    args = ap.parse_args()

    for q in CANONICAL_QUERIES:
        print("=" * 100)
        print(f"QUERY: {q}")
        try:
            chunks = retrieve_context(q, k=args.k, match_threshold=args.threshold)
        except Exception as e:
            print(f"  ERROR: {e}")
            continue
        if not chunks:
            print("  (no matches — either corpus empty or threshold too tight)")
            continue
        for i, c in enumerate(chunks, start=1):
            src = c.get("source") or "?"
            page = (c.get("metadata") or {}).get("page_number")
            sim = c.get("similarity", 0.0)
            snippet = (c.get("content") or "").strip().replace("\n", " ")[:220]
            print(f"  [{i}] sim={sim:.3f}  {src}" + (f" · p.{page}" if page else ""))
            print(f"      {snippet}…")
        print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
