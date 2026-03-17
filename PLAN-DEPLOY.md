# PLAN-DEPLOY.md — Distribution & Deployment

> This is a personal-use macOS app. No server. No CI pipeline required for MVP.
> Update this file when distribution requirements change.

---

## Target

| Attribute | Value |
|---|---|
| Platform | macOS 13+ (Ventura and later) |
| Architecture | arm64 (Apple Silicon) + x64 (Intel) via universal binary |
| Distribution | Direct `.dmg` — no App Store, no notarization for personal use |
| Auto-update | Not in scope for MVP |

---

## Build Tool

**electron-builder** — added to `apps/desktop` devDependencies in Phase 4/5.

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
    "files": [
      "dist/**/*",
      "assets/**/*",
      "!assets/README.md"
    ],
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

| File | Size | Purpose |
|---|---|---|
| `apps/desktop/assets/trayIconTemplate.png` | 16×16 or 22×22 px | Menu bar icon |
| `apps/desktop/assets/icon.icns` | 512×512 source | App icon for Finder + .dmg |

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
