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

### `apps/desktop/src/main/oauthManager.ts` (Phase 2 — tests implemented in Phase 5)

> See `apps/desktop/src/main/oauthManager.test.ts`

| Test                                                                  | Type                | Status |
| --------------------------------------------------------------------- | ------------------- | ------ |
| `generateCodeVerifier` returns 43-char base64url string               | Unit                | ✅ done |
| `generateCodeChallenge` returns correct SHA-256 base64url of verifier | Unit                | ✅ done |
| `buildAuthUrl` includes all required params and correct scopes        | Unit                | ✅ done |
| `handleCallback` rejects wrong scheme (e.g. `http://`)                | Unit                | ✅ done |
| `handleCallback` rejects mismatched `state`                           | Unit                | ✅ done |
| `handleCallback` rejects missing `code` param                         | Unit                | ✅ done |
| `handleCallback` parses valid callback URL and calls token exchange   | Unit (fetch mocked) | ✅ done |
| Auth timeout clears `pendingAuth` after 5 min                         | Unit (fake timers)  | ✅ done |

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

`vitest.config.ts` — created at repo root in Phase 5 ✅

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

---

## Voice Pipeline (`apps/voice/`) — Phase 11

### Unit Tests

#### `apps/voice/src/activation/clapDetector.test.ts`

| Test | Status |
| ---- | ------ |
| Single clap → `onSingleClap` fires after 600ms | ✅ done |
| Double clap 300ms gap → `onDoubleClap` fires, `onSingleClap` does not | ✅ done |
| Double clap gap > 600ms → `onSingleClap` fires twice | ✅ done |
| Double clap gap < 150ms → `onSingleClap` fires once (second clap) | ✅ done |
| Second clap within 2s cooldown → ignored | ✅ done |
| Low-amplitude frames below threshold → no event | ✅ done |

#### `apps/voice/src/recognition/commandMatcher.test.ts`

| Test | Status |
| ---- | ------ |
| Exact match: `"skip"` → `"skip"` | ✅ done |
| Normalised: `"NEXT!"` → `"skip"` | ✅ done |
| Substring: `"please skip this track"` → `"skip"` | ✅ done |
| Levenshtein 1: `"nxt"` → `"skip"` | ✅ done |
| Levenshtein 1: `"bak"` → `"previous"` | ✅ done |
| Levenshtein 1: `"rezume"` → `"play"` | ✅ done |
| Unrelated input → `null` | ✅ done |
| `"stop and play"` → `"pause"` (first alias wins) | ✅ done |
| All primary aliases from `aliases.ts` → correct command | ✅ done |

#### `apps/voice/src/recognition/asr.test.ts`

| Test | Status |
| ---- | ------ |
| `transcribe()` lowercases model output | ✅ done |
| Uses `VOICE_MODEL_CACHE` env var for cache dir | ✅ done |
| Falls back to `os.tmpdir()` when env var not set | ✅ done |
| Reuses cached pipeline across calls | ✅ done |

### Integration Test (manual)

Run the pipeline on a real voice WAV in shower background noise:

```bash
cd apps/voice && pnpm test-pipeline <input.wav> <output.wav>
```

Inspect the output WAV; verify the dispatched command matches the spoken word.

### Latency Benchmark

```bash
cd apps/voice && pnpm benchmark
```

Reports pipeline init time, per-frame processing time, VAD latency, and ASR latency.
Target: < 1000ms total on Apple M1.

---

## What Is Not Tested by Automation

| Area                             | Why                             | Mitigation             |
| -------------------------------- | ------------------------------- | ---------------------- |
| Tray icon rendering              | Requires display server         | Manual verification    |
| Full OAuth browser flow          | Requires Spotify + browser      | Manual acceptance test |
| macOS `open-url` event           | Requires running Electron       | Manual acceptance test |
| `safeStorage` with real keychain | Requires macOS Electron context | Manual smoke test      |

---

## Manual Voice Smoke Tests (run before merging any voice phase)

- [ ] Double-clap with water running → Spotify command executes
- [ ] Say wake word → tray shows "Listening…" → say "next" → track skips
- [ ] Say unrecognised word → no command fired, tray returns to idle
- [ ] Voice enabled on restart → voice process starts automatically
- [ ] Voice process killed externally → desktop logs error, tray reflects state
- [ ] First launch with no cached model → model downloads, command works after

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
