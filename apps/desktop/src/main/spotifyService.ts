import { clearTokens } from "./tokenStore";
import { refreshAccessToken } from "./oauthManager";
import * as spotify from "@showerlist/spotify-client";
import type { SpotifyError, TrackInfo, Result } from "@showerlist/spotify-client";
import type { TokenData } from "../shared/types";

// Refresh proactively when within 2 minutes of expiry
const REFRESH_THRESHOLD_MS = 120_000;

let tokenData: TokenData | null = null;
let clientId: string | null = null;
// Single-flight guard: only one refresh runs at a time
let refreshPromise: Promise<boolean> | null = null;

export function init(tokens: TokenData, appClientId: string): void {
  tokenData = tokens;
  clientId = appClientId;
}

export function isConnected(): boolean {
  return tokenData !== null;
}

export function disconnect(): void {
  tokenData = null;
  clearTokens();
}

async function doRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async (): Promise<boolean> => {
    if (!clientId || !tokenData) return false;
    const rt = tokenData.refreshToken;
    try {
      const result = await refreshAccessToken(clientId, rt);
      if (result.ok) {
        tokenData = result.value;
        return true;
      }
      // Refresh failed — force reconnect
      tokenData = null;
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function ensureFreshToken(): Promise<boolean> {
  if (!tokenData) return false;
  if (tokenData.expiresAt - Date.now() > REFRESH_THRESHOLD_MS) return true;
  return doRefresh();
}

type SpotifyFn<T> = (token: string) => Promise<Result<T, SpotifyError>>;

async function run<T>(fn: SpotifyFn<T>): Promise<Result<T, SpotifyError>> {
  const fresh = await ensureFreshToken();
  if (!fresh || !tokenData) {
    return { ok: false, error: { code: "unauthorized", message: "Not connected" } };
  }

  const result = await fn(tokenData.accessToken);

  // On 401: single refresh + one retry
  if (!result.ok && result.error.code === "unauthorized") {
    const refreshed = await doRefresh();
    if (!refreshed || !tokenData) {
      return { ok: false, error: { code: "unauthorized", message: "Token refresh failed" } };
    }
    return fn(tokenData.accessToken);
  }

  return result;
}

export async function cmdNext(): Promise<Result<void, SpotifyError>> {
  return run(spotify.next);
}

export async function cmdPrevious(): Promise<Result<void, SpotifyError>> {
  return run(spotify.previous);
}

export async function cmdToggle(): Promise<Result<void, SpotifyError>> {
  const playerResult = await run(spotify.getPlayer);
  if (!playerResult.ok) return playerResult;
  return run(playerResult.value.isPlaying ? spotify.pause : spotify.play);
}

export async function fetchCurrentTrack(): Promise<Result<TrackInfo | null, SpotifyError>> {
  return run(spotify.getCurrentTrack);
}
