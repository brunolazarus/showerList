import { app } from "electron";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

interface Settings {
  voiceEnabled: boolean;
}

const DEFAULTS: Settings = { voiceEnabled: true };

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

function load(): Settings {
  try {
    const raw = readFileSync(settingsPath(), "utf8");
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: Settings): void {
  mkdirSync(app.getPath("userData"), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(s), "utf8");
}

export function isVoiceEnabled(): boolean {
  return load().voiceEnabled;
}

export function setVoiceEnabled(enabled: boolean): void {
  save({ ...load(), voiceEnabled: enabled });
}
