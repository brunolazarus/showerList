import { describe, it, expect, vi, beforeEach } from 'vitest';
import { next, previous, pause, play, getPlayer, getCurrentTrack } from './index';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const TOKEN = 'test-access-token';

function makeResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Shared error-mapping helper — run against every control command
// ---------------------------------------------------------------------------

function controlCommandSuite(
  label: string,
  method: string,
  endpoint: string,
  fn: (token: string) => ReturnType<typeof next>,
) {
  describe(label, () => {
    it(`calls ${method} ${endpoint} and returns ok on 204`, async () => {
      mockFetch.mockResolvedValue(makeResponse(204));
      const result = await fn(TOKEN);
      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.spotify.com${endpoint}`,
        expect.objectContaining({ method }),
      );
    });

    it('sends Bearer token in Authorization header', async () => {
      mockFetch.mockResolvedValue(makeResponse(204));
      await fn(TOKEN);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: `Bearer ${TOKEN}` },
        }),
      );
    });

    it('returns unauthorized on 401', async () => {
      mockFetch.mockResolvedValue(makeResponse(401));
      const result = await fn(TOKEN);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('unauthorized');
    });

    it('returns premium_required on 403', async () => {
      mockFetch.mockResolvedValue(makeResponse(403));
      const result = await fn(TOKEN);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('premium_required');
    });

    it('returns no_active_device on 404', async () => {
      mockFetch.mockResolvedValue(makeResponse(404));
      const result = await fn(TOKEN);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('no_active_device');
    });

    it('returns unknown for unexpected status codes', async () => {
      mockFetch.mockResolvedValue(makeResponse(500));
      const result = await fn(TOKEN);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('unknown');
    });

    it('maps network errors to network_error', async () => {
      mockFetch.mockRejectedValue(new Error('Network failure'));
      const result = await fn(TOKEN);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('network_error');
    });
  });
}

controlCommandSuite('next', 'POST', '/v1/me/player/next', next);
controlCommandSuite('previous', 'POST', '/v1/me/player/previous', previous);
controlCommandSuite('pause', 'PUT', '/v1/me/player/pause', pause);
controlCommandSuite('play', 'PUT', '/v1/me/player/play', play);

// ---------------------------------------------------------------------------
// getCurrentTrack
// ---------------------------------------------------------------------------

describe('getCurrentTrack', () => {
  it('returns { ok: true, value: null } on 204', async () => {
    mockFetch.mockResolvedValue(makeResponse(204));
    const result = await getCurrentTrack(TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('calls GET /v1/me/player/currently-playing', async () => {
    mockFetch.mockResolvedValue(makeResponse(204));
    await getCurrentTrack(TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me/player/currently-playing',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('parses TrackInfo from a real-shape JSON fixture', async () => {
    const fixture = {
      is_playing: true,
      item: {
        name: 'Bohemian Rhapsody',
        artists: [{ name: 'Queen' }],
      },
    };
    mockFetch.mockResolvedValue(makeResponse(200, fixture));
    const result = await getCurrentTrack(TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.name).toBe('Bohemian Rhapsody');
      expect(result.value.artists).toEqual(['Queen']);
      expect(result.value.isPlaying).toBe(true);
    }
  });

  it('parses multi-artist tracks correctly', async () => {
    const fixture = {
      is_playing: false,
      item: {
        name: 'Under Pressure',
        artists: [{ name: 'Queen' }, { name: 'David Bowie' }],
      },
    };
    mockFetch.mockResolvedValue(makeResponse(200, fixture));
    const result = await getCurrentTrack(TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok && result.value) {
      expect(result.value.artists).toEqual(['Queen', 'David Bowie']);
      expect(result.value.isPlaying).toBe(false);
    }
  });

  it('returns unauthorized on 401', async () => {
    mockFetch.mockResolvedValue(makeResponse(401));
    const result = await getCurrentTrack(TOKEN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unauthorized');
  });

  it('returns network_error on fetch rejection', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'));
    const result = await getCurrentTrack(TOKEN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('network_error');
  });
});

// ---------------------------------------------------------------------------
// getPlayer
// ---------------------------------------------------------------------------

describe('getPlayer', () => {
  it('calls GET /v1/me/player', async () => {
    mockFetch.mockResolvedValue(makeResponse(204));
    await getPlayer(TOKEN);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me/player',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns { isPlaying: false, track: null } on 204', async () => {
    mockFetch.mockResolvedValue(makeResponse(204));
    const result = await getPlayer(TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isPlaying).toBe(false);
      expect(result.value.track).toBeNull();
    }
  });

  it('parses PlayerState with track on 200', async () => {
    const fixture = {
      is_playing: true,
      item: {
        name: 'Bohemian Rhapsody',
        artists: [{ name: 'Queen' }],
      },
    };
    mockFetch.mockResolvedValue(makeResponse(200, fixture));
    const result = await getPlayer(TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isPlaying).toBe(true);
      expect(result.value.track?.name).toBe('Bohemian Rhapsody');
      expect(result.value.track?.artists).toEqual(['Queen']);
    }
  });

  it('parses PlayerState with null item as null track', async () => {
    const fixture = { is_playing: false, item: null };
    mockFetch.mockResolvedValue(makeResponse(200, fixture));
    const result = await getPlayer(TOKEN);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isPlaying).toBe(false);
      expect(result.value.track).toBeNull();
    }
  });

  it('returns unauthorized on 401', async () => {
    mockFetch.mockResolvedValue(makeResponse(401));
    const result = await getPlayer(TOKEN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unauthorized');
  });

  it('returns network_error on fetch rejection', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'));
    const result = await getPlayer(TOKEN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('network_error');
  });
});
