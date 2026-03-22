import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The transformers mock must be declared before any dynamic import of asr.ts
 * so Vitest hoists it. The `env` object is shared and mutated by asr.ts
 * to record the chosen cache directory.
 */
const mockEnv = { cacheDir: "" };
const mockTranscribeCall = vi.fn();
const mockCreatePipeline = vi.fn();

vi.mock("@xenova/transformers", () => ({
  pipeline: mockCreatePipeline,
  env: mockEnv,
}));

describe("transcribe", () => {
  beforeEach(() => {
    // Reset module cache so the module-level `pipeline` variable starts null
    vi.resetModules();
    mockEnv.cacheDir = "";
    mockCreatePipeline.mockReset();
    mockTranscribeCall.mockReset();
    // Default: pipeline factory returns a callable that resolves with { text }
    mockTranscribeCall.mockResolvedValue({ text: "Skip This Track" });
    mockCreatePipeline.mockResolvedValue(mockTranscribeCall);
  });

  it("lowercases the transcript returned by the model", async () => {
    const { transcribe } = await import("./asr.js");
    const result = await transcribe(new Float32Array(160));
    expect(result).toBe("skip this track");
  });

  it("uses VOICE_MODEL_CACHE env var as the cache directory when set", async () => {
    process.env["VOICE_MODEL_CACHE"] = "/custom/model/cache";
    try {
      const { transcribe } = await import("./asr.js");
      await transcribe(new Float32Array(160));
      expect(mockEnv.cacheDir).toBe("/custom/model/cache");
    } finally {
      delete process.env["VOICE_MODEL_CACHE"];
    }
  });

  it("falls back to os.tmpdir() when VOICE_MODEL_CACHE is not set", async () => {
    delete process.env["VOICE_MODEL_CACHE"];
    const os = await import("os");
    const { transcribe } = await import("./asr.js");
    await transcribe(new Float32Array(160));
    expect(mockEnv.cacheDir).toBe(os.tmpdir());
  });

  it("reuses the cached pipeline on subsequent calls (no double initialisation)", async () => {
    const { transcribe } = await import("./asr.js");
    await transcribe(new Float32Array(160));
    await transcribe(new Float32Array(160));
    // createPipeline should only be called once regardless of how many transcriptions run
    expect(mockCreatePipeline).toHaveBeenCalledTimes(1);
  });
});
