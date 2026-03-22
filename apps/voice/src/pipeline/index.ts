import { downmixToMono } from "./mono";
import {
  denoise,
  initNoiseReduction,
  destroyNoiseReduction,
} from "./noiseReduction";
import { resample48to16 } from "./resample";
import { createVad, VadController } from "./vad";
import { feedCalibrationFrame, isCalibrating } from "./calibrate";

export interface PipelineOptions {
  onSpeechReady: (audio: Float32Array) => void;
}

export interface Pipeline {
  pushFrame(raw: Int16Array): void;
  destroy(): void;
}

/**
 * Initialise the full noise-reduction pipeline.
 *
 * Frame flow for each call to `pushFrame(raw)`:
 *   stereo 48kHz (960 int16) → mono 48kHz (480 int16)
 *   → RNNoise denoised 48kHz (480 int16)  [calibrate during first 1s]
 *   → resample 16kHz (160 int16)
 *   → Float32 normalise (÷ 32768)
 *   → Silero VAD → onSpeechReady(segment)
 */
export async function createPipeline(opts: PipelineOptions): Promise<Pipeline> {
  await initNoiseReduction();

  const vad: VadController = await createVad({
    onSpeechStart: () => {
      /* no-op — VAD internally accumulates the segment */
    },
    onSpeechEnd: (audio) => opts.onSpeechReady(audio),
  });

  function pushFrame(raw: Int16Array): void {
    const mono = downmixToMono(raw);

    const denoised = denoise(mono);

    if (isCalibrating()) {
      feedCalibrationFrame(denoised);
    }

    const resampled = resample48to16(denoised);

    // Normalise Int16 → Float32 in −1..1 range for VAD
    const f32 = new Float32Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      f32[i] = resampled[i] / 32768;
    }

    // fire-and-forget; errors surface via unhandled rejection
    vad.pushFrame(f32).catch((err: unknown) => {
      process.stderr.write(`[pipeline] VAD error: ${String(err)}\n`);
    });
  }

  function destroy(): void {
    vad.destroy();
    destroyNoiseReduction();
  }

  return { pushFrame, destroy };
}
