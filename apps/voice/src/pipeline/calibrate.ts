import { emit } from "../ipc";

const CALIBRATION_FRAMES = 100; // 100 × 10ms = 1 second of ambient audio

export interface CalibrationResult {
  meanAmplitude: number;
  peakAmplitude: number;
  snrDb: number;
}

let result: CalibrationResult | null = null;
let frameCount = 0;
let sumAmplitude = 0;
let peak = 0;

/** Returns true while still collecting calibration samples. */
export function isCalibrating(): boolean {
  return frameCount < CALIBRATION_FRAMES;
}

/**
 * Feed a 480-sample 48kHz mono frame (pre-VAD, post-denoise) during startup.
 * After 100 frames (1 second) the calibration result is finalised and emitted
 * via IPC.
 */
export function feedCalibrationFrame(frame: Int16Array): void {
  if (frameCount >= CALIBRATION_FRAMES) return;

  for (let i = 0; i < frame.length; i++) {
    const abs = Math.abs(frame[i]);
    sumAmplitude += abs;
    if (abs > peak) peak = abs;
  }
  frameCount++;

  if (frameCount === CALIBRATION_FRAMES) {
    const totalSamples = CALIBRATION_FRAMES * frame.length;
    const mean = sumAmplitude / totalSamples;
    const snrDb = peak > 0 ? 20 * Math.log10(32767 / peak) : 0;
    result = { meanAmplitude: mean, peakAmplitude: peak, snrDb };

    emit({
      type: "status",
      state: "idle",
      detail: `calibrated snr=${snrDb.toFixed(1)}db`,
    });
  }
}

export function getCalibrationResult(): CalibrationResult | null {
  return result;
}
