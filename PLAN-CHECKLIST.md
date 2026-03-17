# PLAN-CHECKLIST.md - Phase Execution Checklist

Use this checklist to execute the roadmap with small, verifiable increments.

## Global Gates (apply to every phase)

- [ ] Scope matches approved phase plan only
- [ ] No changes outside declared in-scope files
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] `pnpm build` passes
- [ ] Dev log updated with evidence block (checks, behavior proof, risks, rollback)

---

## Phase 2 - OAuth Handshake

Plan source: `PLAN-PHASE-2.md`

- [ ] Create `apps/desktop/src/main/oauthManager.ts`
- [ ] Add PKCE helpers (`generateCodeVerifier`, `generateCodeChallenge`)
- [ ] Build and validate Spotify authorize URL
- [ ] Start auth from tray "Connect to Spotify"
- [ ] Register `showerlist` protocol at app startup
- [ ] Handle callback in `open-url` (macOS)
- [ ] Handle callback from argv fallback (`second-instance`)
- [ ] Exchange code for tokens in Main process only
- [ ] Persist tokens through `tokenStore.saveTokens`
- [ ] Handle denied/cancel/timeout/state-mismatch paths
- [ ] Refresh tray menu on success/failure terminal states

Exit criteria:
- [ ] Manual acceptance items in `PLAN-PHASE-2.md` pass

---

## Phase 3 - Spotify Client Package

Plan source: `PLAN-PHASE-3.md`

- [ ] Create `packages/spotify-client/package.json`
- [ ] Create `packages/spotify-client/src/index.ts`
- [ ] Implement typed API wrappers (next/previous/pause/play/getPlayer)
- [ ] Map HTTP 401/403/404 into typed errors
- [ ] Ensure package has no Electron dependency
- [ ] Add unit tests for each endpoint and error mapping

Exit criteria:
- [ ] All Phase 3 tests pass
- [ ] Package can be imported from desktop app without type errors

---

## Phase 4 - Integration and Refresh

Plan source: `PLAN-PHASE-4.md`

- [ ] Wire tray actions to Spotify client commands
- [ ] Add auth bootstrap on startup from stored tokens
- [ ] Add refresh-before-expiry logic
- [ ] Add one-time retry on 401 after refresh
- [ ] Surface user-facing states: connected, no device, premium required, auth failed
- [ ] Prevent concurrent refresh races (single-flight)

Exit criteria:
- [ ] Manual command flow works against active Spotify device
- [ ] Restart reuses tokens and recovers session

---

## Phase 5 - Hardening and Release Readiness

Plan source: `PLAN-PHASE-5.md`

- [ ] Add Vitest config and coverage reporting
- [ ] Add OAuth and integration edge-case tests
- [ ] Add runtime guards for env/config failures
- [ ] Verify protocol behavior in packaged app
- [ ] Complete packaging assets and builder config
- [ ] Run pre-release smoke checklist

Exit criteria:
- [ ] All mechanical checks green
- [ ] Smoke checklist complete
- [ ] Risks and rollback documented in dev log
