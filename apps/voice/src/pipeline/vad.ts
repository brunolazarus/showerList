import * as fs from "fs/promises";
import * as path from "path";
import { Silero } from "@ricky0123/vad-node/dist/_common/models";
import {
  FrameProcessor,
  defaultFrameProcessorOptions,
} from "@ricky0123/vad-node/dist/_common/frame-processor";
import { Message } from "@ricky0123/vad-node/dist/_common/messages";

// onnxruntime-node is a transitive dep of @ricky0123/vad-node — use require
// to avoid TypeScript needing to resolve its types directly (ONNXRuntimeAPI = any).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ort = require("onnxruntime-node") as unknown;

export interface VadCallbacks {
  onSpeechStart: () => void;
  onSpeechEnd: (audio: Float32Array) => void;
}

// Silero VAD requires exactly these frame sizes at 16kHz.
// 1536 samples = 96ms — the recommended size per model authors.
const FRAME_SAMPLES = 1536;

export interface VadController {
  /** Push a 160-sample 16kHz mono frame (as Float32 in −1..1 range). */
  pushFrame(frame: Float32Array): Promise<void>;
  destroy(): void;
}

export async function createVad(
  callbacks: VadCallbacks,
): Promise<VadController> {
  // Load the ONNX model bundled with @ricky0123/vad-node
  const modelPath = path.join(
    path.dirname(require.resolve("@ricky0123/vad-node")),
    "silero_vad.onnx",
  );
  const modelFetcher = async (): Promise<ArrayBuffer> => {
    const buf = await fs.readFile(modelPath);
    return buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
  };

  const model = await Silero.new(ort, modelFetcher);
  const fp = new FrameProcessor(model.process, model.reset_state, {
    ...defaultFrameProcessorOptions,
    frameSamples: FRAME_SAMPLES,
  });
  fp.resume();

  // Accumulate incoming short frames until we have a full FRAME_SAMPLES chunk
  const accumulator = new Float32Array(FRAME_SAMPLES);
  let accLen = 0;

  async function pushFrame(frame: Float32Array): Promise<void> {
    let offset = 0;
    while (offset < frame.length) {
      const space = FRAME_SAMPLES - accLen;
      const take = Math.min(space, frame.length - offset);
      accumulator.set(frame.subarray(offset, offset + take), accLen);
      accLen += take;
      offset += take;

      if (accLen === FRAME_SAMPLES) {
        const chunk = accumulator.slice(0);
        accLen = 0;
        const { msg, audio } = await fp.process(chunk);
        if (msg === Message.SpeechStart) {
          callbacks.onSpeechStart();
        } else if (msg === Message.SpeechEnd && audio !== undefined) {
          callbacks.onSpeechEnd(audio);
        }
      }
    }
  }

  function destroy(): void {
    fp.endSegment();
  }

  return { pushFrame, destroy };
}
