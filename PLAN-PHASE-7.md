# PLAN-PHASE-7.md — Noise Reduction Pipeline

## Objective

Build the audio pre-processing chain that transforms raw 48kHz stereo mic frames
into clean 16kHz mono speech-ready frames, suitable for VAD and ASR.

Pipeline order (each stage feeds the next):

```
Raw PCM (48kHz stereo) → mono downmix → RNNoise (48kHz) → resample 48→16kHz → VAD → clean frames out
```

---

## Files in Scope

| Action | File                                        |
| ------ | ------------------------------------------- |
| Create | `apps/voice/src/pipeline/mono.ts`           |
| Create | `apps/voice/src/pipeline/resample.ts`       |
| Create | `apps/voice/src/pipeline/noiseReduction.ts` |
| Create | `apps/voice/src/pipeline/vad.ts`            |
| Create | `apps/voice/src/pipeline/index.ts`          |
| Create | `apps/voice/src/pipeline/calibrate.ts`      |
| Create | `apps/voice/scripts/testPipeline.ts`        |
| Modify | `apps/voice/src/index.ts` — wire pipeline   |

---

## Stage Specifications

### Mono Downmix (`mono.ts`)

- Average left + right channels: `mono[i] = (stereo[2i] + stereo[2i+1]) / 2`
- Input: `Int16Array` at 48kHz stereo (interleaved)
- Output: `Int16Array` at 48kHz mono

### Noise Reduction (`noiseReduction.ts`)

- Library: `rnnoise-wasm` (pure WebAssembly, no native compilation needed)
- Operates on 480-sample frames at 48kHz mono — must run before resampling
- Input: `Int16Array` 480 samples at 48kHz
- Output: denoised `Int16Array` 480 samples at 48kHz

### Resample (`resample.ts`)

- Downsample 48kHz → 16kHz (factor 3): apply a 7-tap FIR anti-aliasing filter,
  then keep every 3rd sample
- Coefficients are hardcoded constants — no external dep
- Input: `Int16Array` 480 samples at 48kHz
- Output: `Int16Array` 160 samples at 16kHz

### VAD (`vad.ts`)

- Library: `@ricky0123/vad-node` (Silero VAD via ONNX runtime, fully offline)
- Input: 16kHz mono `Float32Array` (convert from Int16: divide by 32768)
- Emits: `onSpeechStart()` / `onSpeechEnd(audio: Float32Array)` callbacks
- `onSpeechEnd` delivers the full speech segment as a contiguous `Float32Array`

### Calibration (`calibrate.ts`)

- On startup, sample 1 second of ambient audio (pre-VAD) before enabling commands
- Compute and log: mean amplitude, peak amplitude, estimated SNR
- Emit via IPC: `{ type: "status", state: "idle", detail: "calibrated snr=Xdb" }`
- Result stored in module-level variable for future threshold tuning

---

## Pipeline Composition (`pipeline/index.ts`)

```ts
export function createPipeline(opts: {
  onSpeechReady: (audio: Float32Array) => void;
}): {
  pushFrame: (raw: Int16Array) => void; // accepts 480-sample 48kHz stereo frames
  destroy: () => void;
};
```

Frame flow inside `pushFrame`:

1. `mono(raw)` → 480-sample mono at 48kHz
2. `rnnoise(mono)` → denoised 480-sample at 48kHz
3. `resample(denoised)` → 160-sample at 16kHz
4. Push 160-sample frame to VAD

---

## Test Harness (`scripts/testPipeline.ts`)

- Reads a WAV file from `argv[2]`, feeds frames through the full pipeline
- Writes denoised 16kHz mono WAV output to `argv[3]`
- Not part of `pnpm test` — run manually for subjective review
- Use public-domain shower background audio from freesound.org as test input

---

## Acceptance Tests

- `pnpm typecheck` clean
- Test harness produces audible denoised output from a noisy WAV input
- VAD fires `onSpeechEnd` for voiced segments and suppresses silence/noise-only segments
- Calibration log line appears on startup before first activation

## Rollback

Delete `apps/voice/src/pipeline/` and `apps/voice/scripts/testPipeline.ts`.
Revert `apps/voice/src/index.ts` to Phase 6 state.
