import type { VoiceCommand } from "../ipc.js";
import { COMMAND_ALIASES } from "./aliases.js";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function matchCommand(transcript: string): VoiceCommand | null {
  const normalized = normalize(transcript);
  const words = normalized.split(/\s+/).filter(Boolean);

  const entries = Object.entries(COMMAND_ALIASES) as [VoiceCommand, string[]][];

  // 1. Exact word match
  for (const [command, aliases] of entries) {
    if (aliases.some((a) => words.includes(a))) return command;
  }

  // 2. Substring match
  for (const [command, aliases] of entries) {
    if (aliases.some((a) => normalized.includes(a))) return command;
  }

  // 3. Levenshtein distance ≤ 1
  for (const [command, aliases] of entries) {
    if (aliases.some((a) => words.some((w) => levenshtein(w, a) <= 1)))
      return command;
  }

  return null;
}
