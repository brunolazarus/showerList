/**
 * Automatic Speech Recognition using Whisper via @xenova/transformers.
 *
 * Model: Xenova/whisper-tiny.en (~80MB, English-only ONNX).
 * On first run the model is downloaded and cached in VOICE_MODEL_CACHE
 * (env var set by the desktop process) or os.tmpdir() as fallback.
 * Download progress is emitted as IPC status messages.
 */

import * as os from "os";
import { emit } from "../ipc.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipeline: any = null;

async function getTransformers(): Promise<typeof import("@xenova/transformers")> {
  if (process.env["VITEST"]) {
    // In tests, TypeScript's CJS transform converts import() to require(),
    // which Vitest can intercept via vi.mock. Never reached in production.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return import("@xenova/transformers") as any;
  }
  // @xenova/transformers is ESM-only; use dynamic import from CJS.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function('return import("@xenova/transformers")')();
}

export async function transcribe(audio: Float32Array): Promise<string> {
  if (!pipeline) {
    const { pipeline: createPipeline, env } = await getTransformers();

    env.cacheDir = process.env["VOICE_MODEL_CACHE"] ?? os.tmpdir();

    pipeline = await createPipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en",
      {
        progress_callback: (progress: {
          status: string;
          progress?: number;
        }) => {
          if (progress.status === "downloading" && progress.progress != null) {
            emit({
              type: "status",
              state: "processing",
              detail: `model download ${Math.round(progress.progress)}%`,
            });
          }
        },
      },
    );
  }

  const result = await pipeline(audio, { sampling_rate: 16000 });
  return (result.text as string).toLowerCase();
}
