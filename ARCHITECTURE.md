# ARCHITECTURE.md — ShowerList

## Topology

```
┌─────────────────────────────────┐
│         User's Machine          │
│                                 │
│  ┌──────────────────────────┐   │
│  │  Electron Main Process   │   │
│  │  ┌────────────────────┐  │   │
│  │  │ Tray + Menu        │  │   │──── user input
│  │  ├────────────────────┤  │   │
│  │  │ OAuth Manager      │  │   │──── opens system browser
│  │  ├────────────────────┤  │   │
│  │  │ Ephemeral HTTP     │  │   │◄─── localhost:8888/callback
│  │  │ (callback only)    │  │   │
│  │  ├────────────────────┤  │   │
│  │  │ Token Store        │  │   │──── OS Keychain (safeStorage)
│  │  ├────────────────────┤  │   │
│  │  │ Spotify Client     │  │───────► api.spotify.com
│  │  └────────────────────┘  │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

## OAuth Flow (PKCE)

1. User clicks "Connect" → `OAuthManager` generates `code_verifier` + `code_challenge`
2. `app.setAsDefaultProtocolClient('showerlist')` registers the custom URL scheme
3. `shell.openExternal` opens browser to `accounts.spotify.com/authorize?redirect_uri=showerlist://callback&...`
4. Spotify redirects to `showerlist://callback?code=...`
5. macOS invokes the app via `open-url` event — `OAuthManager` extracts the code
6. POST to `accounts.spotify.com/api/token` with `code` + `code_verifier` → tokens
7. Tokens encrypted via `safeStorage.encryptString` → written to app userData dir

## Approved OAuth Scopes

| Scope                         | Purpose                     |
| ----------------------------- | --------------------------- |
| `user-modify-playback-state`  | Skip, previous, pause, play |
| `user-read-playback-state`    | Active device detection     |
| `user-read-currently-playing` | Show current track in tray  |

## Playback Command Map

| User Action | Spotify Endpoint              |
| ----------- | ----------------------------- |
| Skip        | `POST /v1/me/player/next`     |
| Previous    | `POST /v1/me/player/previous` |
| Pause       | `PUT /v1/me/player/pause`     |
| Play        | `PUT /v1/me/player/play`      |
| Status      | `GET /v1/me/player`           |

## Trust Surfaces

- All outbound: only to `accounts.spotify.com` and `api.spotify.com`
- Inbound: only via `showerlist://` custom URL scheme (OS-level, not network-exposed)
- No renderer process has direct API access — routes through IPC to main process

## Constraints

- Playback control requires Spotify Premium
- Active device must exist — 404 = no active device, surface to user
- Token refresh: access tokens expire in 1h — auto-refresh on 401
