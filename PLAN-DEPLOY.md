# PLAN-DEPLOY.md — Distribution & Deployment

> This is a personal-use macOS app. No server. No CI pipeline required for MVP.
> Update this file when distribution requirements change.

---

## Target

| Attribute    | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Platform     | macOS 13+ (Ventura and later)                                  |
| Architecture | arm64 (Apple Silicon) + x64 (Intel) via universal binary       |
| Distribution | Direct `.dmg` — no App Store, no notarization for personal use |
| Auto-update  | Not in scope for MVP                                           |

---

## Build Tool

**electron-builder** — added to `apps/desktop` devDependencies in Phase 5 ✅

```bash
pnpm --filter desktop package   # produces .app + .dmg in apps/desktop/dist/
```

---

## electron-builder Config

Add to `apps/desktop/package.json` under `"build"`:

```json
{
  "build": {
    "appId": "com.brunolazaro.showerlist",
    "productName": "ShowerList",
    "mac": {
      "category": "public.app-category.music",
      "target": [{ "target": "dmg", "arch": ["universal"] }],
      "icon": "assets/icon.icns"
    },
    "protocols": [
      {
        "name": "ShowerList",
        "schemes": ["showerlist"]
      }
    ],
    "files": ["dist/**/*", "assets/**/*", "!assets/README.md"],
    "extraMetadata": {
      "main": "dist/main/index.js"
    }
  }
}
```

> The `protocols` block registers `showerlist://` as a deep link scheme in the
> app bundle's `Info.plist`. This is required for the OAuth callback to work in
> the packaged app — `app.setAsDefaultProtocolClient` alone is not sufficient.

---

## Required Assets Before Packaging

| File                                       | Size              | Purpose                                    |
| ------------------------------------------ | ----------------- | ------------------------------------------ |
| `apps/desktop/assets/trayIconTemplate.png` | 16×16 or 22×22 px | Menu bar icon                              |
| `apps/desktop/assets/icon.icns`            | 512×512 source    | Optional custom app icon for Finder + .dmg |

Current Phase 5 status: packaging uses Electron default app icon until
`apps/desktop/assets/icon.icns` is added.

To generate `icon.icns` from a single 1024×1024 PNG:

```bash
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o apps/desktop/assets/icon.icns
```

---

## Build Steps (manual, personal use)

```bash
# 1. Compile TypeScript
cd apps/desktop && pnpm tsc

# 2. Package
pnpm --filter desktop package

# 3. Open .dmg and drag to /Applications
open apps/desktop/dist/*.dmg
```

---

## Voice Process Packaging (Phase 11)

The voice subprocess runs as a separate Node.js process and must be bundled
alongside the Electron app when distributing.

### Bundle the voice dist as extraResources

Add to `apps/desktop/package.json` under `"build"`:

```json
"extraResources": [
  {
    "from": "../../apps/voice/dist",
    "to": "voice/dist",
    "filter": ["**/*"]
  }
]
```

In production, `voiceManager.ts` resolves the path via `process.resourcesPath`:

```ts
const voicePath = app.isPackaged
  ? path.join(process.resourcesPath, "voice", "dist", "index.js")
  : path.join(__dirname, "../../../voice/dist/index.js");
```

### Microphone entitlement (required by macOS)

Add to `apps/desktop/entitlements.mac.plist`:

```xml
<key>com.apple.security.device.audio-input</key>
<true/>
```

And reference it in electron-builder config:

```json
"mac": {
  "entitlements": "entitlements.mac.plist",
  "entitlementsInherit": "entitlements.mac.plist"
}
```

Add `NSMicrophoneUsageDescription` to the app's `Info.plist` via the
electron-builder `extendInfo` field:

```json
"extendInfo": {
  "NSMicrophoneUsageDescription": "ShowerList listens for clap commands to control Spotify."
}
```

### sox prerequisite

The voice capture layer calls `sox rec`. Document in the DMG README:

> **Prerequisite:** install [SoX](https://sox.sourceforge.net) via Homebrew:
> `brew install sox`

### Node.js runtime

The voice subprocess is launched with the system `node` binary. Verify that
`node` is available in the PATH of the Electron process at launch time. For
distribution, consider bundling Node via `pkg` or shipping a standalone binary.

---

## Login Item (Auto-launch on Login)

In the packaged app, add this to `index.ts`:

```ts
app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
```

For development, this can be toggled via System Settings → General → Login Items.

---

## Spotify Developer App Checklist (production)

- [ ] Redirect URI `showerlist://callback` is registered in the Spotify Dashboard
- [ ] `SPOTIFY_CLIENT_ID` is in `.env` (never committed)
- [ ] App is in Extended Quota Mode if you share it with others (max 25 users in dev mode)

---

## Security Notes

- No code signing or notarization for personal use. macOS Gatekeeper will block
  the first launch — right-click → Open to bypass once.
- Tokens are stored in the OS keychain via `safeStorage` — they survive reinstalls
  and system updates.
- If distributing to others: code signing with an Apple Developer ID ($99/yr) is
  required to avoid Gatekeeper prompts.

---

## What Is Out of Scope (MVP)

- Auto-update (Squirrel / electron-updater)
- Code signing / notarization
- App Store submission
- Windows or Linux builds
- Crash reporting / telemetry
