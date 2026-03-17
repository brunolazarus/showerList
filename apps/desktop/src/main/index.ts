import { app, Tray, Menu, nativeImage } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import { join } from "path";
import { config } from "dotenv";
import { loadTokens } from "./tokenStore";
import { startAuth, handleCallback, setAuthTimeoutHandler } from "./oauthManager";

// Load .env from workspace root.
// __dirname = apps/desktop/dist/main at runtime, so go up 4 levels.
config({ path: join(__dirname, "..", "..", "..", "..", ".env") });

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let tray: Tray | null = null;

function getTrayIcon(): Electron.NativeImage {
  // Production: place a 16x16 or 22x22 PNG at assets/trayIconTemplate.png.
  // Suffix "Template" makes macOS auto-adapt it to light/dark mode.
  const iconPath = join(
    __dirname,
    "..",
    "..",
    "assets",
    "trayIconTemplate.png",
  );
  const img = nativeImage.createFromPath(iconPath);
  if (!img.isEmpty()) {
    return img;
  }
  // Fallback for development when the icon file hasn't been added yet.
  // Replace with a real icon file before shipping.
  console.warn(
    "[ShowerList] trayIconTemplate.png not found — using placeholder icon",
  );
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAH0lEQVQ4T2NkYGBg+E8BZlABRicajBqgbg0wOAAATe4BBQ6T9FEAAAAASUVORK5CYII=",
  );
}

function buildMenu(): MenuItemConstructorOptions[] {
  const tokens = loadTokens();
  const connected = tokens.ok;

  return [
    {
      label: "⏮  Previous",
      enabled: connected,
      click: () => {
        // Wired in Phase 4
      },
    },
    {
      label: "⏸  Pause / ▶  Play",
      enabled: connected,
      click: () => {
        // Wired in Phase 4
      },
    },
    {
      label: "⏭  Skip",
      enabled: connected,
      click: () => {
        // Wired in Phase 4
      },
    },
    { type: "separator" },
    {
      label: connected ? "✓  Connected to Spotify" : "Connect to Spotify…",
      enabled: !connected,
      click: () => {
        const clientId = process.env["SPOTIFY_CLIENT_ID"];
        if (!clientId) {
          console.error("[ShowerList] SPOTIFY_CLIENT_ID is not set");
          return;
        }
        startAuth(clientId).catch((err: unknown) => {
          console.error("[ShowerList] startAuth failed:", err);
        });
      },
    },
    { type: "separator" },
    { label: "Quit ShowerList", role: "quit" },
  ];
}

function refreshMenu(): void {
  tray?.setContextMenu(Menu.buildFromTemplate(buildMenu()));
}

function createTray(): void {
  tray = new Tray(getTrayIcon());
  tray.setToolTip("ShowerList");
  tray.setContextMenu(Menu.buildFromTemplate(buildMenu()));

  // Re-build context menu each time it opens so token state stays current
  tray.on("right-click", refreshMenu);
}

app.whenReady().then(() => {
  // Menu-bar only app — hide from macOS Dock
  app.dock?.hide();

  // Register custom URL scheme for OAuth deep-link callback
  app.setAsDefaultProtocolClient("showerlist");

  // Surface auth timeout via tray tooltip
  setAuthTimeoutHandler(() => {
    tray?.setToolTip("ShowerList — Auth timed out, try again");
    refreshMenu();
  });

  createTray();
});

// macOS: deep-link arrives here when app is already running
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleCallback(url)
    .then((result) => {
      if (result.ok) {
        refreshMenu();
        tray?.setToolTip("ShowerList");
      } else {
        console.error("[ShowerList] OAuth callback error:", result.error);
      }
    })
    .catch((err: unknown) => {
      console.error("[ShowerList] handleCallback threw:", err);
    });
});

// Windows/Linux: deep-link arrives via second-instance argv
app.on("second-instance", (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith("showerlist://"));
  if (!url) return;
  handleCallback(url)
    .then((result) => {
      if (result.ok) {
        refreshMenu();
        tray?.setToolTip("ShowerList");
      } else {
        console.error("[ShowerList] OAuth callback error:", result.error);
      }
    })
    .catch((err: unknown) => {
      console.error("[ShowerList] handleCallback threw:", err);
    });
});

// Keep the process alive when there are no windows open
app.on("window-all-closed", () => {
  // Intentionally do not quit — this is a tray-only app
});
