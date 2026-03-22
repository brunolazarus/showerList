import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClapDetector } from "./clapDetector";

/**
 * Synthesize a 480-sample mono frame at 2250 Hz, amplitude 20000.
 *
 * At stride=8 the mini-DFT sees this as a 2250 Hz tone → centroid ≈ 2250 Hz,
 * well above CENTROID_MIN_HZ (1200). RMS ≈ 14142, well above the initial
 * threshold of 300 × 8 = 2400.
 */
function makeClapFrame(): Int16Array {
  const frame = new Int16Array(480);
  for (let n = 0; n < 480; n++) {
    frame[n] = Math.round(20000 * Math.cos((2 * Math.PI * 2250 * n) / 48000));
  }
  return frame;
}

/** 480-sample silence — RMS = 0, never triggers detector. */
function makeSilentFrame(): Int16Array {
  return new Int16Array(480);
}

describe("createClapDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires onSingleClap once after a single clap followed by > 600ms silence", () => {
    const onSingleClap = vi.fn();
    const onDoubleClap = vi.fn();
    const det = createClapDetector({ sampleRate: 48000, onSingleClap, onDoubleClap });

    det.pushFrame(makeClapFrame());
    expect(onSingleClap).not.toHaveBeenCalled();

    vi.advanceTimersByTime(601);
    expect(onSingleClap).toHaveBeenCalledTimes(1);
    expect(onDoubleClap).not.toHaveBeenCalled();
    det.destroy();
  });

  it("fires onDoubleClap (not onSingleClap) for two claps with a 300ms gap", () => {
    const onSingleClap = vi.fn();
    const onDoubleClap = vi.fn();
    const det = createClapDetector({ sampleRate: 48000, onSingleClap, onDoubleClap });

    det.pushFrame(makeClapFrame());
    vi.advanceTimersByTime(300);
    det.pushFrame(makeClapFrame());

    expect(onDoubleClap).toHaveBeenCalledTimes(1);
    expect(onSingleClap).not.toHaveBeenCalled();
    det.destroy();
  });

  it("fires onSingleClap twice when gap between claps exceeds 600ms", () => {
    const onSingleClap = vi.fn();
    const onDoubleClap = vi.fn();
    const det = createClapDetector({ sampleRate: 48000, onSingleClap, onDoubleClap });

    // First clap → single after 601ms
    det.pushFrame(makeClapFrame());
    vi.advanceTimersByTime(601);
    expect(onSingleClap).toHaveBeenCalledTimes(1);

    // Must wait out the 2s cooldown before trying again
    vi.advanceTimersByTime(2000);

    // Second clap → another single after 601ms
    det.pushFrame(makeClapFrame());
    vi.advanceTimersByTime(601);
    expect(onSingleClap).toHaveBeenCalledTimes(2);
    expect(onDoubleClap).not.toHaveBeenCalled();
    det.destroy();
  });

  it("fires onSingleClap once when gap between claps is < 150ms (too fast)", () => {
    const onSingleClap = vi.fn();
    const onDoubleClap = vi.fn();
    const det = createClapDetector({ sampleRate: 48000, onSingleClap, onDoubleClap });

    // First clap
    det.pushFrame(makeClapFrame());
    // Second clap 50ms later — too fast for double, first pending is discarded
    vi.advanceTimersByTime(50);
    det.pushFrame(makeClapFrame());
    // Now wait for the single-clap timer from the second clap
    vi.advanceTimersByTime(601);

    expect(onSingleClap).toHaveBeenCalledTimes(1);
    expect(onDoubleClap).not.toHaveBeenCalled();
    det.destroy();
  });

  it("ignores a clap within the 2s cooldown after an event fires", () => {
    const onSingleClap = vi.fn();
    const onDoubleClap = vi.fn();
    const det = createClapDetector({ sampleRate: 48000, onSingleClap, onDoubleClap });

    // Fire single clap
    det.pushFrame(makeClapFrame());
    vi.advanceTimersByTime(601);
    expect(onSingleClap).toHaveBeenCalledTimes(1);

    // Clap again within cooldown window
    det.pushFrame(makeClapFrame());
    vi.advanceTimersByTime(601);

    // Count should still be 1 — second clap was suppressed
    expect(onSingleClap).toHaveBeenCalledTimes(1);
    det.destroy();
  });

  it("does not fire for low-amplitude frames below the spike threshold", () => {
    const onSingleClap = vi.fn();
    const onDoubleClap = vi.fn();
    const det = createClapDetector({ sampleRate: 48000, onSingleClap, onDoubleClap });

    // Push 200 silent frames (≈ 2s of silence)
    for (let i = 0; i < 200; i++) {
      det.pushFrame(makeSilentFrame());
    }
    vi.advanceTimersByTime(2000);

    expect(onSingleClap).not.toHaveBeenCalled();
    expect(onDoubleClap).not.toHaveBeenCalled();
    det.destroy();
  });
});
