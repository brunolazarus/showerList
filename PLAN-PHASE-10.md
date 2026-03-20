# PLAN-PHASE-10.md — Desktop Integration

## Objective

Spawn the voice process from the Electron main process, dispatch received commands
to the existing Spotify service, surface voice state in the tray, and handle
microphone permissions and voice process lifecycle.

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

Owns the voice process lifecycle.

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

Implementation notes:

- Spawn: `child_process.spawn("node", [resolveVoiceBinary()], { env: buildVoiceEnv() })`
- `resolveVoiceBinary()`: in dev, path relative to `__dirname`; in packaged app use
  `process.resourcesPath` — distinguish with `app.isPackaged`
- `buildVoiceEnv()`: spreads `process.env`, adds `VOICE_MODEL_CACHE` set to
  `app.getPath("userData")`
- Parse stdout with `readline.createInterface` on `child.stdout`; `JSON.parse` each
  line — never pass unparsed strings to callers; skip malformed lines silently
- stderr lines are forwarded to `console.error` only
- On unexpected process exit: exponential backoff restart (delays: 1s, 2s, 4s);
  after 3 failures emit `onStatusChange("error")` and stop retrying

---

## `settingsStore.ts`

Lightweight persistent settings (not sensitive, no encryption).

```ts
export type Settings = {
  voiceEnabled: boolean;
};

export function loadSettings(): Settings;
export function saveSettings(s: Settings): void;
```

Stored as JSON at `app.getPath("userData")/settings.json`.
Read synchronously at startup only (small file, startup path only).
Default: `{ voiceEnabled: false }`.

---

## Microphone Permission

Check and request before first voice start:

```ts
const status = systemPreferences.getMediaAccessStatus("microphone");
if (status === "not-determined") {
  const granted = await systemPreferences.askForMediaAccess("microphone");
  if (!granted) {
    /* surface error, do not start */
  }
} else if (status !== "granted") {
  /* surface error, do not start */
}
```

On denied: set tray item to "Microphone access denied — check System Settings".
Do not crash; do not retry the permission prompt automatically.

---

## Tray Menu Changes

Append to the tray menu after the existing playback items, separated by a divider:

```
─────────────────────────────
Voice: ON  (click to disable)    ← when running and idle
Listening…                        ← when state = "listening" or "processing"
─────────────────────────────
Voice: OFF  (click to enable)    ← when stopped
─────────────────────────────
```

Use the existing `refreshMenu()` pattern — do not introduce a separate menu-building path.
Voice state changes call `refreshMenu()`.

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

Reuse the exact same `spotifyService` functions used by tray actions. No duplication.

---

## Acceptance Tests

- Enabling voice from tray starts the voice process; tray updates
- Disabling voice from tray stops the process cleanly
- Voice command received → correct Spotify action executes
- Voice process crash → restarts with backoff; tray shows error after 3 failures
- Microphone permission denied → tray shows error, voice toggle grayed, no crash
- App launched with `voiceEnabled: false` → voice manager not started
- App launched with `voiceEnabled: true` and mic granted → voice starts automatically
- `pnpm typecheck` clean

## Rollback

Delete `voiceManager.ts` and `settingsStore.ts`. Revert `index.ts` tray changes.
