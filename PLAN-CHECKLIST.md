# PLAN-CHECKLIST.md - Phase Execution Checklist

Use this checklist to execute the roadmap with small, verifiable increments.

## Global Gates (apply to every phase)

- [x] Scope matches approved phase plan only
- [x] No changes outside declared in-scope files
- [x] `pnpm typecheck` passes
- [x] `pnpm lint` passes
- [x] `pnpm test` passes
- [x] `pnpm build` passes
- [x] Dev log updated with evidence block (checks, behavior proof, risks, rollback)

---

## Phase 2 - OAuth Handshake

Plan source: `PLAN-PHASE-2.md`

- [x] Create `apps/desktop/src/main/oauthManager.ts`
- [x] Add PKCE helpers (`generateCodeVerifier`, `generateCodeChallenge`)
- [x] Build and validate Spotify authorize URL
- [x] Start auth from tray "Connect to Spotify"
- [x] Register `showerlist` protocol at app startup
- [x] Handle callback in `open-url` (macOS)
- [x] Handle callback from argv fallback (`second-instance`)
- [x] Exchange code for tokens in Main process only
- [x] Persist tokens through `tokenStore.saveTokens`
- [x] Handle denied/cancel/timeout/state-mismatch paths
- [x] Refresh tray menu on success/failure terminal states

Exit criteria:

- [ ] Manual acceptance items in `PLAN-PHASE-2.md` pass

---

## Phase 3 - Spotify Client Package

Plan source: `PLAN-PHASE-3.md`

- [x] Create `packages/spotify-client/package.json`
- [x] Create `packages/spotify-client/src/index.ts`
- [x] Implement typed API wrappers (next/previous/pause/play/getPlayer)
- [x] Map HTTP 401/403/404 into typed errors
- [x] Ensure package has no Electron dependency
- [x] Add unit tests for each endpoint and error mapping

Exit criteria:

- [x] All Phase 3 tests pass
- [x] Package can be imported from desktop app without type errors

---

## Phase 4 - Integration and Refresh

Plan source: `PLAN-PHASE-4.md`

- [x] Wire tray actions to Spotify client commands
- [x] Add auth bootstrap on startup from stored tokens
- [x] Add refresh-before-expiry logic
- [x] Add one-time retry on 401 after refresh
- [x] Surface user-facing states: connected, no device, premium required, auth failed
- [x] Prevent concurrent refresh races (single-flight)

Exit criteria:

- [ ] Manual command flow works against active Spotify device
- [ ] Restart reuses tokens and recovers session

---

## Phase 5 - Hardening and Release Readiness

Plan source: `PLAN-PHASE-5.md`

- [x] Add Vitest config and coverage reporting
- [x] Add OAuth and integration edge-case tests
- [x] Add runtime guards for env/config failures
- [ ] Verify protocol behavior in packaged app
- [x] Complete packaging assets and builder config
- [ ] Run pre-release smoke checklist

Exit criteria:

- [x] All mechanical checks green
- [ ] Smoke checklist complete
- [x] Risks and rollback documented in dev log

---

## Phase 6 - Voice App Foundation

Plan source: `PLAN-PHASE-6.md`

- [x] Create `apps/voice/package.json`
- [x] Create `apps/voice/tsconfig.json`
- [x] Create `apps/voice/src/index.ts`
- [x] Create `apps/voice/src/ipc.ts`
- [x] Create `apps/voice/src/audio/capture.ts`
- [x] Create `apps/voice/src/audio/ringBuffer.ts`
- [x] Keep `pnpm-workspace.yaml` compatible (`apps/*` already includes `apps/voice`)
- [x] Use stdout line-delimited JSON IPC only
- [x] Capture mic PCM at 48kHz/16-bit/stereo and frame into 480-sample chunks
- [x] Ensure `rec` runtime prerequisite is available in PATH

Exit criteria:

- [x] `pnpm --filter @showerlist/voice build` succeeds
- [x] `pnpm typecheck` passes across all packages
- [x] `command -v rec` returns a valid executable path
- [x] Running `node apps/voice/dist/index.js` starts without crash
- [x] Stdout emits `{"type":"status","state":"idle"}` on startup
