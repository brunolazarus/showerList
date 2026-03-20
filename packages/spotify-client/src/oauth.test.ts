import { describe, expect, it } from "vitest";
import {
  buildSpotifyAuthUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  parseSpotifyCallback,
  SPOTIFY_OAUTH_SCOPES,
  SPOTIFY_REDIRECT_URI,
} from "./oauth";

describe("oauth core", () => {
  it("generates a base64url code verifier", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(verifier).not.toContain("=");
  });

  it("generates deterministic challenge for same verifier", async () => {
    const verifier = "fixed-verifier";
    const a = await generateCodeChallenge(verifier);
    const b = await generateCodeChallenge(verifier);
    expect(a).toBe(b);
  });

  it("builds Spotify auth URL with required params", () => {
    const url = new URL(
      buildSpotifyAuthUrl({
        clientId: "cid",
        redirectUri: SPOTIFY_REDIRECT_URI,
        codeChallenge: "challenge",
        state: "state123",
      }),
    );

    expect(url.origin).toBe("https://accounts.spotify.com");
    expect(url.pathname).toBe("/authorize");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe(SPOTIFY_REDIRECT_URI);
    expect(url.searchParams.get("state")).toBe("state123");
    expect(url.searchParams.get("scope")).toBe(SPOTIFY_OAUTH_SCOPES.join(" "));
  });

  it("parses valid callback URL", () => {
    const result = parseSpotifyCallback(
      "showerlist://callback?code=abc&state=xyz",
    );
    expect(result).toEqual({ ok: true, value: { code: "abc", state: "xyz" } });
  });

  it("rejects invalid callback URL", () => {
    const result = parseSpotifyCallback("http://example.com/callback");
    expect(result.ok).toBe(false);
  });
});
