import { emit } from "./ipc";
import { startCapture, stopCapture } from "./audio/capture";
import { RingBuffer } from "./audio/ringBuffer";
import { createPipeline, Pipeline } from "./pipeline";
import { downmixToMono } from "./pipeline/mono";
import { createClapDetector } from "./activation/clapDetector";

const ringBuffer = new RingBuffer();
let pipeline: Pipeline | null = null;

// Optimistically assume playback is active when the app starts.
let isPlaying = true;

const clapDetector = createClapDetector({
  sampleRate: 48000,
  onSingleClap: () => {
    // Toggle pause/play based on local state.
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

function shutdown(): void {
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
  onSpeechReady: (_audio) => {
    // Phase 9.1 will wire ASR here; for now just signal activity.
    emit({ type: "status", state: "processing" });
  },
})
  .then((p) => {
    pipeline = p;
    try {
      startCapture((frame) => {
        ringBuffer.push(frame);

        // Feed pre-RNNoise mono to the clap detector to preserve transient energy.
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
