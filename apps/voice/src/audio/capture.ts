import { spawn, ChildProcess } from "child_process";

const CHANNEL_COUNT = 2;
const SAMPLE_RATE = 48000;

// 480 stereo samples per frame = 10ms at 48kHz (required by RNNoise in Phase 7).
export const FRAME_SAMPLE_COUNT = 480;
const BYTES_PER_FRAME = FRAME_SAMPLE_COUNT * CHANNEL_COUNT * 2; // 1920 bytes

// sox "rec" is used to capture raw PCM from the default input device.
// Prerequisite: brew install sox
let proc: ChildProcess | null = null;

export function startCapture(
  onFrame: (frame: Int16Array) => void,
  onError?: (err: Error) => void,
): void {
  if (proc) {
    throw new Error("Audio capture already running");
  }

  const child = spawn(
    "rec",
    [
      "-t", "raw",              // raw PCM, no file header
      "-r", String(SAMPLE_RATE),
      "-e", "signed",
      "-b", "16",               // 16-bit samples
      "-c", String(CHANNEL_COUNT),
      "-",                      // write to stdout
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  proc = child;

  child.on("error", (err: Error) => {
    proc = null;
    onError?.(err);
  });

  child.on("close", (code) => {
    // code null = killed by signal (expected on stopCapture); 0 = clean exit
    if (code !== null && code !== 0) {
      proc = null;
      onError?.(new Error(`rec exited with code ${code}`));
    }
  });

  // Drain stderr so the pipe never backs up (sox writes progress info there).
  child.stderr?.resume();

  // sox delivers data in variable-sized chunks; accumulate until we have
  // a full 480-sample frame before forwarding.
  let accumulator = Buffer.alloc(0);

  child.stdout!.on("data", (chunk: Buffer) => {
    accumulator = Buffer.concat([accumulator, chunk]);
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
}

export function stopCapture(onDone?: () => void): void {
  if (proc) {
    const p = proc;
    proc = null;
    if (onDone) {
      p.once("close", () => onDone());
    }
    p.kill("SIGTERM");
  } else {
    onDone?.();
  }
}
