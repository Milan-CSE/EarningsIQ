"""Embedding pipeline.

Production: BAAI/bge-large-en-v1.5 dense vectors in pgvector, BM25 via
Postgres FTS or rank_bm25, rerank with BAAI/bge-reranker-large.
This environment uses the TypeScript TF-IDF + BM25 hybrid in
src/lib/research/retrieve.ts as the fixture stand-in so we do not download
a 1GB encoder at request time.
"""
