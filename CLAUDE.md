# CLAUDE.md — ShowerList: Spotify Voice Controller

**Canonical AI context for this repository. Read this first.**

## Project Purpose

ShowerList is a personal desktop companion app that sends voice commands to Spotify
(skip, previous, pause/play) — designed to work in noisy environments.
This is an AI-workflow workshop project: the codebase intentionally demonstrates
structured AI-assisted development.

## Architecture in One Line

Local Electron tray app → Spotify Web API (PKCE OAuth, no server).

## Parts

| Part | Status | Location |
|------|--------|----------|
| Desktop companion (tray + API) | Planning | `apps/desktop/` |
| Voice input pipeline | Not started | `apps/voice/` |
| Shared Spotify client | Not started | `packages/spotify-client/` |

## Tech Stack

- Runtime: Electron (Node.js main process)
- Language: TypeScript (strict mode)
- Auth: PKCE Authorization Code Flow (no client secret)
- Token storage: Electron `safeStorage` → OS keychain
- Spotify API: REST via `fetch` or `got`
- Packaging: `electron-builder` (.dmg for macOS)
- Package manager: pnpm (workspaces)

## Critical Constraints

- Spotify playback control requires **Premium** on the active account
- The active Spotify device must exist at call time — handle 404/no device gracefully
- NEVER store tokens in plaintext on disk — use `safeStorage` only
- NEVER commit `.env` files, tokens, or client IDs to the repo

## Directory Responsibilities

- `apps/desktop/src/main/` — Electron main process: tray, OAuth, API orchestration
- `apps/desktop/src/renderer/` — Optional settings UI (keep minimal)
- `apps/desktop/src/shared/` — Shared types and constants only
- `packages/spotify-client/` — Pure Spotify REST wrapper, no Electron dependency

## Code Conventions

- Strict TypeScript: `"strict": true`, no `any`
- Errors are typed — use `Result<T, E>` or discriminated unions, not thrown strings
- No class hierarchies — prefer plain functions and modules
- All async is `async/await` — no raw Promise chains
- Tests: Vitest

## Forbidden Patterns

- No plaintext token storage (localStorage, flat files)
- No `eval`, no dynamic `require` with user input
- No `shell.openExternal` with unvalidated URLs
- No broad OAuth scopes beyond the three listed in ARCHITECTURE.md
- Do not modify `packages/spotify-client` to have Electron dependencies
