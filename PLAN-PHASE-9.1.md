# PLAN-PHASE-9.1.md — Voice Recognition (Wake Word Only)

## Objective

Transcribe speech and map to Spotify commands **only when activated by the wake word**. Claps do not open a listening window or trigger ASR.

---

## Files in Scope

| Action | File                                                            |
| ------ | --------------------------------------------------------------- |
| Create | `apps/voice/src/recognition/asr.ts`                             |
| Create | `apps/voice/src/recognition/commandMatcher.ts`                  |
| Create | `apps/voice/src/recognition/aliases.ts`                         |
| Modify | `apps/voice/src/index.ts` — wire ASR after wake word activation |

## Files Out of Scope

- `apps/voice/src/pipeline/` — do not touch
- `apps/voice/src/activation/clapDetector.ts` — only emits direct commands
- `apps/desktop/` — no changes until Phase 10.1

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

---

## End-to-End Flow in `index.ts`

1. Wake word fires → set state `"listening"`, start 3-second window
2. VAD `onSpeechEnd` appends each segment to the window accumulator
3. After 3 seconds: concatenate all segments into one `Float32Array`
4. Emit `{ type: "status", state: "processing" }` before calling `transcribe`
5. Call `matchCommand(transcript)`
6. Match found: emit `{ type: "command", command: matched }` then
   `{ type: "status", state: "idle" }`
7. No match: emit `{ type: "status", state: "idle", detail: "no match: <transcript>" }`

---

## Acceptance Tests

- Wake word triggers listening window, claps do not
- ASR and command matching only run after wake word
- All command matcher and ASR tests from Phase 9 apply
- `pnpm typecheck` clean

## Rollback

Delete `apps/voice/src/recognition/`. Revert `apps/voice/src/index.ts` to Phase 8.1 state.
