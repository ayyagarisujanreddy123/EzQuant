---
name: tdd
description: Red-Green-Refactor cycle. Use before writing any feature or bugfix implementation.
---

# Test-Driven Development

Source: superpowers plugin (claude-plugins-official)

## Cycle
1. **RED** — write failing test that describes desired behavior
2. **GREEN** — write minimal code to pass test
3. **REFACTOR** — clean up, no new behavior

## Rules
- Never write implementation before test
- One failing test at a time
- If test is hard to write → design problem, not test problem
- Tests are documentation

## Anti-patterns to avoid
- Testing implementation details (test behavior, not internals)
- Mocking everything (integration > isolation for critical paths)
- Skipping refactor step
