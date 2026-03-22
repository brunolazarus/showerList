import type { VoiceCommand } from "../ipc.js";

/** Single source of truth for voice command vocabulary. */
export const COMMAND_ALIASES: Record<VoiceCommand, string[]> = {
  skip: ["skip", "next", "forward"],
  previous: ["back", "previous", "prev", "rewind"],
  pause: ["pause", "stop", "wait"],
  play: ["play", "resume", "go", "continue"],
};
