#!/usr/bin/env python3
"""
Ingest every PDF under a directory into Supabase knowledge_chunks.

Usage:
    python scripts/ingest_corpus.py --path backend/corpus/pdfs
    python scripts/ingest_corpus.py --path backend/corpus/pdfs --force
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Make 'backend' importable when run from repo root.
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.agent.ingestion import ingest_directory  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingest PDFs into knowledge_chunks.")
    ap.add_argument("--path", required=True, help="Directory containing PDFs (recursively).")
    ap.add_argument(
        "--source-type",
        default="quant_reference",
        help="Value stored in knowledge_chunks.source_type (default: quant_reference).",
    )
    ap.add_argument("--force", action="store_true", help="Re-ingest files already in the DB.")
    ap.add_argument("--chunk-size", type=int, default=500)
    ap.add_argument("--overlap", type=int, default=75)
    args = ap.parse_args()

    results = ingest_directory(
        args.path,
        source_type=args.source_type,
        chunk_size=args.chunk_size,
        overlap=args.overlap,
        force=args.force,
    )

    print()
    print(f"{'FILE':<60} {'CHUNKS':>8}  STATUS")
    print("-" * 90)
    inserted = 0
    failures = 0
    for name, n, err in results:
        status = "OK" if err is None else f"FAILED · {err[:50]}"
        print(f"{name:<60} {n:>8}  {status}")
        inserted += n
        if err is not None:
            failures += 1
    print("-" * 90)
    print(f"TOTAL: {inserted} chunks inserted across {len(results)} files ({failures} failures)")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
