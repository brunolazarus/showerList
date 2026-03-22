import { describe, it, expect } from "vitest";
import { resample48to16 } from "./resample";

describe("resample48to16", () => {
  it("produces exactly 160 samples from 480 input samples", () => {
    const input = new Int16Array(480);
    const output = resample48to16(input);
    expect(output.length).toBe(160);
  });

  it("produces silence for a silent input", () => {
    const input = new Int16Array(480); // all zeros
    const output = resample48to16(input);
    expect(output.every((v) => v === 0)).toBe(true);
  });

  it("DC offset is preserved (unity DC gain)", () => {
    // A constant 1000-amplitude input should output ~1000 for interior samples.
    // Output[0] is edge-affected (zero-padding fills 3 missing input samples),
    // so only test from index 1 onwards.
    const input = new Int16Array(480).fill(1000);
    const output = resample48to16(input);
    // Allow ±2 for floating-point rounding
    for (let i = 1; i < output.length; i++) {
      expect(Math.abs(output[i] - 1000)).toBeLessThanOrEqual(2);
    }
  });

  it("clamps output to Int16 range", () => {
    const input = new Int16Array(480).fill(32767);
    const output = resample48to16(input);
    for (const v of output) {
      expect(v).toBeGreaterThanOrEqual(-32768);
      expect(v).toBeLessThanOrEqual(32767);
    }
  });

  it("attenuates a high-frequency signal above Nyquist/3", () => {
    // 12kHz is above the 8kHz anti-alias cutoff. The Hamming-windowed sinc
    // achieves |H(12kHz)| ≈ 0.294, so a 10000-amplitude input → ~2940 peak.
    const input = new Int16Array(480);
    for (let i = 0; i < 480; i++) {
      input[i] = Math.round(
        10000 * Math.sin((2 * Math.PI * 12000 * i) / 48000),
      );
    }
    const output = resample48to16(input);
    const peak = Math.max(...Array.from(output).map(Math.abs));
    // Should be significantly attenuated (< 30% of input amplitude)
    expect(peak).toBeLessThan(3100);
  });
});
