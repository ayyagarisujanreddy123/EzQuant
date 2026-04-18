---
name: mem-search
description: Search persistent memory from past sessions. Use when recalling prior decisions, code patterns, or context from previous work.
---

# Memory Search

Source: claude-mem plugin (thedotmack, v12.1.6)

## Prerequisites
Worker must be running: `npx claude-mem start`
View UI: http://localhost:37777

## Search commands
```
/mem-search [query]           — natural language search
/timeline                     — chronological view around specific observations  
/smart-explore [topic]        — token-optimized structural search
```

## MCP tools (auto-available when worker running)
- `search` — full-text with type/date/project filters
- `timeline` — context around observation IDs
- `get_observations` — full details by ID

## What gets captured automatically
- Files edited
- Commands run
- Decisions made
- Errors encountered + fixes
- Feature implementations

## Restart worker after reboot
```bash
npx claude-mem start
```
