# ShowerList

Spotify voice controller for noisy environments. Clap to skip, pause, or play — no hands needed.

## How it works

```
[Desktop tray app]
  └─ startVoice() on app.whenReady()           ← voice enabled by default
       └─ voiceManager.start()
            └─ spawn("node", ["apps/voice/dist/index.js"])
                  │  stdout (JSON lines)
                  ▼
            readline → parse VoiceMessage
                  │
            ┌─────┴────────────────┐
            │ type:"command"        │ type:"status"
            ▼                      ▼
     onCommand(cmd)         onStatusChange(state)
     → spotifyService.      → tray.setToolTip(…)
       cmdNext/Pause/etc.
```