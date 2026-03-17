# OVERVIEW.md — ShowerList App Structure & Electron Internals

> Reference document for understanding the codebase architecture.
> Written against the Phase 2 implementation state.

---

## The Electron Mental Model

Electron runs **two completely separate JavaScript runtimes** in the same process group. Most bugs and all security mistakes in Electron come from not understanding this split.

```
┌─────────────────────────────────────────────────────────┐
│  Main Process  (Node.js — full OS access)               │
│  apps/desktop/src/main/                                 │
│  - Tray, menus, native OS integrations                  │
│  - File system, crypto, network calls                   │
│  - Spawns and controls Renderer windows                 │
│  - The only process that can use Electron APIs          │
└──────────────────┬──────────────────────────────────────┘
                   │  IPC (inter-process communication)
                   │  ipcMain.handle / ipcRenderer.invoke
┌──────────────────▼──────────────────────────────────────┐
│  Renderer Process  (Chromium — browser sandbox)         │
│  apps/desktop/src/renderer/   ← doesn't exist yet      │
│  - HTML/CSS/JS, like a web page                         │
│  - Intentionally limited OS access                      │
│  - Cannot call Electron main-process APIs directly      │
└─────────────────────────────────────────────────────────┘
```

**For ShowerList, there is no renderer.** It's a tray-only app. There are no windows, no HTML, no browser sandbox. Everything runs in the Main Process. This is the simplest possible Electron architecture.

---

## File-by-file: What Lives Where and Why

### `apps/desktop/package.json` — the entry point declaration

```json
"main": "dist/main/index.js"
```

This tells Electron where to find the compiled main process entrypoint. The source is `src/main/index.ts`; TypeScript compiles it to `dist/main/index.js`. If this path is wrong, the app silently fails to start.

---

### `src/main/index.ts` — the app's nervous system

This is the **only file Electron calls directly**. Everything else is imported from here.

Key Electron concepts used in this file:

**`app.requestSingleInstanceLock()`**
Ensures only one copy runs. If you launch a second instance (e.g. double-click the tray icon), Electron fires `second-instance` on the first instance instead — which is also where the OAuth deep-link code (`argv` parsing for Windows/Linux) needs to live.

**`app.dock?.hide()`**
The `?.` is important — `app.dock` only exists on macOS. This line makes the app invisible in the Dock. Without it you'd see a Dock icon that does nothing useful.

**`app.whenReady()`**
Electron is not ready to create UI (tray, windows) until this promise resolves. Creating a `Tray` before `whenReady` throws. This is a very common crash in Electron apps.

**`app.setAsDefaultProtocolClient("showerlist")`**
Tells macOS "when the OS opens a `showerlist://` URL, launch this app". Must be called before the browser redirect fires — that's why it's in `whenReady`, not inside the auth flow.

**`app.on("open-url")`**
macOS-only event. Fires when another process (here: the browser) navigates to `showerlist://callback?code=...`. The second argument is the full URL string. This is how the OAuth callback reaches the app.

**`app.on("window-all-closed")`**
Normally Electron quits when all windows close. Tray apps must NOT quit here, so this handler is intentionally empty (or absent). Without overriding it, the app would quit the moment any window you never opened "closes".

**`Tray` and `Menu.buildFromTemplate()`**
The tray icon must be kept alive by holding a module-level reference (`let tray: Tray | null`). If the variable is garbage-collected, the icon disappears silently — a classic Electron gotcha.

**`refreshMenu()` / `tray.on("right-click")`**
Context menus in Electron are static snapshots. To show updated state (connected vs. not), you must rebuild and re-set the menu. That's what `refreshMenu` does and why it's called on `"right-click"` and after a successful OAuth flow.

---

### `src/main/oauthManager.ts` — the OAuth flow

Pure module-level state (`pendingAuth`) holds the in-flight auth attempt. This is safe because there's only one Main Process — no concurrency issues.

**The `showerlist://callback` URL parsing quirk** (already handled in the code):

```
macOS:   hostname = "callback",  pathname = "/"
Windows: hostname = "",          pathname = "/callback"
```

These differ because different OSes parse custom-scheme URLs differently. The code accepts both forms.

**`shell.openExternal()`** opens the URL in the user's default browser. It's powerful and dangerous: if attacker-controlled input ever reached here, it would open arbitrary URLs. That's why there's an explicit guard:

```ts
if (!authUrl.startsWith("https://accounts.spotify.com/authorize")) {
  throw new Error(...)
}
```

This is a programming-error guard, not user-input validation — the URL is always constructed by us, never from external input.

---

### `src/main/tokenStore.ts` — the secrets vault

**`safeStorage`** is Electron's wrapper around:

- macOS: Keychain Services
- Windows: DPAPI
- Linux: libsecret / kwallet

`safeStorage.encryptString()` returns a `Buffer` of encrypted bytes — not readable plaintext. `app.getPath("userData")` returns the OS-appropriate config directory:

- macOS: `~/Library/Application Support/ShowerList/`
- Windows: `%APPDATA%\ShowerList\`

The token file on disk contains encrypted bytes, not JSON. Even if someone dumps the filesystem they can't read the tokens without the OS credentials.

**`isEncryptionAvailable()`** can return `false` in headless/CI environments and on some Linux configurations without a secret service daemon. Always check before using — the code does this, and the Vitest tests mock it accordingly.

---

### `src/shared/types.ts` — the contract layer

Zero imports from Electron or Node. This is intentional: if a renderer process is added later, it can import types from here without pulling in Node/Electron APIs into the browser sandbox, which would break Chromium's security model.

---

### `tsconfig.json` compile output path

```json
"outDir": "dist",
"rootDir": "src"
```

`src/main/index.ts` → `dist/main/index.js`
`src/shared/types.ts` → `dist/shared/types.js`

`package.json` says `"main": "dist/main/index.js"` — these must match exactly.

The `.env` path in `index.ts` uses four `..` levels because `__dirname` at runtime is `apps/desktop/dist/main/`:

```ts
join(__dirname, "..", "..", "..", "..", ".env");
//    dist/main    dist  desktop  apps  root
```

---

## Caveats Worth Knowing

| Caveat                                                                       | Impact                                                      | Where it matters                                                       |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Tray` lost to GC if not held in a module variable                           | Icon disappears silently                                    | `index.ts` — `let tray` must be module-level                           |
| `app.dock` only exists on macOS                                              | Crash on Windows/Linux if not optional-chained              | `app.dock?.hide()`                                                     |
| `open-url` is macOS only                                                     | Windows/Linux use `second-instance` + `argv`                | Both event handlers needed                                             |
| Menu is a static snapshot                                                    | Stale state shown to user                                   | Must call `refreshMenu()` after state changes                          |
| `app.whenReady()` must complete before any UI                                | Crash if `new Tray()` called too early                      | Everything in `whenReady().then(...)`                                  |
| `safeStorage` unavailable in headless environments                           | Tests can't use real `safeStorage`                          | Mock it in Vitest — already done in `tokenStore.test.ts`               |
| TypeScript compiles to `dist/` — `pnpm dev` runs `tsc && electron .`         | Source edits require recompile                              | Add `tsc --watch` in Phase 5 for faster iteration                      |
| `showerlist://` URL scheme may not fire in `pnpm dev` on some macOS versions | Deep-link callback doesn't reach the app during development | Run `electron .` once to register the scheme at OS level — it persists |

---

## What Doesn't Exist Yet (and why that's fine)

| Missing piece              | Why absent                                  | When added                         |
| -------------------------- | ------------------------------------------- | ---------------------------------- |
| `src/renderer/`            | No UI window needed — tray is the entire UI | Only if a settings window is added |
| `packages/spotify-client/` | Isolated REST wrapper, built separately     | Phase 3                            |
| `preload.ts`               | Only needed to bridge Main ↔ Renderer       | Not applicable without a renderer  |
| IPC handlers               | No renderer = no IPC needed                 | Not applicable                     |

The structure is as minimal as correct Electron gets for a tray-only app.

---

## Current Module Dependency Graph

```
index.ts
├── tokenStore.ts       (safeStorage read/write)
├── oauthManager.ts     (PKCE flow, shell.openExternal)
│   ├── tokenStore.ts   (save tokens after exchange)
│   └── shared/types.ts (Result<T>, TokenData)
└── shared/types.ts     (MenuItemConstructorOptions re-exported shape)

tokenStore.ts
└── shared/types.ts

shared/types.ts         (no imports — pure types)
```

`packages/spotify-client/` (Phase 3) will depend only on `shared/types.ts` and have
**no Electron imports** — it must remain a pure Node/fetch module so it can be reused
by the voice pipeline in `apps/voice/` later.
