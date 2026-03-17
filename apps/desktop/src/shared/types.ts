// Shared types used across main and (if added) renderer via IPC.
// Keep this file free of any Electron or Node.js imports.

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export type TokenData = {
  accessToken: string;
  refreshToken: string;
  /** Unix timestamp (ms) when the access token expires. */
  expiresAt: number;
};

export type PlaybackCommand = "next" | "previous" | "pause" | "play";
