# PLAN.md — Desktop Companion App (Part 1)

## Objective

Build a macOS system tray app that authenticates with Spotify via PKCE and
exposes three playback commands: skip, previous, pause/play.

## Scope

**In scope:**

- Electron tray app with minimal menu UI
- PKCE OAuth flow (open browser → custom URL callback `showerlist://callback` → token exchange)
- Token persistence via Electron `safeStorage`
- Spotify playback commands: next, previous, pause, play
- Active device detection with user-facing error when no device found
- Auto token refresh on 401

**Out of scope (Part 2):**

- Voice input, command detection, noise pipeline
- Windows/Linux support
- Auto-update / app signing
- Settings UI / preferences window

## Invariants

- Tokens are never stored in plaintext
- No external URL is opened except to `accounts.spotify.com`
- No network request is made to any host except `api.spotify.com` and `accounts.spotify.com`
- Renderer process never holds tokens

## Failure Modes

| Failure                                | Handling                                                          |
| -------------------------------------- | ----------------------------------------------------------------- |
| No active Spotify device               | Show tray tooltip: "No active Spotify device"                     |
| Token expired                          | Auto-refresh silently, retry once, surface error if refresh fails |
| User not Premium                       | 403 from API → show "Premium required" in menu                    |
| OAuth window closed without completing | Timeout after 5 min, deregister protocol handler                  |

## Rollback

Since this is a local desktop app with no server, rollback = `git checkout` to last
working commit + delete `~/.config/showerlist/tokens`.

## Acceptance Tests

- [ ] Fresh install: OAuth flow completes, tray icon appears
- [ ] "Skip" command advances track on active Spotify device
- [ ] "Previous" returns to previous track
- [ ] "Pause" pauses, "Play" resumes
- [ ] Restarting app reuses existing tokens (no re-auth required)
- [ ] No active device: error shown in menu, no crash
- [ ] Token expiry: silent refresh, no user interruption

## Phases

Execution checklist: `PLAN-CHECKLIST.md`

### Phase 1 — Scaffold

- Monorepo with pnpm workspaces
- `apps/desktop` Electron + TypeScript skeleton
- Tray icon with static menu
- `.env` loading, `safeStorage` wrapper

### Phase 2 — OAuth

- `OAuthManager`: PKCE generation, browser open via `shell.openExternal`
- Custom URL scheme (`showerlist://callback`) via `app.setAsDefaultProtocolClient`
- macOS `open-url` event handler to receive the auth code
- Token exchange + storage

### Phase 3 — Spotify Client

- `packages/spotify-client`: typed REST wrapper
- Endpoints: next, previous, pause, play, current player state
- Detailed plan: `PLAN-PHASE-3.md`

### Phase 4 — Integration

- Wire tray menu → commands → API
- Error states in tray menu
- Token auto-refresh middleware
- Detailed plan: `PLAN-PHASE-4.md`

### Phase 5 — Hardening

- Port conflict handling
- OAuth timeout cleanup
- Vitest unit tests for OAuth manager and client
- Detailed plan: `PLAN-PHASE-5.md`
