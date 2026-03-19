import { emit } from "./ipc";
import { startCapture, stopCapture } from "./audio/capture";
import { RingBuffer } from "./audio/ringBuffer";

const ringBuffer = new RingBuffer();

function shutdown(): void {
  stopCapture();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

emit({ type: "status", state: "idle" });

startCapture((frame) => {
  ringBuffer.push(frame);
});
