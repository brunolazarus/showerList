# PLAN-PHASE-2.md — OAuth Manager

> **Planner phase artifact.** Read by the Implementer before touching any file.
> Parent plan: `PLAN.md` — Phase 2.

## Objective

Implement the full PKCE OAuth flow using a custom URL scheme (`showerlist://callback`)
so the app can authenticate with Spotify without any local HTTP server.

After this phase the app must:

1. Open the Spotify auth screen in the system browser when "Connect to Spotify…" is clicked.
2. Receive the authorization code back via the `showerlist://callback` deep link.
3. Exchange the code for tokens and persist them via the existing `tokenStore`.
4. Refresh the tray menu to reflect the connected state.

---

## Files in Scope

| Action     | File                                                                   |
| ---------- | ---------------------------------------------------------------------- |
| **Create** | `apps/desktop/src/main/oauthManager.ts`                                |
| **Modify** | `apps/desktop/src/main/index.ts` — wire `open-url`, connect menu click |
| **Modify** | `apps/desktop/src/shared/types.ts` — add `OAuthState` type if needed   |

## Files Out of Scope

- `packages/spotify-client/` — created in Phase 3
- `tokenStore.ts` — already complete, use as-is
- Any renderer / UI files

---

## Invariants

- `code_verifier` is generated fresh per OAuth attempt and never persisted
- `state` parameter is validated on callback to prevent CSRF
- `showerlist://` is only registered while an auth attempt is in flight (or always — see note below)
- Tokens flow only through `tokenStore.saveTokens` — never logged or passed to renderer
- `shell.openExternal` is called only with a URL that starts with `https://accounts.spotify.com/authorize`

> **Note on protocol registration:** `app.setAsDefaultProtocolClient` should be called
> once at app startup (not just during auth). macOS requires the app to be registered
> before the browser redirect fires. Deregistration is not needed.

---

## Implementation Steps

### Step 1 — PKCE helpers (pure functions, easy to unit test)

In `oauthManager.ts`:

```ts
generateCodeVerifier(): string
  // 32 random bytes → base64url, no padding

generateCodeChallenge(verifier: string): Promise<string>
  // SHA-256 of verifier → base64url
```

Use Node.js `crypto` module only (`randomBytes`, `createHash`). No external deps.

### Step 2 — Build the authorization URL

```ts
buildAuthUrl(params: {
  clientId: string
  redirectUri: string    // 'showerlist://callback'
  codeChallenge: string
  state: string
}): string
```

Full URL to `https://accounts.spotify.com/authorize` with scopes from `ARCHITECTURE.md`.

### Step 3 — Start an OAuth attempt

```ts
startAuth(clientId: string): Promise<void>
```

1. Generate `codeVerifier`, `codeChallenge`, `state` (random, stored in module-level `pendingAuth`)
2. Call `shell.openExternal(authUrl)` — validated to start with `https://accounts.spotify.com/authorize`
3. Set a 5-minute timeout; on expiry clear `pendingAuth` and surface error in tray

### Step 4 — Handle the callback

```ts
handleCallback(callbackUrl: string): Promise<Result<void>>
```

Called from `app.on('open-url')` in `index.ts`.

1. Parse URL — reject if scheme is not `showerlist:` or path is not `/callback`
2. Extract `code` and `state` from search params
3. Validate `state` matches `pendingAuth.state` — reject mismatches (CSRF guard)
4. POST to `https://accounts.spotify.com/api/token` with:
   - `grant_type: authorization_code`
   - `code`
   - `redirect_uri: showerlist://callback`
   - `client_id`
   - `code_verifier`
5. Parse response → `TokenData` (compute `expiresAt = Date.now() + expires_in * 1000`)
6. Call `tokenStore.saveTokens(data)`
7. Clear `pendingAuth`
8. Return `Result<void>`

### Step 5 — Wire into index.ts

- `app.setAsDefaultProtocolClient('showerlist')` — called once in `app.whenReady()`
- `app.on('open-url', (_, url) => handleCallback(url))` — macOS deep link handler
- `app.on('second-instance', (_, argv) => ...)` — Windows/Linux fallback (deep link comes via argv)
- Tray "Connect to Spotify…" click → `startAuth(clientId)`
- After `handleCallback` resolves → call `refreshMenu()` to update tray

---

## Token Refresh (stub only — full impl in Phase 4)

Do **not** implement auto-refresh in this phase. Add only:

```ts
export async function refreshAccessToken(
  clientId: string,
): Promise<Result<TokenData>>;
```

Signature only, body `throw new Error('Not implemented — Phase 4')`.
This allows Phase 3 (Spotify client) to reference the type without blocking.

---

## Failure Modes

| Failure                                   | Handling                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------- |
| `state` mismatch on callback              | Return `{ ok: false, error: 'state_mismatch' }`, log, clear `pendingAuth` |
| Token exchange HTTP error                 | Return `{ ok: false, error: responseBody }`, surface in tray              |
| `shell.openExternal` URL fails validation | Throw — this is a programming error, not a runtime condition              |
| 5-minute auth timeout                     | Clear `pendingAuth`, update tray: "Auth timed out — try again"            |
| `safeStorage` unavailable                 | Surfaced by `tokenStore` — propagate error to tray                        |

---

## Acceptance Tests

- [ ] Clicking "Connect to Spotify…" opens the browser to `accounts.spotify.com`
- [ ] Completing the Spotify auth flow returns to the app and tokens are stored
- [ ] Restarting the app without re-authenticating shows the connected state in tray
- [ ] A manipulated `state` param in the callback is rejected silently (no crash)
- [ ] Auth timeout after 5 min clears state and shows error in tray

---

## Dependencies

- `crypto` (Node built-in) — PKCE generation
- `fetch` (Node 18+ built-in) — token exchange POST
- `electron`: `app`, `shell` — already in devDependencies
- `tokenStore.ts` — Phase 1, complete
- `SPOTIFY_CLIENT_ID` from `process.env` (loaded by dotenv in `index.ts`)

No new npm packages required.

---

## Rollback

`git checkout feature/phase-1-scaffold` — all Phase 2 files are isolated to new additions
or small additions to `index.ts`. Token store and types are unchanged.
