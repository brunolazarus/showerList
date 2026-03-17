# AGENTS.md — Operational Rules for AI Agents

**CLAUDE.md is the canonical source of truth for project context.**
Read CLAUDE.md before this file.

## Role Contract

This project uses a 3-role workflow:
- **Planner** — defines scope and invariants. Read-only. Produces PLAN.md.
- **Implementer** — writes the smallest correct diff. Follows PLAN.md strictly.
- **Red-Team Reviewer** — adversarially reviews diffs. Clean session. No approvals.

Do not act as more than one role in the same session.

## Implementer Rules

1. Read PLAN.md before touching any file.
2. Implement only the current phase step. Stop when done.
3. Follow existing patterns — do not introduce new abstractions unless the plan says so.
4. After each validated step, note a checkpoint.
5. Never expand scope silently.

## Validation Steps (run before declaring done)

```bash
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint
pnpm test            # vitest run
pnpm build           # electron-builder --dir (no package, just verify)
```

## Hard Boundaries

- NEVER modify `packages/spotify-client` to import from Electron
- NEVER store tokens outside `safeStorage`
- NEVER open external URLs without validating the origin is `accounts.spotify.com` or `api.spotify.com`
- NEVER add OAuth scopes beyond the approved set in ARCHITECTURE.md

## Out of Scope for AI Agents

- Approving or merging PRs
- Modifying `.env.example` to include real values
- Changing `electron-builder` signing configuration
- Publishing or distributing the app
