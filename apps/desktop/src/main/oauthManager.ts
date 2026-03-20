import { shell } from "electron";
import { randomBytes, createHash } from "crypto";
import type { Result, TokenData } from "../shared/types";
import { saveTokens } from "./tokenStore";

const REDIRECT_URI = "showerlist://callback";
const SCOPES = [
  "user-modify-playback-state",
  "user-read-playback-state",
  "user-read-currently-playing",
].join(" ");

const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

type PendingAuth = {
  codeVerifier: string;
  state: string;
  clientId: string;
  timeoutHandle: ReturnType<typeof setTimeout>;
};

let pendingAuth: PendingAuth | null = null;

// Called externally (index.ts) to surface timeout error in tray
let onAuthTimeout: (() => void) | null = null;

export function setAuthTimeoutHandler(handler: () => void): void {
  onAuthTimeout = handler;
}

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

export function buildAuthUrl(params: {
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
  url.searchParams.set("scope", SCOPES);
  return url.toString();
}

// --- Start OAuth attempt ---

export async function startAuth(clientId: string): Promise<void> {
  // Clear any in-flight attempt
  if (pendingAuth) {
    clearTimeout(pendingAuth.timeoutHandle);
    pendingAuth = null;
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = randomBytes(16).toString("hex");

  const authUrl = buildAuthUrl({
    clientId,
    redirectUri: REDIRECT_URI,
    codeChallenge,
    state,
  });

  // Safety guard — must be validated before calling openExternal
  if (!authUrl.startsWith("https://accounts.spotify.com/authorize")) {
    throw new Error(`Unexpected auth URL: ${authUrl}`);
  }

  const timeoutHandle = setTimeout(() => {
    pendingAuth = null;
    onAuthTimeout?.();
  }, AUTH_TIMEOUT_MS);

  pendingAuth = { codeVerifier, state, clientId, timeoutHandle };

  await shell.openExternal(authUrl);
}

// --- Handle deep-link callback ---

export async function handleCallback(
  callbackUrl: string,
): Promise<Result<void>> {
  let parsed: URL;
  try {
    parsed = new URL(callbackUrl);
  } catch {
    return { ok: false, error: "Invalid callback URL" };
  }

  if (parsed.protocol !== "showerlist:") {
    return { ok: false, error: "Unexpected URL scheme" };
  }

  const isCallbackHost = parsed.hostname === "callback";
  const isCallbackPath = parsed.pathname === "/callback";
  if (!isCallbackHost && !isCallbackPath) {
    return { ok: false, error: "Unexpected callback path" };
  }

  const code = parsed.searchParams.get("code");
  const returnedState = parsed.searchParams.get("state");

  if (!code || !returnedState) {
    return { ok: false, error: "Missing code or state in callback" };
  }

  if (!pendingAuth) {
    return { ok: false, error: "No pending auth attempt" };
  }

  // CSRF guard
  if (returnedState !== pendingAuth.state) {
    clearTimeout(pendingAuth.timeoutHandle);
    pendingAuth = null;
    return { ok: false, error: "state_mismatch" };
  }

  const { codeVerifier, clientId, timeoutHandle } = pendingAuth;
  clearTimeout(timeoutHandle);
  pendingAuth = null;

  // Token exchange
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  let response: Response;
  try {
    response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${String(e)}` };
  }

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => String(response.status));
    return { ok: false, error: errorText };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: "Failed to parse token response" };
  }

  const tokenResponse = json as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (
    typeof tokenResponse.access_token !== "string" ||
    typeof tokenResponse.refresh_token !== "string" ||
    typeof tokenResponse.expires_in !== "number"
  ) {
    return { ok: false, error: "Unexpected token response shape" };
  }

  const tokenData: TokenData = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
  };

  const saveResult = saveTokens(tokenData);
  if (!saveResult.ok) {
    return saveResult;
  }

  return { ok: true, value: undefined };
}

// --- Token refresh ---

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
): Promise<Result<TokenData>> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });

  let response: Response;
  try {
    response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${String(e)}` };
  }

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => String(response.status));
    return { ok: false, error: errorText };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: "Failed to parse token response" };
  }

  const tokenResponse = json as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (
    typeof tokenResponse.access_token !== "string" ||
    typeof tokenResponse.expires_in !== "number"
  ) {
    return { ok: false, error: "Unexpected token response shape" };
  }

  const tokenData: TokenData = {
    accessToken: tokenResponse.access_token,
    // Spotify may or may not rotate the refresh token — keep the old one if absent
    refreshToken: tokenResponse.refresh_token ?? refreshToken,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
  };

  const saveResult = saveTokens(tokenData);
  if (!saveResult.ok) {
    return saveResult;
  }

  return { ok: true, value: tokenData };
}
