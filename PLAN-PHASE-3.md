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

- Endpoint mapping tests for all five methods
- 204 success handling for control endpoints
- 401/403/404 mapping correctness
- Network failure mapped to `network_error`

## Rollback

Revert `packages/spotify-client` directory changes only. No desktop main-process rollback required.
