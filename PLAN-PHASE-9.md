# PLAN-PHASE-9.md — Speech Recognition and Command Extraction

## Objective

Transcribe the captured speech segment and map it to one of the four Spotify commands.
Recognition runs fully offline using a bundled ONNX model.

---

## Files in Scope

| Action | File                                                                |
| ------ | ------------------------------------------------------------------- |
| Create | `apps/voice/src/recognition/asr.ts`                                 |
| Create | `apps/voice/src/recognition/commandMatcher.ts`                      |
| Create | `apps/voice/src/recognition/aliases.ts`                             |
| Modify | `apps/voice/src/index.ts` — wire ASR after activation window closes |

## Files Out of Scope

- `apps/voice/src/pipeline/` — do not touch
- `apps/voice/src/activation/` — do not touch
- `apps/desktop/` — no changes until Phase 10

---

## ASR (`asr.ts`)

- Library: `@xenova/transformers`
- Model: `Xenova/whisper-tiny.en` (ONNX format, English-only, ~80MB)
- Model cache dir: passed via `VOICE_MODEL_CACHE` env var set by the desktop
  process when spawning `apps/voice/`; fall back to `os.tmpdir()` if unset
- First-run: model auto-downloads; emit progress during download:
  `{ type: "status", state: "processing", detail: "model download X%" }`
- Input: `Float32Array` at 16kHz (concatenate all VAD segments)
- Output: transcribed string, lowercased

```ts
export async function transcribe(audio: Float32Array): Promise<string>;
```

Pipeline initialization is lazy (on first call) and module-level cached — do not
re-instantiate on each call.

---

## Command Aliases (`aliases.ts`)

Single source of truth for the vocabulary. Never define aliases inline elsewhere.

```ts
import type { VoiceCommand } from "../ipc.js";

export const COMMAND_ALIASES: Record<VoiceCommand, string[]> = {
  skip: ["skip", "next", "forward"],
  previous: ["back", "previous", "prev", "rewind"],
  pause: ["pause", "stop", "wait"],
  play: ["play", "resume", "go", "continue"],
};
```

---

## Command Matcher (`commandMatcher.ts`)

Input: raw transcript string
Output: `VoiceCommand | null`

Matching pipeline (in order, return on first match):

1. Normalize: lowercase, strip punctuation, trim
2. Exact word match against any alias
3. Substring match: normalized transcript contains an alias word
4. Levenshtein distance ≤ 1 against any alias
5. No match → return `null`

```ts
export function matchCommand(transcript: string): VoiceCommand | null;
```

Levenshtein is a pure function using standard DP (< 20 lines, no external dep).

---

## End-to-End Flow in `index.ts`

1. Activation fires → set state `"listening"`, start 3-second window
2. VAD `onSpeechEnd` appends each segment to the window accumulator
3. After 3 seconds: concatenate all segments into one `Float32Array`
4. Emit `{ type: "status", state: "processing" }` before calling `transcribe`
5. Call `matchCommand(transcript)`
6. Match found: emit `{ type: "command", command: matched }` then
   `{ type: "status", state: "idle" }`
7. No match: emit `{ type: "status", state: "idle", detail: "no match: <transcript>" }`

---

## Acceptance Tests

- `matchCommand("skip this")` → `"skip"`
- `matchCommand("go back")` → `"previous"`
- `matchCommand("nxt")` → `"skip"` (Levenshtein distance 1)
- `matchCommand("unknown thing")` → `null`
- `transcribe` returns non-empty string for a valid 16kHz Float32Array (manual test)
- First-run model download emits IPC progress status messages
- `pnpm typecheck` clean

## Rollback

Delete `apps/voice/src/recognition/`. Revert `apps/voice/src/index.ts` to Phase 8 state.
