# PLAN-PHASE-6.md — Voice App Foundation

## Objective

Bootstrap `apps/voice/` as an isolated Node.js package that captures raw PCM audio
from the built-in microphone and communicates with the Electron main process via
stdout JSON messages.

After this phase:

- `apps/voice/` builds cleanly under pnpm workspaces
- The package captures mic audio and writes raw PCM to a ring buffer
- A well-defined IPC protocol connects the voice process to the desktop app (stub only at this phase)

---

## Files in Scope

| Action | File                                                  |
| ------ | ----------------------------------------------------- |
| Create | `apps/voice/package.json`                             |
| Create | `apps/voice/tsconfig.json`                            |
| Create | `apps/voice/src/index.ts`                             |
| Create | `apps/voice/src/ipc.ts`                               |
| Create | `apps/voice/src/audio/capture.ts`                     |
| Create | `apps/voice/src/audio/ringBuffer.ts`                  |
| Modify | `pnpm-workspace.yaml` — no change required (`apps/*`) |

## Files Out of Scope

- `packages/spotify-client/` — do not touch
- `apps/desktop/src/main/index.ts` — voice process spawn wired in Phase 10

---

## Hard Boundaries

- Do not import from `electron`
- Do not open external URLs
- Do not read or write token files
- IPC is stdout-only (stdin reserved for future control messages)

---

## IPC Protocol

Line-delimited JSON written to stdout. Two message types:

```ts
// apps/voice/src/ipc.ts
export type VoiceCommand = "skip" | "previous" | "pause" | "play";

export type VoiceCommandMessage = {
  type: "command";
  command: VoiceCommand;
};

export type VoiceStatusMessage = {
  type: "status";
  state: "idle" | "listening" | "processing" | "error";
  detail?: string;
};

export type VoiceMessage = VoiceCommandMessage | VoiceStatusMessage;
```

`emit(msg: VoiceMessage)` writes `JSON.stringify(msg) + "\n"` to `process.stdout`.

---

## Audio Capture

- Backend: SoX `rec` binary spawned from Node.js (`child_process.spawn`)
- Input config: 48kHz, 16-bit signed PCM, 2 channels (stereo), device = default
- Frame size: 480 samples (10ms at 48kHz) — required by RNNoise in Phase 7
- Ring buffer: circular, 2-second capacity (96 000 stereo samples), typed as `Int16Array`
- Runtime prerequisite: `rec` must be available in PATH (`brew install sox` on macOS)

`capture.ts` exposes:

```ts
startCapture(onFrame: (frame: Int16Array) => void): void
stopCapture(): void
```

`capture.ts` handles recorder process lifecycle (spawn, stderr drain, and SIGTERM shutdown)
to avoid native addon ABI issues.

---

## Acceptance Tests

- `pnpm --filter @showerlist/voice build` succeeds
- `pnpm typecheck` passes across all packages
- `command -v rec` returns a valid executable path
- Running `node apps/voice/dist/index.js` captures audio without crashing
- Stdout emits `{"type":"status","state":"idle"}` on startup

## Rollback

Delete `apps/voice/` and revert `pnpm-workspace.yaml` only if workspace globs were changed.
