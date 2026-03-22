# PLAN-PHASE-11.md — Voice Hardening and Testing

## Objective

Harden the voice pipeline against real-world shower conditions, close test coverage
gaps, validate end-to-end latency, and update packaging and deployment docs.

---

## Files in Scope

| Action | File                                                        |
| ------ | ----------------------------------------------------------- |
| Create | `apps/voice/src/activation/clapDetector.test.ts`            |
| Create | `apps/voice/src/recognition/commandMatcher.test.ts`         |
| Create | `apps/voice/src/recognition/asr.test.ts`                    |
| Create | `apps/voice/scripts/benchmark.ts`                           |
| Create | `apps/voice/test-fixtures/` — WAV test fixtures (see below) |
| Modify | `PLAN-TESTING.md` — add voice section                       |
| Modify | `PLAN-DEPLOY.md` — add voice packaging items                |
| Modify | `vitest.config.ts` — include `apps/voice/**/*.test.ts`      |

---

## Unit Tests

### `clapDetector.test.ts`

Synthesize `Int16Array` buffers programmatically — no audio hardware required. Tests should use fake timers (`vi.useFakeTimers`) to control clap timing and cooldowns precisely.

| Scenario                                 | Expected                                        |
| ---------------------------------------- | ----------------------------------------------- |
| Single clap, then advance timer > 600ms  | `onSingleClap` fires once                       |
| Double clap, 300ms gap                   | `onDoubleClap` fires once                       |
| Double clap, 300ms gap                   | `onSingleClap` does not fire                    |
| Double clap, gap > 600ms (too slow)      | `onSingleClap` fires twice (once for each clap) |
| Double clap, gap < 150ms (too fast)      | `onSingleClap` fires once (for the second clap) |
| Event fires, then another clap within 2s | The second clap is ignored due to cooldown      |
| Low-amplitude spikes (below threshold)   | No event fires                                  |

### `commandMatcher.test.ts`

| Input                                 | Expected                                                              |
| ------------------------------------- | --------------------------------------------------------------------- |
| `"skip"`                              | `"skip"`                                                              |
| `"NEXT!"`                             | `"skip"` (normalized)                                                 |
| `"please skip this track"`            | `"skip"` (substring)                                                  |
| `"nxt"`                               | `"skip"` (Levenshtein 1)                                              |
| `"bak"`                               | `"previous"` (Levenshtein 1)                                          |
| `"rezume"`                            | `"play"` (Levenshtein 2 — expect null or play depending on threshold) |
| `"hello world"`                       | `null`                                                                |
| `"stop and play"`                     | `"pause"` (first match wins)                                          |
| All primary aliases from `aliases.ts` | correct command                                                       |

### `asr.test.ts`

- Mock `@xenova/transformers` pipeline to return a controlled transcript
- Verify `transcribe()` lowercases output
- Verify model cache path uses `VOICE_MODEL_CACHE` env var when set

---

## Integration Test (manual, not part of `pnpm test`)

Extend `apps/voice/scripts/testPipeline.ts` (from Phase 7):

- Accept a WAV file of someone saying a command in shower background noise
- Assert the final dispatched command matches expected
- Document as a manual step in `PLAN-TESTING.md`

---

## Latency Benchmark (`scripts/benchmark.ts`)

Measure end-to-end: first audio frame enters pipeline → `VoiceCommandMessage` emitted.

Steps:

1. Feed a pre-recorded 16kHz WAV of "skip" through the full pipeline programmatically
2. Record timestamps at: pipeline entry, VAD `onSpeechEnd`, ASR start, ASR end, command emit
3. Print a results table to stdout
4. Target: < 1000ms total on Apple M1 (Whisper-tiny typically runs in 40–80ms on M1)

---

## Packaging Updates (`PLAN-DEPLOY.md`)

Add to the electron-builder packaging checklist:

- Bundle `apps/voice/dist/` as `extraResources` alongside the main app
- Include the Porcupine `.ppn` keyword file in `extraResources`
- Add `NSMicrophoneUsageDescription` to Info.plist (required by macOS for mic access)
- `PICOVOICE_ACCESS_KEY` must be bundled or prompted — document the approach
- Verify `resolveVoiceBinary()` resolves correctly in packaged mode (`process.resourcesPath`)

---

## Testing Checklist Updates (`PLAN-TESTING.md`)

Manual acceptance tests to add:

- [ ] Double-clap with water running → Spotify command executes
- [ ] Say wake word → tray shows "Listening…" → say "next" → track skips
- [ ] Say unrecognized word → no command fired, tray returns to idle
- [ ] Voice enabled on restart → voice process starts automatically
- [ ] Voice process killed externally → restarts with backoff, tray reflects state
- [ ] First launch with no cached model → download progress shown, command works after

---

## Exit Criteria

- `pnpm typecheck` clean
- `pnpm test` passes all new unit tests
- Benchmark script runs and reports latency
- `PLAN-DEPLOY.md` updated with mic entitlement and resource bundling steps
- `PLAN-TESTING.md` updated with manual voice smoke tests
- Manual smoke tests performed and recorded

## Rollback

Revert test files and doc changes independently. No production code is modified in this phase.
