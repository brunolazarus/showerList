# PLAN-PHASE-3.md - Spotify Client Package

## Objective

Create a pure TypeScript Spotify Web API client in `packages/spotify-client` with typed results and no Electron dependency.

## Files in Scope

| Action | File |
| --- | --- |
| Create | `packages/spotify-client/package.json` |
| Create | `packages/spotify-client/tsconfig.json` |
| Create | `packages/spotify-client/src/index.ts` |
| Create | `packages/spotify-client/src/types.ts` |
| Create | `packages/spotify-client/src/index.test.ts` |

## Hard Boundaries

- Do not import from `electron`
- Do not read/write token files
- Do not open external URLs
- Keep network targets limited to `https://api.spotify.com`

## API Surface

- `next(accessToken: string): Promise<Result<void, SpotifyError>>`
- `previous(accessToken: string): Promise<Result<void, SpotifyError>>`
- `pause(accessToken: string): Promise<Result<void, SpotifyError>>`
- `play(accessToken: string): Promise<Result<void, SpotifyError>>`
- `getPlayer(accessToken: string): Promise<Result<PlayerState, SpotifyError>>`
- `getCurrentTrack(accessToken: string): Promise<Result<TrackInfo | null, SpotifyError>>`

## `TrackInfo` Type

```ts
export type TrackInfo = {
  name: string;
  artists: string[];   // display as "Artist1, Artist2"
  isPlaying: boolean;
};
```

Sourced from `GET /v1/me/player/currently-playing`. Return `null` when Spotify
returns 204 (nothing playing).

## Tray Title Integration

In `apps/desktop/src/main/index.ts`, after Phase 3 is wired in Phase 4:

```ts
// Called on a 30-second polling interval and after any playback command
async function updateTrayTitle(): Promise<void> {
  const result = await getCurrentTrack(accessToken);
  if (result.ok && result.value) {
    const { name, artists } = result.value;
    tray?.setTitle(`${artists[0]} — ${name}`);
  } else {
    tray?.setTitle("");
  }
}
```

`tray.setTitle()` renders inline text next to the tray icon in the macOS menu bar.
Keep it short — long strings get clipped by macOS. Show artist + title only.

**Polling cadence:** 30 seconds. Do not poll on every command — Spotify's API has
rate limits. Commands (`next`, `previous`, `pause`) should trigger an immediate
one-off refresh with a 500ms delay (give Spotify time to update its state).

**Phase 3 deliverable:** implement `getCurrentTrack` in `spotify-client` only.
The polling loop and `tray.setTitle` wiring happen in **Phase 4**.

## Error Model

Use a typed union:

- `unauthorized` (401)
- `premium_required` (403)
- `no_active_device` (404)
- `network_error`
- `unknown`

## Implementation Notes

- Use `fetch` from Node runtime
- Shared request helper for method + endpoint + bearer auth
- Parse JSON only when response has body
- Never throw string errors; return typed `Result`

## Acceptance Tests

- Endpoint mapping tests for all five methods + `getCurrentTrack`
- 204 success handling for control endpoints
- 204 response from `getCurrentTrack` returns `{ ok: true, value: null }`
- 401/403/404 mapping correctness
- Network failure mapped to `network_error`
- `TrackInfo` correctly parsed from a real-shape JSON fixture

## Rollback

Revert `packages/spotify-client` directory changes only. No desktop main-process rollback required.
