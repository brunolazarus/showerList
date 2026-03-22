/**
 * Resample 48kHz mono → 16kHz mono (factor-3 decimation).
 *
 * Applies a 7-tap symmetric FIR low-pass anti-alias filter (cutoff ≈ 0.33 Nyquist)
 * then keeps every 3rd output sample.
 *
 * Input:  Int16Array of 480 samples at 48kHz
 * Output: Int16Array of 160 samples at 16kHz
 */

// Symmetric 7-tap FIR coefficients — Hamming-windowed sinc, fc = 8kHz/48kHz.
// Coefficients are normalised so their sum = 1.0 (unity DC gain).
// h[n] = sinc(2fc*(n-3)) * hamming(n,6) / sum, fc = 1/6
export const FIR: readonly number[] = [
  0.0, 0.050672, 0.251726, 0.395252, 0.251726, 0.050672, 0.0,
];
const DECIMATION = 3;

export function resample48to16(input: Int16Array): Int16Array {
  const outputLen = Math.floor(input.length / DECIMATION);
  const output = new Int16Array(outputLen);
  const half = (FIR.length - 1) >> 1; // 3

  for (let n = 0; n < outputLen; n++) {
    const center = n * DECIMATION;
    let acc = 0;
    for (let k = 0; k < FIR.length; k++) {
      const idx = center + k - half;
      const sample = idx >= 0 && idx < input.length ? input[idx] : 0;
      acc += FIR[k] * sample;
    }
    // Clamp to Int16 range
    output[n] = Math.max(-32768, Math.min(32767, Math.round(acc)));
  }

  return output;
}
