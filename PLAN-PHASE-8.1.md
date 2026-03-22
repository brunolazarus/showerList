# PLAN-PHASE-8.1.md — Direct Clap Command Mapping

## Objective

Replace the activation window model with direct mapping of clap patterns to Spotify commands:

- **Single clap:** Pause/Play toggle
- **Double clap:** Skip to next song

No listening window or voice recognition is triggered by claps. (Wake word activation for voice recognition may remain as a separate path, but is not required in this phase.)

---

## Files in Scope

| Action | File                                        |
| ------ | ------------------------------------------- |
| Modify | `apps/voice/src/activation/clapDetector.ts` |
| Modify | `apps/voice/src/index.ts`                   |

## Files Out of Scope

- `apps/voice/src/pipeline/` — do not modify; consume as-is
- `apps/desktop/` — no changes until Phase 10.1

---

## Clap Detector (`clapDetector.ts`)

- Detects single and double claps as before, but now emits distinct events:
  - `onSingleClap: () => void` (pause/play)
  - `onDoubleClap: () => void` (skip)
- Cooldown: 2 seconds after any event (ignore further claps)
- No listening window is opened by claps.

```ts
export function createClapDetector(opts: {
  onSingleClap: () => void;
  onDoubleClap: () => void;
  sampleRate: number; // 48000
}): {
  pushFrame: (mono48k: Int16Array) => void;
  destroy: () => void;
};
```

---

## Index Integration (`index.ts`)

- Wire `onSingleClap` to toggle pause/play
- Wire `onDoubleClap` to skip
- No listening window or ASR triggered by claps
- (Optional: Wake word path for voice recognition may remain, but is not required)

---

## Acceptance Tests

- Single clap (synthetic) → pause/play toggled
- Double clap (synthetic, 300ms gap) → skip
- Claps during cooldown → ignored
- No listening window opened by claps
- `pnpm typecheck` clean

## Rollback

Revert `clapDetector.ts` and `index.ts` to Phase 8 state.
