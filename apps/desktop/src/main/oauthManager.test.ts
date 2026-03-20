import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mutable state shared by mock factories ---

const mockState = vi.hoisted(() => ({
  openExternalCalls: [] as string[],
  savedTokens: null as unknown,
  saveResult: { ok: true, value: undefined } as {
    ok: boolean;
    value?: undefined;
    error?: string;
  },
  timeoutHandlerCalled: false,
}));

// --- Module mocks ---

vi.mock("electron", () => ({
  shell: {
    openExternal: (url: string) => {
      mockState.openExternalCalls.push(url);
      return Promise.resolve();
    },
  },
}));

vi.mock("./tokenStore", () => ({
  saveTokens: (data: unknown) => {
    mockState.savedTokens = data;
    return mockState.saveResult;
  },
}));

import {
  buildAuthUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  handleCallback,
  setAuthTimeoutHandler,
  startAuth,
} from "./oauthManager";

// ---------------------------------------------------------------------------
// Pure helper tests
// ---------------------------------------------------------------------------

describe("generateCodeVerifier", () => {
  it("returns a base64url string of ~43 characters", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    // 32 random bytes → 43 base64url chars (no padding)
    expect(verifier.length).toBeGreaterThanOrEqual(40);
    expect(verifier).not.toContain("+");
    expect(verifier).not.toContain("/");
    expect(verifier).not.toContain("=");
  });
});

describe("generateCodeChallenge", () => {
  it("returns a non-empty base64url string without padding", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge.length).toBeGreaterThan(0);
    expect(challenge).not.toContain("=");
  });

  it("is deterministic for the same verifier", async () => {
    const verifier = "some-fixed-verifier";
    const a = await generateCodeChallenge(verifier);
    const b = await generateCodeChallenge(verifier);
    expect(a).toBe(b);
  });
});

describe("buildAuthUrl", () => {
  it("includes all required OAuth params and correct scopes", () => {
    const raw = buildAuthUrl({
      clientId: "test-client",
      redirectUri: "showerlist://callback",
      codeChallenge: "abc123",
      state: "xyz",
    });
    const url = new URL(raw);
    expect(url.origin).toBe("https://accounts.spotify.com");
    expect(url.pathname).toBe("/authorize");
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("showerlist://callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("abc123");
    expect(url.searchParams.get("state")).toBe("xyz");
    const scope = url.searchParams.get("scope") ?? "";
    expect(scope).toContain("user-modify-playback-state");
    expect(scope).toContain("user-read-playback-state");
    expect(scope).toContain("user-read-currently-playing");
  });
});

// ---------------------------------------------------------------------------
// handleCallback — pure error path tests (no pending auth required)
// ---------------------------------------------------------------------------

describe("handleCallback — invalid inputs", () => {
  it("rejects non-showerlist URL schemes", async () => {
    const result = await handleCallback(
      "http://evil.example.com/callback?code=x&state=y",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an unparseable URL", async () => {
    const result = await handleCallback("not a url at all");
    expect(result.ok).toBe(false);
  });

  it("rejects callback with missing code param", async () => {
    // Need an active pendingAuth so we get past the scheme check.
    // Start auth to populate pendingAuth, capture the state from the URL.
    mockState.openExternalCalls = [];
    await startAuth("client-id");
    const authUrl = new URL(mockState.openExternalCalls[0]!);
    const realState = authUrl.searchParams.get("state")!;

    const result = await handleCallback(
      `showerlist://callback?state=${realState}`,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { ok: false; error: string }).error).toMatch(
        /missing code or state/i,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// handleCallback — state mismatch (CSRF guard)
// ---------------------------------------------------------------------------

describe("handleCallback — state mismatch", () => {
  beforeEach(() => {
    mockState.openExternalCalls = [];
    mockState.savedTokens = null;
  });

  it("returns state_mismatch error when state param does not match", async () => {
    await startAuth("client-id");

    const result = await handleCallback(
      "showerlist://callback?code=authcode&state=WRONG_STATE",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { ok: false; error: string }).error).toBe(
        "state_mismatch",
      );
    }
  });

  it("clears pendingAuth after a state mismatch so subsequent callbacks fail", async () => {
    await startAuth("client-id");

    // First call — wrong state clears pendingAuth
    await handleCallback(
      "showerlist://callback?code=authcode&state=WRONG_STATE",
    );

    // Second call — pendingAuth is gone
    const result = await handleCallback(
      "showerlist://callback?code=authcode&state=WRONG_STATE",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { ok: false; error: string }).error).toBe(
        "No pending auth attempt",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// handleCallback — valid callback (token exchange)
// ---------------------------------------------------------------------------

describe("handleCallback — valid callback", () => {
  beforeEach(() => {
    mockState.openExternalCalls = [];
    mockState.savedTokens = null;
    mockState.saveResult = { ok: true, value: undefined };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exchanges code for tokens and saves them on success", async () => {
    await startAuth("my-client-id");
    const authUrl = new URL(mockState.openExternalCalls[0]!);
    const correctState = authUrl.searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
        json: () =>
          Promise.resolve({
            access_token: "new-access",
            refresh_token: "new-refresh",
            expires_in: 3600,
          }),
      }),
    );

    const result = await handleCallback(
      `showerlist://callback?code=valid-code&state=${correctState}`,
    );

    expect(result.ok).toBe(true);
    expect(mockState.savedTokens).toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    });
    const saved = mockState.savedTokens as { expiresAt: number };
    expect(saved.expiresAt).toBeGreaterThan(Date.now());
  });

  it("returns error when token exchange HTTP request fails", async () => {
    await startAuth("my-client-id");
    const authUrl = new URL(mockState.openExternalCalls[0]!);
    const correctState = authUrl.searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Bad Request"),
        json: () => Promise.resolve({}),
      }),
    );

    const result = await handleCallback(
      `showerlist://callback?code=bad-code&state=${correctState}`,
    );

    expect(result.ok).toBe(false);
  });

  it("returns error when token response has unexpected shape", async () => {
    await startAuth("my-client-id");
    const authUrl = new URL(mockState.openExternalCalls[0]!);
    const correctState = authUrl.searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
        json: () => Promise.resolve({ unexpected: "shape" }),
      }),
    );

    const result = await handleCallback(
      `showerlist://callback?code=code&state=${correctState}`,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { ok: false; error: string }).error).toMatch(
        /unexpected token response shape/i,
      );
    }
  });

  it("parses macOS-style showerlist://callback (hostname=callback)", async () => {
    await startAuth("my-client-id");
    const authUrl = new URL(mockState.openExternalCalls[0]!);
    const correctState = authUrl.searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(""),
        json: () =>
          Promise.resolve({
            access_token: "at",
            refresh_token: "rt",
            expires_in: 3600,
          }),
      }),
    );

    // macOS parses showerlist://callback as hostname="callback", pathname="/"
    const macOsUrl = new URL(`showerlist://callback`);
    macOsUrl.searchParams.set("code", "code123");
    macOsUrl.searchParams.set("state", correctState);

    const result = await handleCallback(macOsUrl.toString());
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Auth timeout
// ---------------------------------------------------------------------------

describe("auth timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockState.openExternalCalls = [];
    mockState.timeoutHandlerCalled = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the timeout handler after 5 minutes and clears pendingAuth", async () => {
    setAuthTimeoutHandler(() => {
      mockState.timeoutHandlerCalled = true;
    });

    await startAuth("client-id");

    // Advance just under 5 minutes — handler not yet called
    vi.advanceTimersByTime(4 * 60 * 1000 + 59_999);
    expect(mockState.timeoutHandlerCalled).toBe(false);

    // Advance past the 5-minute mark
    vi.advanceTimersByTime(1);
    expect(mockState.timeoutHandlerCalled).toBe(true);
  });

  it("subsequent handleCallback returns no-pending-auth after timeout", async () => {
    setAuthTimeoutHandler(() => {});

    await startAuth("client-id");
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    const result = await handleCallback(
      "showerlist://callback?code=x&state=y",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { ok: false; error: string }).error).toBe(
        "No pending auth attempt",
      );
    }
  });
});
