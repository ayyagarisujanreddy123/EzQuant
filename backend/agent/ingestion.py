"""
PDF ingestion for the quant knowledge base.

Flow: PDF → per-page text (pdfplumber) → paragraph-aware chunks →
batch-embed → insert into knowledge_chunks (one row per chunk).

Idempotent: rows already present for the given source_filename are skipped.
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

import pdfplumber

from backend.agent.embeddings import embed_document
from backend.services.supabase_client import get_service_client

logger = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE = 500      # target words per chunk
DEFAULT_OVERLAP = 75          # word overlap between adjacent chunks
DEFAULT_SOURCE_TYPE = "quant_reference"


def extract_text_from_pdf(path: str) -> List[Tuple[int, str]]:
    """Return list of (page_number, page_text). 1-indexed pages. Empty pages skipped."""
    pages: List[Tuple[int, str]] = []
    try:
        with pdfplumber.open(path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                try:
                    text = page.extract_text() or ""
                except Exception as e:
                    logger.warning("pdfplumber failed on %s page %d: %s", path, i, e)
                    text = ""
                text = text.strip()
                if text:
                    pages.append((i, text))
    except Exception as e:
        logger.warning("Could not open %s: %s", path, e)
    return pages


def chunk_text(text: str, chunk_size: int = DEFAULT_CHUNK_SIZE, overlap: int = DEFAULT_OVERLAP) -> List[str]:
    """
    Paragraph-aware word-count chunker.

    Builds a chunk by accumulating paragraphs until the word count crosses
    chunk_size, then overlaps the last `overlap` words into the next chunk.
    Keeps natural paragraph boundaries intact where possible.
    """
    if not text:
        return []
    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    if not paragraphs:
        paragraphs = [text]

    chunks: List[str] = []
    buf: List[str] = []
    buf_words = 0

    for para in paragraphs:
        para_words = para.split()
        # If adding the paragraph would exceed the cap AND we already have
        # something, emit the current chunk.
        if buf and buf_words + len(para_words) > chunk_size:
            chunks.append(" ".join(buf))
            # Start the new chunk with the overlap tail of the previous one.
            if overlap > 0:
                tail = " ".join(buf).split()[-overlap:]
                buf = [" ".join(tail)] if tail else []
                buf_words = len(tail)
            else:
                buf = []
                buf_words = 0
        buf.append(para)
        buf_words += len(para_words)

    if buf:
        chunks.append(" ".join(buf))

    # Hard-split any chunk that still ended up oversized (single huge paragraph).
    hard_split: List[str] = []
    for c in chunks:
        words = c.split()
        if len(words) <= chunk_size * 1.5:
            hard_split.append(c)
            continue
        for i in range(0, len(words), chunk_size - overlap):
            piece = words[i : i + chunk_size]
            if piece:
                hard_split.append(" ".join(piece))
    return hard_split


def _already_ingested(source_filename: str) -> bool:
    sb = get_service_client()
    if sb is None:
        return False
    try:
        res = (
            sb.table("knowledge_chunks")
            .select("id", count="exact")
            .eq("source", source_filename)
            .limit(1)
            .execute()
        )
        return bool(res.data) or (res.count is not None and res.count > 0)
    except Exception as e:
        logger.warning("dup-check failed for %s: %s", source_filename, e)
        return False


def ingest_pdf(
    path: str,
    source_type: str = DEFAULT_SOURCE_TYPE,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
    force: bool = False,
) -> int:
    """
    Ingest one PDF. Returns the number of chunks inserted (0 if skipped).
    """
    p = Path(path)
    source_filename = p.name

    if not force and _already_ingested(source_filename):
        logger.info("Skipping %s — already ingested.", source_filename)
        return 0

    pages = extract_text_from_pdf(str(p))
    if not pages:
        logger.warning("No extractable text in %s — skipping.", source_filename)
        return 0

    # Chunk per page so we keep page_number provenance on every chunk.
    records: List[dict] = []
    chunk_index_global = 0
    for page_number, page_text in pages:
        for piece in chunk_text(page_text, chunk_size=chunk_size, overlap=overlap):
            records.append(
                {
                    "content": piece,
                    "page_number": page_number,
                    "chunk_index": chunk_index_global,
                    "word_count": len(piece.split()),
                }
            )
            chunk_index_global += 1

    if not records:
        logger.warning("No chunks produced for %s", source_filename)
        return 0

    embeddings = embed_document([r["content"] for r in records])
    if len(embeddings) != len(records):
        raise RuntimeError(
            f"Embedding count mismatch for {source_filename}: "
            f"{len(embeddings)} vs {len(records)} chunks"
        )

    sb = get_service_client()
    if sb is None:
        raise RuntimeError("Supabase not configured — cannot persist chunks.")

    rows = []
    for rec, emb in zip(records, embeddings):
        rows.append(
            {
                "source": source_filename,
                "source_type": source_type,
                "content": rec["content"],
                "embedding": emb,
                "metadata": {
                    "source_filename": source_filename,
                    "page_number": rec["page_number"],
                    "chunk_index": rec["chunk_index"],
                    "word_count": rec["word_count"],
                    "source_type": source_type,
                },
            }
        )

    # Insert in chunks to avoid hitting PostgREST payload limits.
    for i in range(0, len(rows), 200):
        sb.table("knowledge_chunks").insert(rows[i : i + 200]).execute()

    logger.info("Ingested %s — %d chunks.", source_filename, len(rows))
    return len(rows)


def ingest_directory(directory: str, **kwargs) -> List[Tuple[str, int, Optional[str]]]:
    """
    Ingest every PDF under `directory`.
    Returns list of (filename, chunks_inserted, error_message_or_None).
    """
    results: List[Tuple[str, int, Optional[str]]] = []
    root = Path(directory)
    if not root.exists():
        raise FileNotFoundError(f"Corpus directory does not exist: {root}")
    pdfs = sorted([p for p in root.rglob("*.pdf")])
    for p in pdfs:
        try:
            n = ingest_pdf(str(p), **kwargs)
            results.append((p.name, n, None))
        except Exception as e:  # don't let one bad PDF kill the run
            logger.exception("Failed to ingest %s", p.name)
            results.append((p.name, 0, f"{type(e).__name__}: {e}"))
    return results


__all__: Iterable[str] = (
    "extract_text_from_pdf",
    "chunk_text",
    "ingest_pdf",
    "ingest_directory",
)
