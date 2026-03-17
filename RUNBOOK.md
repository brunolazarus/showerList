# RUNBOOK.md — ShowerList Local Development

## Prerequisites

- Node.js 20+
- pnpm 9+
- macOS 13+ (Ventura) — primary dev target
- Spotify Developer account + registered app (see Setup)

## Spotify App Setup (one-time)

1. Go to https://developer.spotify.com/dashboard
2. Create app → set Redirect URI to `showerlist://callback`
3. Copy **Client ID** (no secret needed for PKCE)
4. Create `.env` at repo root (never commit):
   ```
   SPOTIFY_CLIENT_ID=your_client_id_here
   ```

## Install & Run

```bash
pnpm install
pnpm --filter desktop dev      # starts Electron in dev mode
```

## Type Check

```bash
pnpm typecheck
```

## Test

```bash
pnpm test                      # vitest
pnpm test --coverage
```

## Build (no package, just verify)

```bash
pnpm --filter desktop build:check
```

## Package for macOS

```bash
pnpm --filter desktop package  # outputs to apps/desktop/dist/
```

## Reset Auth

Delete `~/.config/showerlist/tokens` to force re-auth.

## Common Issues

| Symptom | Fix |
|---|---|
| "No active device" | Open Spotify on any device and play something first |
| 401 after login | Token may be corrupt — reset auth above |
| OAuth callback not caught | Confirm `showerlist://` is registered — restart app and retry |
| Commands fail silently | Confirm account is Premium |
