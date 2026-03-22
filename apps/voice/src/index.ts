import { emit } from "./ipc";
import { startCapture, stopCapture } from "./audio/capture";
import { RingBuffer } from "./audio/ringBuffer";
import { createPipeline, Pipeline } from "./pipeline";
import { downmixToMono } from "./pipeline/mono";
import { createClapDetector } from "./activation/clapDetector";
import { transcribe } from "./recognition/asr";
import { matchCommand } from "./recognition/commandMatcher";

const ringBuffer = new RingBuffer();
let pipeline: Pipeline | null = null;

// Optimistically assume playback is active when the app starts.
let isPlaying = true;

// ---------------------------------------------------------------------------
// Listening window state
// ---------------------------------------------------------------------------

const LISTEN_WINDOW_MS = 3000;
let listening = false;
let listenTimer: ReturnType<typeof setTimeout> | null = null;
const audioAccumulator: Float32Array[] = [];

function startListeningWindow(): void {
  if (listening) return;
  listening = true;
  audioAccumulator.length = 0;
  emit({ type: "status", state: "listening" });

  listenTimer = setTimeout(() => {
    listening = false;
    listenTimer = null;
    void processAccumulatedAudio();
  }, LISTEN_WINDOW_MS);
}

async function processAccumulatedAudio(): Promise<void> {
  if (audioAccumulator.length === 0) {
    emit({ type: "status", state: "idle" });
    return;
  }

  const totalLen = audioAccumulator.reduce((s, f) => s + f.length, 0);
  const combined = new Float32Array(totalLen);
  let pos = 0;
  for (const seg of audioAccumulator) {
    combined.set(seg, pos);
    pos += seg.length;
  }

  emit({ type: "status", state: "processing" });

  const transcript = await transcribe(combined);
  const command = matchCommand(transcript);

  if (command !== null) {
    emit({ type: "command", command });
  } else {
    emit({ type: "status", state: "idle", detail: `no match: ${transcript}` });
    return;
  }

  emit({ type: "status", state: "idle" });
}

// ---------------------------------------------------------------------------
// Clap detector
// ---------------------------------------------------------------------------

const clapDetector = createClapDetector({
  sampleRate: 48000,
  onSingleClap: () => {
    if (isPlaying) {
      isPlaying = false;
      emit({ type: "command", command: "pause" });
    } else {
      isPlaying = true;
      emit({ type: "command", command: "play" });
    }
  },
  onDoubleClap: () => {
    emit({ type: "command", command: "skip" });
  },
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

function shutdown(): void {
  if (listenTimer !== null) clearTimeout(listenTimer);
  clapDetector.destroy();
  pipeline?.destroy();
  stopCapture(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

emit({ type: "status", state: "idle" });

function onCaptureError(err: Error): void {
  emit({ type: "status", state: "error", detail: err.message });
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
}

createPipeline({
  onSpeechReady: (audio) => {
    if (listening) {
      audioAccumulator.push(audio);
    }
  },
})
  .then((p) => {
    pipeline = p;
    try {
      let captureStarted = false;
      startCapture((frame) => {
        if (!captureStarted) {
          captureStarted = true;
          emit({ type: "status", state: "ready" });
        }
        ringBuffer.push(frame);
        const mono = downmixToMono(frame);
        clapDetector.pushFrame(mono);
        pipeline!.pushFrame(frame);
      }, onCaptureError);
    } catch (err) {
      onCaptureError(err instanceof Error ? err : new Error(String(err)));
    }
  })
  .catch((err: unknown) => {
    onCaptureError(err instanceof Error ? err : new Error(String(err)));
  });
