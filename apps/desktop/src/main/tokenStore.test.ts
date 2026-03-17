import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  encryptionAvailable: true,
  userDataPath: "/tmp/showerlist-test",
  files: new Map<string, Buffer>(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) =>
      name === "userData" ? mockState.userDataPath : "/tmp",
  },
  safeStorage: {
    isEncryptionAvailable: () => mockState.encryptionAvailable,
    encryptString: (value: string) => Buffer.from(value, "utf8"),
    decryptString: (value: Buffer) => value.toString("utf8"),
  },
}));

vi.mock("fs", () => ({
  existsSync: (path: string) => mockState.files.has(path),
  mkdirSync: () => undefined,
  readFileSync: (path: string) => {
    const value = mockState.files.get(path);
    if (!value) {
      throw new Error("ENOENT");
    }
    return value;
  },
  unlinkSync: (path: string) => {
    mockState.files.delete(path);
  },
  writeFileSync: (path: string, value: string | Uint8Array) => {
    const buffer =
      typeof value === "string"
        ? Buffer.from(value, "utf8")
        : Buffer.from(value);
    mockState.files.set(path, buffer);
  },
}));

import { clearTokens, loadTokens, saveTokens } from "./tokenStore";

describe("tokenStore", () => {
  beforeEach(() => {
    mockState.encryptionAvailable = true;
    mockState.files.clear();
  });

  it("returns an error when encryption is unavailable", () => {
    mockState.encryptionAvailable = false;

    const saveResult = saveTokens({
      accessToken: "a",
      refreshToken: "b",
      expiresAt: Date.now() + 60_000,
    });
    const loadResult = loadTokens();

    expect(saveResult.ok).toBe(false);
    expect(loadResult.ok).toBe(false);
  });

  it("round-trips token data with save and load", () => {
    const tokenData = {
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 123_456,
    };

    const saveResult = saveTokens(tokenData);
    const loadResult = loadTokens();

    expect(saveResult).toEqual({ ok: true, value: undefined });
    expect(loadResult).toEqual({ ok: true, value: tokenData });
  });

  it("clears tokens from storage", () => {
    saveTokens({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 123_456,
    });

    clearTokens();

    expect(loadTokens().ok).toBe(false);
  });
});
