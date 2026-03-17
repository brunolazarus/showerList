import { safeStorage, app } from "electron";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import type { Result, TokenData } from "../shared/types";

function tokensPath(): string {
  return join(app.getPath("userData"), "tokens");
}

export function saveTokens(data: TokenData): Result<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    return {
      ok: false,
      error: "safeStorage encryption is not available on this system",
    };
  }
  try {
    const json = JSON.stringify(data);
    const encrypted = safeStorage.encryptString(json);
    const dir = app.getPath("userData");
    mkdirSync(dir, { recursive: true });
    writeFileSync(tokensPath(), encrypted);
    return { ok: true, value: undefined };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function loadTokens(): Result<TokenData> {
  if (!safeStorage.isEncryptionAvailable()) {
    return {
      ok: false,
      error: "safeStorage encryption is not available on this system",
    };
  }
  const path = tokensPath();
  if (!existsSync(path)) {
    return { ok: false, error: "No tokens stored" };
  }
  try {
    const encrypted = readFileSync(path);
    const json = safeStorage.decryptString(encrypted);
    const data = JSON.parse(json) as TokenData;
    return { ok: true, value: data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function clearTokens(): void {
  const path = tokensPath();
  if (existsSync(path)) {
    // Zero-fill before unlinking to avoid leaving plaintext remnants
    writeFileSync(path, Buffer.alloc(0));
    unlinkSync(path);
  }
}
