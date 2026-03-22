# PLAN-PHASE-8.md — Activation Layer

## Objective

Implement two independent activation triggers — clap detection and wake word — that
open a 3-second listening window after either fires.

Only one activation source needs to fire to enter the listening state.

---

## Files in Scope

| Action | File                                                   |
| ------ | ------------------------------------------------------ |
| Create | `apps/voice/src/activation/clapDetector.ts`            |
| Create | `apps/voice/src/activation/wakeWord.ts`                |
| Create | `apps/voice/src/activation/index.ts`                   |
| Modify | `apps/voice/src/index.ts` — integrate activation layer |

## Files Out of Scope

- `apps/voice/src/pipeline/` — do not modify; consume as-is
- `apps/desktop/` — no changes until Phase 10

---

## Clap Detector (`clapDetector.ts`)

Runs on **raw mono PCM before RNNoise** to preserve transient energy.

Detection algorithm:

1. Compute RMS of each 10ms frame
2. Trigger a candidate event when `RMS > rollingBaseline * SPIKE_FACTOR` (SPIKE_FACTOR = 8)
3. `rollingBaseline` = exponential moving average of recent quiet frames (alpha = 0.01)
4. Confirm clap: spectral centroid of the frame must be > 2 kHz
5. Double-clap: two confirmed events with 150–600ms gap → emit activation
6. Cooldown: 2 seconds after any activation (ignore further events)

```ts
export function createClapDetector(opts: {
  onActivation: () => void;
  sampleRate: number; // 48000
}): {
  pushFrame: (mono48k: Int16Array) => void;
  destroy: () => void;
};
```

Spectral centroid uses a 16-point DFT implemented as a pure function (< 20 lines,
no external FFT library).

---

## Wake Word (`wakeWord.ts`)

- Library: `@picovoice/porcupine-node` (offline, free tier)
- Recommended keyword: custom `.ppn` built with the Porcupine keyword builder
  for "hey shower" — avoids conflicts with system assistants
- Fallback: use a built-in keyword from the free tier library
- Input: 16kHz mono `Int16Array` (Porcupine's required format)
- Porcupine frame size is 512 samples at 16kHz; buffer incoming 160-sample frames
  into 512-sample chunks before feeding Porcupine

```ts
export function createWakeWordDetector(opts: {
  onActivation: () => void;
  keywordPath?: string; // path to .ppn file; falls back to built-in if omitted
}): {
  pushFrame: (mono16k: Int16Array) => void;
  destroy: () => void;
};
```

Access key loaded from `process.env.PICOVOICE_ACCESS_KEY` — never hardcoded.

---

## Activation Coordinator (`activation/index.ts`)

Wraps both detectors and exposes a single interface to `index.ts`.

```ts
export function createActivationLayer(opts: { onActivation: () => void }): {
  pushRaw48kMono: (frame: Int16Array) => void; // fed to clap detector
  push16kMono: (frame: Int16Array) => void; // fed to wake word
  destroy: () => void;
};
```

- Tracks `cooldownUntil` timestamp (2 seconds after last activation)
- Both detectors call a shared internal `trigger()` function
- `trigger()` checks cooldown, emits IPC `{ type: "status", state: "listening" }`,
  starts 3-second capture window, then calls `onActivation()`

---

## Listening Window

After activation, `index.ts` accumulates VAD `onSpeechEnd` segments into a buffer
for 3 seconds. At window expiry (or immediately if a full utterance already ended),
the accumulated `Float32Array` is forwarded to ASR in Phase 9.

---

## Acceptance Tests

- Double clap (synthetic Int16Array spike pair, 300ms gap) → `onActivation` fires
- Single clap → no activation
- Double clap outside timing window (gap < 150ms or > 600ms) → no activation
- Second double-clap within 2s cooldown → ignored
- Wake word phrase → `onActivation` fires (manual test with microphone)
- Both triggers active simultaneously; first to fire wins, second ignored during cooldown
- `pnpm typecheck` clean

## Rollback

Delete `apps/voice/src/activation/`. Revert `apps/voice/src/index.ts` to Phase 7 state.
