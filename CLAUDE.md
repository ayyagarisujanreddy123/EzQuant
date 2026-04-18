# Hackathon Project

## Stack
- Frontend: React + Tailwind + shadcn/ui
- Backend: Node.js / Python (decide per project)
- Memory: claude-mem (auto-captures sessions → `npx claude-mem start`)

## Active Plugins
| Plugin | Purpose | Invoke |
|--------|---------|--------|
| superpowers | Debugging, TDD, parallel agents, plans | `/tdd`, `/debug`, `/parallel` |
| ui-ux-pro-max | Design intelligence, 67 styles, 161 palettes | `/design`, `/ui-ux-pro-max` |
| claude-mem | Persistent memory across sessions | `/mem-search` |

## Workflow
1. `npx claude-mem start` before coding
2. `/writing-plans` → plan feature
3. `/dispatching-parallel-agents` → split independent tasks
4. `/tdd` → implement with red-green-refactor
5. `/verification-before-completion` → verify before done
6. `/finishing-a-development-branch` → PR/merge

## Design Principles
- Mobile-first, accessible (WCAG 2.1 AA)
- Consistent design system (see `.claude/skills/design-system/SKILL.md`)
- Dark mode support
- Use `/ui-ux-pro-max` for any UI component decisions

## Memory
- Worker auto-captures session context
- View: http://localhost:37777
- Search past work: `/mem-search`

## Commands
- `/deploy` → deploy pipeline (`.claude/commands/deploy.md`)
- `/security-review` → run security agent
