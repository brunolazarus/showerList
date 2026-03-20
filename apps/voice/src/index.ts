import { emit } from "./ipc";
import { startCapture, stopCapture } from "./audio/capture";
import { RingBuffer } from "./audio/ringBuffer";

const ringBuffer = new RingBuffer();

function shutdown(): void {
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

try {
  startCapture((frame) => {
    ringBuffer.push(frame);
  }, onCaptureError);
} catch (err) {
  onCaptureError(err instanceof Error ? err : new Error(String(err)));
}
