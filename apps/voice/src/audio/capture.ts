import { Readable } from "stream";
import * as portAudio from "naudiodon";

const CHANNEL_COUNT = 2;
const SAMPLE_RATE = 48000;

// 480 stereo samples per frame = 10ms at 48kHz (required by RNNoise in Phase 7).
export const FRAME_SAMPLE_COUNT = 480;
const BYTES_PER_FRAME = FRAME_SAMPLE_COUNT * CHANNEL_COUNT * 2; // 1920 bytes

// The inOptions-only overload returns Readable & AudioStream.
type InputAudioStream = Readable & { start(): void; quit(cb?: () => void): void };

let stream: InputAudioStream | null = null;

export function startCapture(onFrame: (frame: Int16Array) => void): void {
  const s = portAudio.AudioIO({
    inOptions: {
      channelCount: CHANNEL_COUNT,
      sampleFormat: portAudio.SampleFormat16Bit,
      sampleRate: SAMPLE_RATE,
      deviceId: -1, // default device
    },
  }) as unknown as InputAudioStream;

  stream = s;

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

export function stopCapture(): void {
  if (stream) {
    stream.quit();
    stream = null;
  }
}
