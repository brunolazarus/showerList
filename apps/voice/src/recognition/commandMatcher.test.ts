import { describe, it, expect } from "vitest";
import { matchCommand } from "./commandMatcher";
import { COMMAND_ALIASES } from "./aliases";
import type { VoiceCommand } from "../ipc";

describe("matchCommand", () => {
  // ── Exact word match ────────────────────────────────────────────────────────

  it('returns "skip" for exact input "skip"', () => {
    expect(matchCommand("skip")).toBe("skip");
  });

  it('returns "skip" for "NEXT!" (normalised to "next")', () => {
    expect(matchCommand("NEXT!")).toBe("skip");
  });

  it('returns "previous" for "back"', () => {
    expect(matchCommand("back")).toBe("previous");
  });

  it('returns "pause" for "stop"', () => {
    expect(matchCommand("stop")).toBe("pause");
  });

  it('returns "play" for "resume"', () => {
    expect(matchCommand("resume")).toBe("play");
  });

  // ── Substring match ─────────────────────────────────────────────────────────

  it('returns "skip" for "please skip this track"', () => {
    expect(matchCommand("please skip this track")).toBe("skip");
  });

  it('returns "pause" for "stop and play" (first alias match wins)', () => {
    // "stop" is a pause alias and appears before "play" in iteration order
    expect(matchCommand("stop and play")).toBe("pause");
  });

  // ── Levenshtein distance ≤ 1 ────────────────────────────────────────────────

  it('returns "skip" for "nxt" (distance 1 from "next")', () => {
    expect(matchCommand("nxt")).toBe("skip");
  });

  it('returns "previous" for "bak" (distance 1 from "back")', () => {
    expect(matchCommand("bak")).toBe("previous");
  });

  it('returns "play" for "rezume" (distance 1 from "resume")', () => {
    expect(matchCommand("rezume")).toBe("play");
  });

  // ── No match ────────────────────────────────────────────────────────────────

  it('returns null for unrelated input "hello world"', () => {
    expect(matchCommand("hello world")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(matchCommand("")).toBeNull();
  });

  // ── All primary aliases resolve to the correct command ─────────────────────

  const entries = Object.entries(COMMAND_ALIASES) as [VoiceCommand, string[]][];
  for (const [command, aliases] of entries) {
    for (const alias of aliases) {
      it(`primary alias "${alias}" resolves to "${command}"`, () => {
        expect(matchCommand(alias)).toBe(command);
      });
    }
  }
});
