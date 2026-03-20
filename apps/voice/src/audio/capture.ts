import { Readable } from "stream";
// Import types only — zero runtime cost; avoids loading the native .node
// binary at module load time (ABI mismatch / missing portaudio would otherwise
// crash the process before any error handler runs).
import type * as portAudioTypes from "naudiodon";

const CHANNEL_COUNT = 2;
const SAMPLE_RATE = 48000;

// 480 stereo samples per frame = 10ms at 48kHz (required by RNNoise in Phase 7).
export const FRAME_SAMPLE_COUNT = 480;
const BYTES_PER_FRAME = FRAME_SAMPLE_COUNT * CHANNEL_COUNT * 2; // 1920 bytes

// The inOptions-only overload returns Readable & AudioStream.
type InputAudioStream = Readable & {
  start(): void;
  quit(cb?: () => void): void;
};

let stream: InputAudioStream | null = null;

export function startCapture(
  onFrame: (frame: Int16Array) => void,
  onError?: (err: Error) => void,
): void {
  if (stream) {
    throw new Error("Audio capture already running");
  }

  // Lazy-load the native addon so ABI / missing-library errors are catchable
  // rather than crashing the process before any JS logic runs.
  let portAudio: typeof portAudioTypes;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    portAudio = require("naudiodon") as typeof portAudioTypes;
  } catch (loadErr) {
    onError?.(loadErr instanceof Error ? loadErr : new Error(String(loadErr)));
    return;
  }

  // The AudioIO constructor can also throw (e.g. no audio device, portaudio
  // init failure) — catch it so the error travels through IPC.
  let s: InputAudioStream;
  try {
    s = portAudio.AudioIO({
      inOptions: {
        channelCount: CHANNEL_COUNT,
        sampleFormat: portAudio.SampleFormat16Bit,
        sampleRate: SAMPLE_RATE,
        deviceId: -1, // default device
      },
    }) as unknown as InputAudioStream;
  } catch (initErr) {
    onError?.(initErr instanceof Error ? initErr : new Error(String(initErr)));
    return;
  }

  stream = s;

  s.on("error", (err: Error) => {
    stream = null;
    onError?.(err);
  });

  // portaudio delivers data in variable-sized chunks; accumulate until we have
  // a full 480-sample frame before forwarding.
  let accumulator = Buffer.alloc(0);

  s.on("data", (chunk: unknown) => {
    accumulator = Buffer.concat([accumulator, chunk as Buffer]);
    while (accumulator.length >= BYTES_PER_FRAME) {
      const frameBytes = accumulator.subarray(0, BYTES_PER_FRAME);
      accumulator = accumulator.subarray(BYTES_PER_FRAME);

      // Copy to a properly typed Int16Array (stereo interleaved: L0,R0,L1,R1,…)
      const frame = new Int16Array(FRAME_SAMPLE_COUNT * CHANNEL_COUNT);
      for (let i = 0; i < frame.length; i++) {
        frame[i] = frameBytes.readInt16LE(i * 2);
      }
      onFrame(frame);
    }
  });

  s.start();
}

export function stopCapture(onDone?: () => void): void {
  if (stream) {
    stream.quit(onDone);
    stream = null;
  } else {
    onDone?.();
  }
}
