/**
 * Clap detector for single and double clap recognition.
 *
 * Processes 480-sample 48kHz mono frames and detects percussive transients
 * using RMS spike detection confirmed by spectral centroid. Maps:
 *   - Single clap → onSingleClap
 *   - Double clap (150–600ms gap between two confirmed claps) → onDoubleClap
 *
 * A 2-second cooldown follows any fired event.
 */

const SPIKE_FACTOR = 8;
const EMA_ALPHA = 0.01;
const CENTROID_MIN_HZ = 1200;
const DOUBLE_CLAP_MIN_MS = 150;
const DOUBLE_CLAP_MAX_MS = 600;
const COOLDOWN_MS = 2000;

// 16-point DFT on 16 subsampled points (stride=8 → effective rate=6kHz, Nyquist=3kHz).
// Centroid in Hz: claps score well above 2kHz; low-frequency thumps score below.
function spectralCentroid(frame: Int16Array): number {
  const N = 16;
  const stride = 8;
  let weightedSum = 0;
  let totalMag = 0;
  for (let k = 1; k < N / 2; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const s = frame[n * stride] / 32768;
      const angle = (2 * Math.PI * k * n) / N;
      re += s * Math.cos(angle);
      im -= s * Math.sin(angle);
    }
    const mag = Math.sqrt(re * re + im * im);
    const freqHz = k * (6000 / N); // effective rate = 48000 / stride = 6000 Hz
    weightedSum += freqHz * mag;
    totalMag += mag;
  }
  return totalMag > 0 ? weightedSum / totalMag : 0;
}

function rms(frame: Int16Array): number {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

export function createClapDetector(opts: {
  onSingleClap: () => void;
  onDoubleClap: () => void;
  sampleRate: number; // 48000
}): {
  pushFrame: (mono48k: Int16Array) => void;
  destroy: () => void;
} {
  let baseline = 300; // initial quiet RMS estimate (Int16 units)
  let cooldownUntil = 0;
  let pendingClapAt: number | null = null;
  let singleClapTimer: ReturnType<typeof setTimeout> | null = null;

  function fireSingleClap(): void {
    singleClapTimer = null;
    pendingClapAt = null;
    cooldownUntil = Date.now() + COOLDOWN_MS;
    opts.onSingleClap();
  }

  function fireDoubleClap(): void {
    if (singleClapTimer !== null) {
      clearTimeout(singleClapTimer);
      singleClapTimer = null;
    }
    pendingClapAt = null;
    cooldownUntil = Date.now() + COOLDOWN_MS;
    opts.onDoubleClap();
  }

  let debugFrameCount = 0;

  function pushFrame(mono48k: Int16Array): void {
    const frameRms = rms(mono48k);

    // Update baseline only on quiet frames to track ambient level
    if (frameRms < baseline * SPIKE_FACTOR) {
      baseline = baseline * (1 - EMA_ALPHA) + frameRms * EMA_ALPHA;
    }

    // DEBUG: log RMS and baseline every ~1s (100 frames × 10ms)
    debugFrameCount++;
    if (debugFrameCount % 100 === 0) {
      process.stderr.write(
        `[clap] rms=${frameRms.toFixed(1)} baseline=${baseline.toFixed(1)} threshold=${(baseline * SPIKE_FACTOR).toFixed(1)}\n`,
      );
    }

    if (Date.now() < cooldownUntil) return;
    if (frameRms < baseline * SPIKE_FACTOR) return;
    if (spectralCentroid(mono48k) < CENTROID_MIN_HZ) return;

    // Confirmed clap candidate
    const t = Date.now();

    if (pendingClapAt !== null) {
      const gap = t - pendingClapAt;
      if (gap >= DOUBLE_CLAP_MIN_MS && gap <= DOUBLE_CLAP_MAX_MS) {
        fireDoubleClap();
        return;
      }
      // Gap out of range — discard pending and treat this as a fresh first clap
      if (singleClapTimer !== null) {
        clearTimeout(singleClapTimer);
        singleClapTimer = null;
      }
    }

    pendingClapAt = t;
    singleClapTimer = setTimeout(fireSingleClap, DOUBLE_CLAP_MAX_MS);
  }

  function destroy(): void {
    if (singleClapTimer !== null) {
      clearTimeout(singleClapTimer);
      singleClapTimer = null;
    }
  }

  return { pushFrame, destroy };
}
