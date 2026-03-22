import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "events";
import { PassThrough } from "stream";

// ---------------------------------------------------------------------------
// Mock child_process
// ---------------------------------------------------------------------------

class MockProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  kill = vi.fn();
}

const mockState = vi.hoisted(() => ({
  proc: null as MockProcess | null,
  userDataPath: "/tmp/showerlist-vm-test",
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(() => {
    mockState.proc = new MockProcess();
    return mockState.proc;
  }),
}));

vi.mock("electron", () => ({
  app: {
    getPath: () => mockState.userDataPath,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitLine(line: string): void {
  mockState.proc!.stdout.write(line + "\n");
}

function emitExit(code: number | null = 0): void {
  mockState.proc!.emit("exit", code);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { createVoiceManager } from "./voiceManager";

describe("voiceManager", () => {
  let onCommand: ReturnType<typeof vi.fn>;
  let onStatusChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockState.proc = null;
    onCommand = vi.fn();
    onStatusChange = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("resolves start() when the voice process emits ready", async () => {
    const vm = createVoiceManager({
      voicePath: "/fake/index.js",
      onCommand,
      onStatusChange,
    });

    const started = vm.start();
    emitLine(JSON.stringify({ type: "status", state: "ready" }));
    await expect(started).resolves.toBeUndefined();
  });

  it("fires onStatusChange for each status message", async () => {
    const vm = createVoiceManager({
      voicePath: "/fake/index.js",
      onCommand,
      onStatusChange,
    });

    const started = vm.start();
    emitLine(JSON.stringify({ type: "status", state: "idle" }));
    emitLine(JSON.stringify({ type: "status", state: "ready" }));
    await started;

    expect(onStatusChange).toHaveBeenCalledWith("idle");
    expect(onStatusChange).toHaveBeenCalledWith("ready");
  });

  it("fires onCommand when the process emits a command message", async () => {
    const vm = createVoiceManager({
      voicePath: "/fake/index.js",
      onCommand,
      onStatusChange,
    });

    const started = vm.start();
    emitLine(JSON.stringify({ type: "status", state: "ready" }));
    await started;

    emitLine(JSON.stringify({ type: "command", command: "skip" }));
    emitLine(JSON.stringify({ type: "command", command: "pause" }));

    expect(onCommand).toHaveBeenCalledWith("skip");
    expect(onCommand).toHaveBeenCalledWith("pause");
  });

  it("rejects start() when the process exits before emitting ready", async () => {
    const vm = createVoiceManager({
      voicePath: "/fake/index.js",
      onCommand,
      onStatusChange,
    });

    const started = vm.start();
    emitExit(1);
    await expect(started).rejects.toThrow("before ready");
  });

  it("isRunning() returns true after start and false after stop", async () => {
    const vm = createVoiceManager({
      voicePath: "/fake/index.js",
      onCommand,
      onStatusChange,
    });

    const started = vm.start();
    expect(vm.isRunning()).toBe(true);
    emitLine(JSON.stringify({ type: "status", state: "ready" }));
    await started;

    vm.stop();
    expect(vm.isRunning()).toBe(false);
  });

  it("stop() kills the child process", async () => {
    const vm = createVoiceManager({
      voicePath: "/fake/index.js",
      onCommand,
      onStatusChange,
    });

    const started = vm.start();
    emitLine(JSON.stringify({ type: "status", state: "ready" }));
    await started;

    vm.stop();
    expect(mockState.proc!.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("ignores non-JSON lines without throwing", async () => {
    const vm = createVoiceManager({
      voicePath: "/fake/index.js",
      onCommand,
      onStatusChange,
    });

    const started = vm.start();
    emitLine("not json at all");
    emitLine(JSON.stringify({ type: "status", state: "ready" }));
    await expect(started).resolves.toBeUndefined();
  });
});
