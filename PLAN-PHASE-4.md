# PLAN-PHASE-4.md - Desktop Integration and Token Refresh

## Objective

Integrate OAuth and Spotify client into tray actions, then add resilient token refresh behavior.

## Files in Scope

| Action | File |
| --- | --- |
| Modify | `apps/desktop/src/main/index.ts` |
| Modify | `apps/desktop/src/main/oauthManager.ts` |
| Create/Modify | `apps/desktop/src/main/spotifyService.ts` |
| Modify | `apps/desktop/src/shared/types.ts` |

## Integration Steps

1. Load stored tokens at startup and derive connected state.
2. Connect tray actions to spotify client methods:
   - Previous -> `previous`
   - Pause/Play -> toggle current playback state
   - Skip -> `next`
3. Surface command result states in tray labels/tooltips.
4. Trigger OAuth start when no token exists.

## Refresh Strategy

- Pre-expiry refresh threshold: refresh when `expiresAt - Date.now() <= 120000`
- On 401 from Spotify command:
  - attempt single refresh
  - retry original command once
  - if second failure, mark session disconnected
- Use single-flight guard so only one refresh request runs at a time.

## Failure Handling

- `no_active_device`: show explicit tray state, no crash
- `premium_required`: show explicit tray state
- refresh failure: clear access token state and require reconnect
- denied/canceled auth: return to disconnected state

## Acceptance Tests

- Tray commands execute on active device
- Startup with valid stored token does not require re-auth
- Expired token refreshes before command execution
- 401 causes one refresh + one retry only
- No device path remains recoverable

## Rollback

Revert integration files only; keep tokenStore and spotify-client unchanged.
