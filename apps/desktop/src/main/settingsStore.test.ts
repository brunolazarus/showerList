import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  userDataPath: "/tmp/showerlist-settings-test",
  files: new Map<string, string>(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: (name: string) =>
      name === "userData" ? mockState.userDataPath : "/tmp",
  },
}));

vi.mock("fs", () => ({
  existsSync: (path: string) => mockState.files.has(path),
  mkdirSync: () => undefined,
  readFileSync: (path: string, _enc: string) => {
    const value = mockState.files.get(path);
    if (value === undefined) throw new Error("ENOENT");
    return value;
  },
  writeFileSync: (path: string, value: string) => {
    mockState.files.set(path, value);
  },
}));

import { isVoiceEnabled, setVoiceEnabled } from "./settingsStore";

describe("settingsStore", () => {
  beforeEach(() => {
    mockState.files.clear();
  });

  it("defaults to voice enabled when no settings file exists", () => {
    expect(isVoiceEnabled()).toBe(true);
  });

  it("persists voice enabled=false and reads it back", () => {
    setVoiceEnabled(false);
    expect(isVoiceEnabled()).toBe(false);
  });

  it("persists voice enabled=true and reads it back", () => {
    setVoiceEnabled(false);
    setVoiceEnabled(true);
    expect(isVoiceEnabled()).toBe(true);
  });

  it("tolerates a corrupted settings file by returning defaults", () => {
    mockState.files.set(
      `${mockState.userDataPath}/settings.json`,
      "not-json{{",
    );
    expect(isVoiceEnabled()).toBe(true);
  });
});
