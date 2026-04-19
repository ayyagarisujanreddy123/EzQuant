"""
EzQuant agentic-RAG copilot package.

  embeddings.py   — Gemini text-embedding-004 (task-typed)
  ingestion.py    — PDF → chunks → embeddings → knowledge_chunks
  retrieval.py    — query embed → match_doc_chunks RPC → ranked chunks
  tools.py        — @register'd tools (search_knowledge, suggest_pipeline_template)
  prompts.py      — system prompts per mode
  orchestrator.py — Gemini function-calling loop, SSE events
"""
