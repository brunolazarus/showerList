import { createHash, randomBytes } from "crypto";
import type { Result } from "./types";

export const SPOTIFY_REDIRECT_URI = "showerlist://callback";

export const SPOTIFY_OAUTH_SCOPES = [
  "user-modify-playback-state",
  "user-read-playback-state",
  "user-read-currently-playing",
] as const;

export type OAuthCallbackData = {
  code: string;
  state: string;
};

export function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = createHash("sha256").update(verifier).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export function buildSpotifyAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}): string {
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", SPOTIFY_OAUTH_SCOPES.join(" "));
  return url.toString();
}

export function parseSpotifyCallback(
  callbackUrl: string,
): Result<OAuthCallbackData, string> {
  let parsed: URL;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return { ok: false, error: "Invalid callback URL" };
  }

  if (parsed.protocol !== "showerlist:") {
    return { ok: false, error: "Unexpected URL scheme" };
  }

  // macOS: showerlist://callback => hostname=callback, pathname=/
  // Other environments may parse pathname as /callback.
  const isCallbackHost = parsed.hostname === "callback";
  const isCallbackPath = parsed.pathname === "/callback";
  if (!isCallbackHost && !isCallbackPath) {
    return { ok: false, error: "Unexpected callback path" };
  }

  const code = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");

  if (!code || !state) {
    return { ok: false, error: "Missing code or state in callback" };
  }

  return { ok: true, value: { code, state } };
}
