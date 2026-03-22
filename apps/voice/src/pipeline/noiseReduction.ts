import type { Rnnoise, DenoiseState } from "@shiguredo/rnnoise-wasm";

/**
 * Lazy-initialised RNNoise denoiser (loaded once, reused per frame).
 *
 * Input/Output: Int16Array of 480 samples at 48kHz mono.
 * The shiguredo API operates on Float32Array in 16-bit PCM scale (−32768..32767).
 */

let rnnoise: Rnnoise | null = null;
let denoiseState: DenoiseState | null = null;

// Bypasses TypeScript's CJS transform of `import()` → `require()` so the
// ESM-only rnnoise-wasm package can be loaded at runtime from a CJS bundle.
const esmImport = new Function("s", "return import(s)") as (
  s: string,
) => Promise<{ Rnnoise: typeof import("@shiguredo/rnnoise-wasm").Rnnoise }>;

/** Must be called once before the first `denoise()` call. */
export async function initNoiseReduction(): Promise<void> {
  if (!rnnoise) {
    // The WASM bundle was compiled for browser-only (ENVIRONMENT=web) and checks
    // for `window` at load time. Stub it so the module initialises in Node.
    const g = global as Record<string, unknown>;
    const hadWindow = "window" in g;
    if (!hadWindow) g["window"] = {};
    try {
      const mod = await esmImport("@shiguredo/rnnoise-wasm");
      rnnoise = await mod.Rnnoise.load();
    } finally {
      if (!hadWindow) delete g["window"];
    }
  }
  if (!denoiseState) {
    denoiseState = rnnoise.createDenoiseState();
  }
}

/**
 * Denoise a 480-sample 48kHz mono frame.
 * `initNoiseReduction()` must have been awaited first.
 * Returns a new denoised Int16Array (same length).
 */
export function denoise(input: Int16Array): Int16Array {
  if (!denoiseState) {
    // Not yet initialised — return input unchanged (should not happen in normal flow)
    return input;
  }

  // Convert to Float32 in 16-bit PCM scale as required by the shiguredo API
  const f32 = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    f32[i] = input[i];
  }

  denoiseState.processFrame(f32);

  // Convert denoised Float32 back to Int16
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i])));
  }
  return out;
}

/** Release WASM memory held by the denoiser state. */
export function destroyNoiseReduction(): void {
  denoiseState?.destroy();
  denoiseState = null;
}
