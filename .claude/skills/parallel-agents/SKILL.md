---
name: dispatching-parallel-agents
description: Use when 2+ independent tasks have no shared state or sequential dependencies. Hackathon speed multiplier.
---

# Dispatching Parallel Agents

Source: superpowers plugin (claude-plugins-official)

## When to use
- Feature has independent frontend + backend work
- Multiple components that don't share state
- Running tests + linting + type-check simultaneously
- Writing docs while implementing

## Pattern
```
Task A (independent) ─┐
Task B (independent) ─┼─→ merge results
Task C (independent) ─┘
```

## Rules
- Tasks must NOT write to same files
- Tasks must NOT depend on each other's output
- Merge/integrate after all complete
- Use worktrees for large parallel branches (`/using-git-worktrees`)

## Hackathon use cases
- Agent 1: Build UI component
- Agent 2: Build API endpoint
- Agent 3: Write tests
→ All run simultaneously → 3x speed
