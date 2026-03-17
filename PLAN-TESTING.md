# PLAN-TESTING.md — Test Strategy

> Covers the full app lifecycle. Updated as phases are implemented.

## Philosophy

- Unit test pure logic (PKCE helpers, token parsing, URL builders)
- Integration tests for the Spotify client against a mock HTTP server
- No Electron instance in tests — main process is tested via imported modules
- Tests run headless in CI via `vitest run`

---

## Test Runner

**Vitest** — already in root devDependencies.

```bash
pnpm test               # all tests
pnpm test --coverage    # with coverage report
pnpm test --watch       # during development
```

---

## Coverage Targets by Module

### `apps/desktop/src/main/oauthManager.ts` (Phase 2)

| Test                                                                  | Type                |
| --------------------------------------------------------------------- | ------------------- |
| `generateCodeVerifier` returns 43-char base64url string               | Unit                |
| `generateCodeChallenge` returns correct SHA-256 base64url of verifier | Unit                |
| `buildAuthUrl` includes all required params and correct scopes        | Unit                |
| `handleCallback` rejects wrong scheme (e.g. `http://`)                | Unit                |
| `handleCallback` rejects mismatched `state`                           | Unit                |
| `handleCallback` rejects missing `code` param                         | Unit                |
| `handleCallback` parses valid callback URL and calls token exchange   | Unit (fetch mocked) |
| Auth timeout clears `pendingAuth` after 5 min                         | Unit (fake timers)  |

### `packages/spotify-client/` (Phase 3)

| Test                                                            | Type                |
| --------------------------------------------------------------- | ------------------- |
| `next()` calls `POST /v1/me/player/next` with Bearer token      | Unit (fetch mocked) |
| `previous()` calls `POST /v1/me/player/previous`                | Unit (fetch mocked) |
| `pause()` calls `PUT /v1/me/player/pause`                       | Unit (fetch mocked) |
| `play()` calls `PUT /v1/me/player/play`                         | Unit (fetch mocked) |
| 204 response returns `{ ok: true }`                             | Unit                |
| 404 response returns `{ ok: false, error: 'no_active_device' }` | Unit                |
| 401 response returns `{ ok: false, error: 'unauthorized' }`     | Unit                |
| 403 response returns `{ ok: false, error: 'premium_required' }` | Unit                |

### `apps/desktop/src/main/tokenStore.ts` (Phase 1 — testable in Phase 5)

> `safeStorage` requires an Electron context. Tests use a manual mock.

| Test                                                     | Type                      |
| -------------------------------------------------------- | ------------------------- |
| `saveTokens` → `loadTokens` round-trip returns same data | Unit (safeStorage mocked) |
| `loadTokens` returns `{ ok: false }` when no file exists | Unit                      |
| `clearTokens` removes the token file                     | Unit                      |

### Token refresh (Phase 4)

| Test                                                                 | Type                |
| -------------------------------------------------------------------- | ------------------- |
| `refreshAccessToken` calls token endpoint with `refresh_token` grant | Unit (fetch mocked) |
| Returns updated `TokenData` with new `expiresAt`                     | Unit                |
| Returns `{ ok: false }` on HTTP error                                | Unit                |

---

## Vitest Config

Create `vitest.config.ts` at repo root in Phase 5:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["apps/**/src/**/*.test.ts", "packages/**/src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["apps/**/src/**/*.ts", "packages/**/src/**/*.ts"],
      exclude: ["**/*.test.ts"],
    },
  },
});
```

---

## What Is Not Tested by Automation

| Area                             | Why                             | Mitigation             |
| -------------------------------- | ------------------------------- | ---------------------- |
| Tray icon rendering              | Requires display server         | Manual verification    |
| Full OAuth browser flow          | Requires Spotify + browser      | Manual acceptance test |
| macOS `open-url` event           | Requires running Electron       | Manual acceptance test |
| `safeStorage` with real keychain | Requires macOS Electron context | Manual smoke test      |

---

## Manual Acceptance Checklist (run before merging any phase to `dev`)

- [ ] `pnpm typecheck` — clean
- [ ] `pnpm test` — all pass
- [ ] App launches, tray icon appears in menu bar
- [ ] "Connect to Spotify…" opens browser to accounts.spotify.com
- [ ] Completing OAuth returns to app, tray updates to "Connected"
- [ ] Skip / Previous / Pause-Play work on an active Spotify device
- [ ] App restart reuses stored tokens (no re-auth prompt)
- [ ] No active device: menu shows error, no crash
