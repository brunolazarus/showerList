import { app, Tray, Menu, nativeImage } from "electron";
import type { MenuItemConstructorOptions } from "electron";
import { join } from "path";
import { config } from "dotenv";
import { loadTokens } from "./tokenStore";
import {
  startAuth,
  handleCallback,
  setAuthTimeoutHandler,
} from "./oauthManager";
import * as spotifyService from "./spotifyService";
import type { SpotifyError } from "@showerlist/spotify-client";
import { createVoiceManager, VoiceManager } from "./voiceManager";
import { isVoiceEnabled, setVoiceEnabled } from "./settingsStore";

// Load .env from workspace root.
// __dirname = apps/desktop/dist/main at runtime, so go up 4 levels.
config({ path: join(__dirname, "..", "..", "..", "..", ".env") });

// Fail fast: SPOTIFY_CLIENT_ID is required for any Spotify interaction.
if (!process.env["SPOTIFY_CLIENT_ID"]) {
  console.error(
    "[ShowerList] FATAL: SPOTIFY_CLIENT_ID environment variable is not set. " +
      "Add it to the .env file at the repository root.",
  );
  process.exit(1);
}

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let tray: Tray | null = null;
let titlePollInterval: ReturnType<typeof setInterval> | null = null;
let voiceManager: VoiceManager | null = null;

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

function startVoice(): void {
  if (voiceManager?.isRunning()) return;
  voiceManager = createVoiceManager({
    onCommand: (cmd) => {
      const dispatch = (): Promise<{ ok: boolean; error?: SpotifyError }> => {
        switch (cmd) {
          case "skip":     return spotifyService.cmdNext();
          case "previous": return spotifyService.cmdPrevious();
          case "pause":    return spotifyService.cmdPause();
          case "play":     return spotifyService.cmdPlay();
        }
      };
      dispatch()
        .then((result) => {
          if (result.ok) {
            tray?.setToolTip("ShowerList");
            scheduleTrackRefresh();
          } else {
            handleCommandError(result.error!);
          }
        })
        .catch(() => {});
    },
    onStatusChange: (state) => {
      if (state === "listening") {
        tray?.setToolTip("ShowerList — Listening…");
      } else if (state === "processing") {
        tray?.setToolTip("ShowerList — Processing…");
      } else if (state === "ready" || state === "idle") {
        tray?.setToolTip("ShowerList");
      } else if (state === "error") {
        tray?.setToolTip("ShowerList — Voice error");
      }
    },
  });
  voiceManager.start().catch((err: unknown) => {
    console.error("[ShowerList] Voice process failed:", err);
    voiceManager = null;
    refreshMenu();
  });
}

function stopVoice(): void {
  voiceManager?.stop();
  voiceManager = null;
}

function handleCommandError(error: SpotifyError): void {
  if (error.code === "no_active_device") {
    tray?.setToolTip("ShowerList — No active Spotify device");
  } else if (error.code === "premium_required") {
    tray?.setToolTip("ShowerList — Spotify Premium required");
  } else if (error.code === "unauthorized") {
    spotifyService.disconnect();
    stopTitlePolling();
    tray?.setTitle("");
    tray?.setToolTip("ShowerList — Session expired, reconnect");
    refreshMenu();
  } else {
    tray?.setToolTip("ShowerList — Spotify error");
  }
}

function startTitlePolling(): void {
  if (titlePollInterval) return;
  titlePollInterval = setInterval(() => {
    updateTrayTitle().catch(() => {});
  }, 30_000);
}

function stopTitlePolling(): void {
  if (titlePollInterval) {
    clearInterval(titlePollInterval);
    titlePollInterval = null;
  }
}

function scheduleTrackRefresh(): void {
  setTimeout(() => {
    updateTrayTitle().catch(() => {});
  }, 500);
}

async function updateTrayTitle(): Promise<void> {
  if (!spotifyService.isConnected()) {
    tray?.setTitle("");
    return;
  }
  const result = await spotifyService.fetchCurrentTrack();
  if (result.ok && result.value) {
    tray?.setTitle(`${result.value.artists[0]} — ${result.value.name}`);
  } else {
    tray?.setTitle("");
  }
}

function onAuthSuccess(): void {
  const cid = process.env["SPOTIFY_CLIENT_ID"] ?? "";
  if (!cid) return;
  const stored = loadTokens();
  if (stored.ok) {
    spotifyService.init(stored.value, cid);
    startTitlePolling();
    updateTrayTitle().catch(() => {});
  } else if (stored.error !== "No tokens stored") {
    tray?.setToolTip("ShowerList — Token load failed, reconnect");
    refreshMenu();
  }
  tray?.setToolTip("ShowerList");
  refreshMenu();
}

function buildMenu(): MenuItemConstructorOptions[] {
  const connected = spotifyService.isConnected();

  return [
    {
      label: "⏮  Previous",
      enabled: connected,
      click: () => {
        spotifyService
          .cmdPrevious()
          .then((result) => {
            if (result.ok) {
              tray?.setToolTip("ShowerList");
              scheduleTrackRefresh();
            } else {
              handleCommandError(result.error);
            }
          })
          .catch(() => {});
      },
    },
    {
      label: "⏸  Pause / ▶  Play",
      enabled: connected,
      click: () => {
        spotifyService
          .cmdToggle()
          .then((result) => {
            if (result.ok) {
              tray?.setToolTip("ShowerList");
              scheduleTrackRefresh();
            } else {
              handleCommandError(result.error);
            }
          })
          .catch(() => {});
      },
    },
    {
      label: "⏭  Skip",
      enabled: connected,
      click: () => {
        spotifyService
          .cmdNext()
          .then((result) => {
            if (result.ok) {
              tray?.setToolTip("ShowerList");
              scheduleTrackRefresh();
            } else {
              handleCommandError(result.error);
            }
          })
          .catch(() => {});
      },
    },
    { type: "separator" },
    {
      label: isVoiceEnabled() ? "🎙  Voice: On" : "🎙  Voice: Off",
      click: () => {
        const next = !isVoiceEnabled();
        setVoiceEnabled(next);
        if (next) {
          startVoice();
        } else {
          stopVoice();
        }
        refreshMenu();
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

  // Start voice input if enabled
  if (isVoiceEnabled()) {
    startVoice();
  }

  // Load stored tokens and init service if available
  const clientId = process.env["SPOTIFY_CLIENT_ID"] ?? "";
  if (clientId) {
    const stored = loadTokens();
    if (stored.ok) {
      spotifyService.init(stored.value, clientId);
      startTitlePolling();
      updateTrayTitle().catch(() => {});
      refreshMenu();
    } else if (stored.error !== "No tokens stored") {
      tray?.setToolTip("ShowerList — Token load failed, reconnect");
      refreshMenu();
    }
  }
});

// macOS: deep-link arrives here when app is already running
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleCallback(url)
    .then((result) => {
      if (result.ok) {
        onAuthSuccess();
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
        onAuthSuccess();
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
