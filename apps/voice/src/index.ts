import { emit } from "./ipc";
import { startCapture, stopCapture } from "./audio/capture";
import { RingBuffer } from "./audio/ringBuffer";
import { createPipeline, Pipeline } from "./pipeline";

const ringBuffer = new RingBuffer();
let pipeline: Pipeline | null = null;

function shutdown(): void {
  pipeline?.destroy();
  stopCapture(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

emit({ type: "status", state: "idle" });

function onCaptureError(err: Error): void {
  emit({ type: "status", state: "error", detail: err.message });
  // Give stdout a tick to flush before exiting so the parent process receives
  // the structured IPC message before the non-zero exit code arrives.
  process.exitCode = 1;
  setImmediate(() => process.exit(1));
}

createPipeline({
  onSpeechReady: (_audio) => {
    // Phase 8 will transcribe and emit commands; for now just signal activity.
    emit({ type: "status", state: "processing" });
  },
})
  .then((p) => {
    pipeline = p;
    try {
      startCapture((frame) => {
        ringBuffer.push(frame);
        pipeline!.pushFrame(frame);
      }, onCaptureError);
    } catch (err) {
      onCaptureError(err instanceof Error ? err : new Error(String(err)));
    }
  })
  .catch((err: unknown) => {
    onCaptureError(err instanceof Error ? err : new Error(String(err)));
  });
