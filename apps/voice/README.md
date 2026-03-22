# @showerlist/voice

Voice input pipeline for ShowerList. Captures microphone audio, reduces noise,
and detects speech segments for downstream transcription.

## Pipeline

Each captured audio frame flows sequentially through these stages:

```
capture → mono → noiseReduction → calibrate → resample → vad → onSpeechReady
```

| Stage | File | What it does |
|---|---|---|
| Downmix | `pipeline/mono.ts` | Averages stereo 48kHz channels into a single mono frame (960 → 480 Int16 samples) |
| Denoise | `pipeline/noiseReduction.ts` | Runs the mono frame through RNNoise (WASM) to strip background noise |
| Calibrate | `pipeline/calibrate.ts` | During the first 1 second only, measures the ambient noise floor and emits an IPC status event with the SNR result |
| Resample | `pipeline/resample.ts` | Downsamples from 48kHz to 16kHz (3:1), shrinking each frame from 480 to 160 samples |
| VAD | `pipeline/vad.ts` | Accumulates frames until it has 96ms of audio, then runs the Silero model to detect speech. Fires `onSpeechReady` with the full audio segment when speech ends |

`pipeline/index.ts` is the only file you interact with from outside — call
`createPipeline()` once, then `pushFrame()` for every captured audio frame.

## Scripts

### `test-pipeline`

Runs the full pipeline on a WAV file you provide and writes the denoised 16kHz
mono output to a second file. Useful for inspecting the pipeline output on
arbitrary audio.

```
pnpm test-pipeline <input.wav> <output.wav>
```

### `test-pipeline-sample`

Same as above but with both paths hardcoded to the bundled sample WAV. No
arguments needed.

```
pnpm test-pipeline-sample
```
