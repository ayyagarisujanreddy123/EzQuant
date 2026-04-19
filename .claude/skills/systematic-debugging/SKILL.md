---
name: systematic-debugging
description: 4-phase root cause process. Use on any bug, test failure, or unexpected behavior before proposing fixes.
---

# Systematic Debugging

Source: superpowers plugin (claude-plugins-official)

## 4 Phases
1. **REPRODUCE** — confirm bug exists, get minimal repro case
2. **LOCATE** — bisect to smallest failing unit (binary search the call stack)
3. **UNDERSTAND** — explain WHY it fails, not just WHERE
4. **FIX** — change one thing, verify fix doesn't break other tests

## Rules
- Never guess — hypothesize then verify
- One variable at a time
- Read error messages literally before interpreting
- Check recent git changes first (`git log --oneline -10`)

## Hackathon shortcuts
- `console.log` placement: just before and after suspected line
- Check network tab before assuming backend bug
- Verify env vars loaded before debugging logic
