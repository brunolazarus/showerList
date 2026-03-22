/**
 * Manual test harness for the noise-reduction pipeline.
 *
 * Usage:
 *   node dist/scripts/testPipeline.js <input.wav> <output.wav>
 *
 * Reads a WAV file, feeds 480-stereo-sample frames through the full pipeline
 * (mono → rnnoise → resample → VAD), and writes the denoised 16kHz mono
 * output as a WAV file. VAD speech segments are logged to stderr.
 *
 * The WAV reader is intentionally minimal — handles only standard PCM WAV
 * (16-bit, any channel count, any sample rate). Sox-produced files work fine.
 */

import * as fs from "fs";
import * as path from "path";
import { downmixToMono } from "../pipeline/mono";
import { denoise, initNoiseReduction } from "../pipeline/noiseReduction";
import { resample48to16 } from "../pipeline/resample";
import { createVad } from "../pipeline/vad";
import { feedCalibrationFrame, isCalibrating } from "../pipeline/calibrate";

// ---------------------------------------------------------------------------
// Minimal WAV parser
// ---------------------------------------------------------------------------

interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  pcmData: Buffer;
}

function readWav(filePath: string): WavInfo {
  const buf = fs.readFileSync(filePath);
  if (
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("Not a RIFF/WAVE file");
  }
  let offset = 12;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let pcmData: Buffer | null = null;

  while (offset < buf.length - 8) {
    const chunkId = buf.toString("ascii", offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    offset += 8;
    if (chunkId === "fmt ") {
      channels = buf.readUInt16LE(offset + 2);
      sampleRate = buf.readUInt32LE(offset + 4);
      bitsPerSample = buf.readUInt16LE(offset + 14);
    } else if (chunkId === "data") {
      pcmData = buf.subarray(offset, offset + chunkSize);
      break;
    }
    offset += chunkSize;
  }
  if (!pcmData) throw new Error("No data chunk found");
  return { sampleRate, channels, bitsPerSample, pcmData };
}

// ---------------------------------------------------------------------------
// Minimal WAV writer (16-bit PCM)
// ---------------------------------------------------------------------------

function writeWav(filePath: string, pcm: Int16Array, sampleRate: number): void {
  const dataBytes = pcm.length * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataBytes, 40);

  const dataBuffer = Buffer.from(pcm.buffer, pcm.byteOffset, dataBytes);
  fs.writeFileSync(filePath, Buffer.concat([header, dataBuffer]));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    process.stderr.write(
      "Usage: node dist/scripts/testPipeline.js <input.wav> <output.wav>\n",
    );
    process.exit(1);
  }

  process.stderr.write(`Reading: ${path.resolve(inputPath)}\n`);
  const wav = readWav(inputPath);
  process.stderr.write(
    `WAV: ${wav.sampleRate}Hz, ${wav.channels}ch, ${wav.bitsPerSample}bit, ` +
      `${wav.pcmData.length} bytes\n`,
  );

  if (wav.bitsPerSample !== 16) {
    throw new Error("Only 16-bit PCM WAV supported");
  }

  await initNoiseReduction();

  const outputFrames: Int16Array[] = [];
  let speechSegments = 0;

  const vad = await createVad({
    onSpeechStart: () => process.stderr.write("[VAD] speech start\n"),
    onSpeechEnd: (audio) => {
      speechSegments++;
      process.stderr.write(
        `[VAD] speech end — segment ${speechSegments}, ${audio.length} samples\n`,
      );
    },
  });

  // Feed the WAV in 480-sample stereo frames (960 Int16 values = 1920 bytes).
  // If the input isn't 48kHz stereo, we warn but continue.
  const STEREO_FRAME_INT16 = 960;
  const totalSamples = wav.pcmData.length / 2;

  // Normalise to stereo Int16 regardless of source channel count
  const samples = new Int16Array(
    wav.pcmData.buffer,
    wav.pcmData.byteOffset,
    totalSamples,
  );

  // If mono, duplicate channel; if >2 channels, drop extras
  let stereoSamples: Int16Array;
  if (wav.channels === 1) {
    stereoSamples = new Int16Array(samples.length * 2);
    for (let i = 0; i < samples.length; i++) {
      stereoSamples[2 * i] = samples[i];
      stereoSamples[2 * i + 1] = samples[i];
    }
  } else if (wav.channels === 2) {
    stereoSamples = samples;
  } else {
    // keep only first two channels
    stereoSamples = new Int16Array(
      Math.floor(samples.length / wav.channels) * 2,
    );
    for (
      let frame = 0;
      frame < Math.floor(samples.length / wav.channels);
      frame++
    ) {
      stereoSamples[2 * frame] = samples[frame * wav.channels];
      stereoSamples[2 * frame + 1] = samples[frame * wav.channels + 1];
    }
  }

  process.stderr.write(
    `Processing ${Math.floor(stereoSamples.length / STEREO_FRAME_INT16)} frames…\n`,
  );

  for (
    let i = 0;
    i + STEREO_FRAME_INT16 <= stereoSamples.length;
    i += STEREO_FRAME_INT16
  ) {
    const stereoFrame = stereoSamples.subarray(i, i + STEREO_FRAME_INT16);
    const mono = downmixToMono(stereoFrame);
    const denoised = denoise(mono);

    if (isCalibrating()) {
      feedCalibrationFrame(denoised);
    }

    const resampled = resample48to16(denoised);
    outputFrames.push(resampled);

    const f32 = new Float32Array(resampled.length);
    for (let j = 0; j < resampled.length; j++) {
      f32[j] = resampled[j] / 32768;
    }
    await vad.pushFrame(f32);
  }

  vad.destroy();

  // Concatenate all 16kHz output frames
  const totalOutputSamples = outputFrames.reduce((s, f) => s + f.length, 0);
  const outputPcm = new Int16Array(totalOutputSamples);
  let pos = 0;
  for (const f of outputFrames) {
    outputPcm.set(f, pos);
    pos += f.length;
  }

  writeWav(outputPath, outputPcm, 16000);
  process.stderr.write(
    `Written: ${path.resolve(outputPath)} (${totalOutputSamples} samples @ 16kHz)\n`,
  );
  process.stderr.write(`VAD detected ${speechSegments} speech segment(s)\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${String(err)}\n`);
  process.exit(1);
});
