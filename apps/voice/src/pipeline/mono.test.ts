import { describe, it, expect } from "vitest";
import { downmixToMono } from "./mono";

describe("downmixToMono", () => {
  it("produces half the input length", () => {
    const stereo = new Int16Array(960);
    const mono = downmixToMono(stereo);
    expect(mono.length).toBe(480);
  });

  it("averages left and right channels", () => {
    // L=100, R=200 → mono = 150
    const stereo = new Int16Array([100, 200, 100, 200]);
    const mono = downmixToMono(stereo);
    expect(mono[0]).toBe(150);
    expect(mono[1]).toBe(150);
  });

  it("rounds toward zero (arithmetic right shift)", () => {
    // L=1, R=0 → (1+0)>>1 = 0
    const stereo = new Int16Array([1, 0]);
    const mono = downmixToMono(stereo);
    expect(mono[0]).toBe(0);
  });

  it("handles negative values correctly", () => {
    // L=-100, R=-200 → (-100 + -200) >> 1 = -150
    const stereo = new Int16Array([-100, -200]);
    const mono = downmixToMono(stereo);
    expect(mono[0]).toBe(-150);
  });

  it("handles silence (all zeros)", () => {
    const stereo = new Int16Array(960); // all zeros
    const mono = downmixToMono(stereo);
    expect(mono.every((v) => v === 0)).toBe(true);
  });

  it("handles max amplitude without overflow", () => {
    // L=32767, R=32767 → (32767+32767)>>1 = 32767
    const stereo = new Int16Array([32767, 32767]);
    const mono = downmixToMono(stereo);
    expect(mono[0]).toBe(32767);
  });
});
