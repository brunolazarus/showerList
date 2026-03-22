/**
 * Voice pipeline latency benchmark.
 *
 * Feeds synthetic audio frames through the full pipeline and measures
 * end-to-end latency at each stage:
 *
 *   pipeline init → pushFrame entry → VAD onSpeechReady → ASR start → ASR end
 *
 * Run:
 *   pnpm --filter @showerlist/voice build && node dist/scripts/benchmark.js
 *
 * Target: < 1000ms from first frame to command emit on Apple M1.
 */

import { createPipeline } from "../pipeline/index";
import { transcribe } from "../recognition/asr";

const SAMPLE_RATE_48K = 48000;
const SAMPLES_PER_FRAME = 960; // stereo, 10ms at 48kHz
const FRAMES_TO_FEED = 300;    // 3 seconds of audio

/** Stereo white-noise frame — loud enough to survive RNNoise and trigger VAD. */
function makeNoiseFrame(): Int16Array {
  const frame = new Int16Array(SAMPLES_PER_FRAME);
  for (let i = 0; i < frame.length; i++) {
    frame[i] = Math.round((Math.random() * 2 - 1) * 8000);
  }
  return frame;
}

/** Format a duration in ms with 1 decimal place. */
function ms(delta: number): string {
  return `${delta.toFixed(1)} ms`;
}

/** Print a fixed-width results table. */
function printTable(rows: [string, string][]): void {
  const labelW = Math.max(...rows.map(([l]) => l.length)) + 2;
  const sep = "─".repeat(labelW + 16);
  console.log(sep);
  for (const [label, value] of rows) {
    console.log(`  ${label.padEnd(labelW)}${value}`);
  }
  console.log(sep);
}

async function main(): Promise<void> {
  console.log("\nShowerList — Voice Pipeline Latency Benchmark");
  console.log(`Feeding ${FRAMES_TO_FEED} stereo 48kHz frames (${(FRAMES_TO_FEED * 10).toLocaleString()} ms of audio)\n`);

  // ── Stage 1: pipeline initialisation ───────────────────────────────────────
  const t0 = performance.now();

  let speechReadyAt: number | null = null;
  let speechAudio: Float32Array | null = null;

  const pipeline = await createPipeline({
    onSpeechReady: (audio) => {
      if (speechReadyAt === null) {
        speechReadyAt = performance.now();
        speechAudio = audio;
      }
    },
  });

  const initDone = performance.now();

  // ── Stage 2: frame feeding ─────────────────────────────────────────────────
  const feedStart = performance.now();

  for (let i = 0; i < FRAMES_TO_FEED; i++) {
    pipeline.pushFrame(makeNoiseFrame());
  }

  // VAD is async — give it a moment to process the last frames
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
  const feedDone = performance.now();

  pipeline.destroy();

  // ── Stage 3: ASR (only if VAD fired) ──────────────────────────────────────
  let asrStart: number | null = null;
  let asrEnd: number | null = null;
  let transcript = "(VAD did not fire — no speech detected in synthetic audio)";

  if (speechAudio !== null) {
    asrStart = performance.now();
    try {
      transcript = await transcribe(speechAudio);
    } catch (err) {
      transcript = `ASR error: ${String(err)}`;
    }
    asrEnd = performance.now();
  }

  // ── Results ────────────────────────────────────────────────────────────────
  const rows: [string, string][] = [
    ["Pipeline init", ms(initDone - t0)],
    [`Feed ${FRAMES_TO_FEED} frames`, ms(feedDone - feedStart)],
    ["Avg per frame", ms((feedDone - feedStart) / FRAMES_TO_FEED)],
  ];

  if (speechReadyAt !== null) {
    rows.push(["VAD fired after feed start", ms(speechReadyAt - feedStart)]);
  }

  if (asrStart !== null && asrEnd !== null) {
    rows.push(["ASR latency", ms(asrEnd - asrStart)]);
    rows.push([
      "Total (frame entry → ASR done)",
      ms(asrEnd - feedStart),
    ]);
  }

  printTable(rows);

  if (asrStart !== null && asrEnd !== null) {
    const total = asrEnd - feedStart;
    const target = 1000;
    console.log(
      `\nTarget < ${target} ms: ${total < target ? "✓ PASS" : `✗ FAIL (${ms(total - target)} over)`}\n`,
    );
    if (transcript && !transcript.startsWith("(") && !transcript.startsWith("ASR")) {
      console.log(`Transcript: "${transcript}"\n`);
    }
  } else {
    console.log("\nNote: ASR not benchmarked — VAD requires speech-like audio.");
    console.log("Use a real voice WAV for a full end-to-end measurement.\n");
  }
}

main().catch((err: unknown) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
