export type VoiceCommand = "skip" | "previous" | "pause" | "play";

export type VoiceCommandMessage = {
  type: "command";
  command: VoiceCommand;
};

export type VoiceStatusMessage = {
  type: "status";
  state: "idle" | "ready" | "listening" | "processing" | "error";
  detail?: string;
};

export type VoiceMessage = VoiceCommandMessage | VoiceStatusMessage;

export function emit(msg: VoiceMessage): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
