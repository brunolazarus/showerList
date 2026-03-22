/**
 * Manages the lifecycle of the voice subprocess.
 *
 * Spawns `apps/voice/dist/index.js` via Node, reads its stdout line-by-line
 * as JSON VoiceMessage objects, and fires typed callbacks. The start() promise
 * resolves once the voice process emits { type:"status", state:"ready" },
 * signalling that audio capture is live.
 */

import { spawn } from "child_process";
import { createInterface } from "readline";
import { join } from "path";
import { app } from "electron";
import type { VoiceCommand, VoiceMessage, VoiceStatusMessage } from "../shared/types";

// __dirname = apps/desktop/dist/main at runtime
const DEFAULT_VOICE_PATH = join(__dirname, "../../../voice/dist/index.js");

export interface VoiceManagerOptions {
  onCommand: (cmd: VoiceCommand) => void;
  onStatusChange: (state: VoiceStatusMessage["state"]) => void;
  /** Override the path to the voice app entry point (for testing). */
  voicePath?: string;
}

export interface VoiceManager {
  start(): Promise<void>;
  stop(): void;
  isRunning(): boolean;
}

export function createVoiceManager(opts: VoiceManagerOptions): VoiceManager {
  const voicePath = opts.voicePath ?? DEFAULT_VOICE_PATH;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let proc: any = null;
  let running = false;

  function start(): Promise<void> {
    return new Promise((resolve, reject) => {
      proc = spawn("node", [voicePath], {
        env: {
          ...process.env,
          VOICE_MODEL_CACHE: join(app.getPath("userData"), "voice-models"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });

      running = true;
      let resolved = false;

      const rl = createInterface({ input: proc.stdout });

      rl.on("line", (line: string) => {
        try {
          const msg = JSON.parse(line) as VoiceMessage;
          if (msg.type === "command") {
            opts.onCommand(msg.command);
          } else if (msg.type === "status") {
            opts.onStatusChange(msg.state);
            if (!resolved && msg.state === "ready") {
              resolved = true;
              resolve();
            }
          }
        } catch {
          // ignore non-JSON stderr bleed or partial lines
        }
      });

      proc.stderr?.on("data", () => {
        // swallow debug output from voice process
      });

      proc.on("exit", (code: number | null) => {
        running = false;
        rl.close();
        if (!resolved) {
          reject(
            new Error(`Voice process exited (code ${String(code)}) before ready`),
          );
        }
      });

      proc.on("error", (err: Error) => {
        running = false;
        if (!resolved) {
          reject(err);
        }
      });
    });
  }

  function stop(): void {
    if (proc) {
      proc.kill("SIGTERM");
      proc = null;
    }
    running = false;
  }

  function isRunning(): boolean {
    return running;
  }

  return { start, stop, isRunning };
}
