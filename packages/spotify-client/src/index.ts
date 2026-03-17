import type { Result, SpotifyError, PlayerState, TrackInfo } from './types';

const BASE_URL = 'https://api.spotify.com';

// Internal shapes matching the Spotify REST API responses
type SpotifyArtist = { name: string };
type SpotifyItem = { name: string; artists: SpotifyArtist[] };
type SpotifyPlayerBody = { is_playing: boolean; item: SpotifyItem | null };

function mapStatus(status: number): SpotifyError {
  if (status === 401) return { code: 'unauthorized', message: 'Unauthorized' };
  if (status === 403) return { code: 'premium_required', message: 'Premium required' };
  if (status === 404) return { code: 'no_active_device', message: 'No active device' };
  return { code: 'unknown', message: `Unexpected status: ${status}` };
}

async function apiRequest(
  accessToken: string,
  method: string,
  endpoint: string,
): Promise<Response> {
  return fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function controlCommand(
  accessToken: string,
  method: string,
  endpoint: string,
): Promise<Result<void, SpotifyError>> {
  try {
    const res = await apiRequest(accessToken, method, endpoint);
    if (res.ok) return { ok: true, value: undefined };
    return { ok: false, error: mapStatus(res.status) };
  } catch (err) {
    return { ok: false, error: { code: 'network_error', message: String(err) } };
  }
}

function parseTrackInfo(body: SpotifyPlayerBody): TrackInfo | null {
  if (!body.item) return null;
  return {
    name: body.item.name,
    artists: body.item.artists.map((a) => a.name),
    isPlaying: body.is_playing,
  };
}

export async function next(accessToken: string): Promise<Result<void, SpotifyError>> {
  return controlCommand(accessToken, 'POST', '/v1/me/player/next');
}

export async function previous(accessToken: string): Promise<Result<void, SpotifyError>> {
  return controlCommand(accessToken, 'POST', '/v1/me/player/previous');
}

export async function pause(accessToken: string): Promise<Result<void, SpotifyError>> {
  return controlCommand(accessToken, 'PUT', '/v1/me/player/pause');
}

export async function play(accessToken: string): Promise<Result<void, SpotifyError>> {
  return controlCommand(accessToken, 'PUT', '/v1/me/player/play');
}

export async function getPlayer(
  accessToken: string,
): Promise<Result<PlayerState, SpotifyError>> {
  try {
    const res = await apiRequest(accessToken, 'GET', '/v1/me/player');
    if (res.status === 204) return { ok: true, value: { isPlaying: false, track: null } };
    if (!res.ok) return { ok: false, error: mapStatus(res.status) };
    const body = (await res.json()) as SpotifyPlayerBody;
    return {
      ok: true,
      value: {
        isPlaying: body.is_playing,
        track: parseTrackInfo(body),
      },
    };
  } catch (err) {
    return { ok: false, error: { code: 'network_error', message: String(err) } };
  }
}

export async function getCurrentTrack(
  accessToken: string,
): Promise<Result<TrackInfo | null, SpotifyError>> {
  try {
    const res = await apiRequest(accessToken, 'GET', '/v1/me/player/currently-playing');
    if (res.status === 204) return { ok: true, value: null };
    if (!res.ok) return { ok: false, error: mapStatus(res.status) };
    const body = (await res.json()) as SpotifyPlayerBody;
    return { ok: true, value: parseTrackInfo(body) };
  } catch (err) {
    return { ok: false, error: { code: 'network_error', message: String(err) } };
  }
}
