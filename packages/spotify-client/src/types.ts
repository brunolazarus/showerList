export type SpotifyErrorCode =
  | 'unauthorized'
  | 'premium_required'
  | 'no_active_device'
  | 'network_error'
  | 'unknown';

export type SpotifyError = {
  code: SpotifyErrorCode;
  message: string;
};

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type TrackInfo = {
  name: string;
  artists: string[];
  isPlaying: boolean;
};

export type PlayerState = {
  isPlaying: boolean;
  track: TrackInfo | null;
};
