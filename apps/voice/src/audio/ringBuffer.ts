// Circular buffer storing the last 2 seconds of 48kHz stereo PCM.
// Each push expects exactly FRAME_INT16_COUNT Int16 values
// (480 stereo pairs × 2 channels = 960 values, 1920 bytes per frame).

const FRAME_INT16_COUNT = 960; // 480 samples × 2 channels
const CAPACITY_FRAMES = 200; // 200 × 10ms = 2 seconds

export class RingBuffer {
  private readonly buf: Int16Array;
  private writeIdx = 0;
  private frameCount = 0;

  constructor(
    private readonly frameSize = FRAME_INT16_COUNT,
    private readonly capacity = CAPACITY_FRAMES,
  ) {
    this.buf = new Int16Array(frameSize * capacity);
  }

  push(frame: Int16Array): void {
    this.buf.set(frame, this.writeIdx * this.frameSize);
    this.writeIdx = (this.writeIdx + 1) % this.capacity;
    if (this.frameCount < this.capacity) this.frameCount++;
  }

  /** Number of frames currently stored (0 to capacity). */
  get size(): number {
    return this.frameCount;
  }
}
