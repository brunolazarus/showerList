# PLAN-PHASE-10.1.md — Desktop Integration (Direct Command Mapping)

## Objective

Integrate the new direct clap-to-command mapping and wake word voice recognition into the Electron desktop app. Claps trigger Spotify actions directly; only the wake word opens a listening window for ASR.

---

## Files in Scope

| Action | File                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| Create | `apps/desktop/src/main/voiceManager.ts`                                       |
| Create | `apps/desktop/src/main/settingsStore.ts`                                      |
| Modify | `apps/desktop/src/main/index.ts` — voice toggle, tray items, mic permission   |
| Modify | `apps/desktop/src/shared/types.ts` — re-export `VoiceMessage` types if needed |

## Files Out of Scope

- `apps/voice/` — already built; do not modify logic there
- `packages/spotify-client/` — use as-is
- OAuth flow — no changes

---

## `voiceManager.ts`

Owns the voice process lifecycle. Handles both direct command events (from claps) and voice commands (from ASR).

```ts
export function createVoiceManager(opts: {
  onCommand: (cmd: VoiceCommand) => void;
  onStatusChange: (state: VoiceStatusMessage["state"]) => void;
}): {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
};
```

- On receiving a direct command (from clap): dispatch immediately to `spotifyService`
- On receiving a voice command (from ASR): dispatch as before
- All process management, error handling, and tray menu logic as in Phase 10

---

## `settingsStore.ts`

Unchanged from Phase 10.

---

## Microphone Permission

Unchanged from Phase 10.

---

## Tray Menu Changes

Unchanged from Phase 10.

---

## Command Dispatch

In `voiceManager`'s `onCommand` callback wired in `index.ts`:

```ts
onCommand: (cmd) => {
  switch (cmd) {
    case "skip":     void spotifyService.skip();     break;
    case "previous": void spotifyService.previous(); break;
    case "pause":    void spotifyService.pause();    break;
    case "play":     void spotifyService.play();     break;
  }
},
```

---

## Acceptance Tests

- Single clap → pause/play toggled
- Double clap → skip
- Wake word triggers listening window and ASR
- Voice command received → correct Spotify action executes
- All other acceptance tests from Phase 10 apply
- `pnpm typecheck` clean

## Rollback

Delete `voiceManager.ts` and `settingsStore.ts`. Revert `index.ts` tray changes.
