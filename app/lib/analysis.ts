import { execFile } from "child_process";
import { promisify } from "util";
import { Readable } from "stream";
import { spawn } from "child_process";

const exec = promisify(execFile);

export type AssetFile = {
  id: string;
  path: string;
  kind: "VIDEO" | "AUDIO";
};

export type AnalysisResult = {
  videos: { assetId: string; duration: number }[];
  audio?: {
    assetId: string;
    duration: number;
    tempo: number;
    beatTimes: number[];
    energyCurve: number[];
    bestSegment: { start: number; end: number };
  };
};

export const probeDuration = async (filePath: string): Promise<number> => {
  const { stdout } = await exec("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nk=1:nw=1",
    filePath
  ]);
  const duration = parseFloat(stdout.trim());
  return Number.isFinite(duration) ? duration : 0;
};

const analyzeAudioStream = async (filePath: string) => {
  const sampleRate = 16000;
  const frameSamples = 1024;
  const energies: number[] = [];

  await new Promise<void>((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-i",
      filePath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      `${sampleRate}`,
      "-f",
      "s16le",
      "pipe:1"
    ]);
    ff.stderr.on("data", () => null);
    ff.on("error", reject);
    let sum = 0;
    let count = 0;
    ff.stdout.on("data", (chunk: Buffer) => {
      for (let i = 0; i < chunk.length; i += 2) {
        const sample = chunk.readInt16LE(i) / 32768;
        sum += sample * sample;
        count += 1;
        if (count === frameSamples) {
          energies.push(sum / frameSamples);
          sum = 0;
          count = 0;
        }
      }
    });
    ff.on("close", () => resolve());
  });

  if (energies.length === 0) {
    energies.push(0);
  }

  const mean =
    energies.reduce((acc, val) => acc + val, 0) / (energies.length === 0 ? 1 : energies.length);
  const variance =
    energies.reduce((acc, val) => acc + (val - mean) * (val - mean), 0) /
    (energies.length === 0 ? 1 : energies.length);
  const std = Math.sqrt(variance);
  const threshold = mean + std * 0.6;
  const frameDuration = frameSamples / sampleRate;
  const beatTimes: number[] = [];
  energies.forEach((energy, idx) => {
    if (energy >= threshold) {
      beatTimes.push(Number((idx * frameDuration).toFixed(3)));
    }
  });

  const intervals: number[] = [];
  for (let i = 1; i < beatTimes.length; i++) {
    intervals.push(beatTimes[i] - beatTimes[i - 1]);
  }
  const avgInterval =
    intervals.length > 0 ? intervals.reduce((acc, v) => acc + v, 0) / intervals.length : 0.5;
  const tempo = Math.max(60, Math.min(180, 60 / (avgInterval || 0.5)));

  const normalizedEnergy = energies.map((v) => (v === 0 ? 0 : Number((v / (std + mean + 1e-6)).toFixed(4))));

  // Pick best segment with highest summed energy over ~10s window
  const windowSeconds = 10;
  const windowFrames = Math.max(1, Math.floor(windowSeconds / frameDuration));
  let bestIndex = 0;
  let bestScore = -Infinity;
  let rolling = 0;
  for (let i = 0; i < normalizedEnergy.length; i++) {
    rolling += normalizedEnergy[i];
    if (i >= windowFrames) {
      rolling -= normalizedEnergy[i - windowFrames];
    }
    if (i >= windowFrames - 1 && rolling > bestScore) {
      bestScore = rolling;
      bestIndex = i - windowFrames + 1;
    }
  }
  const start = Math.max(0, bestIndex * frameDuration);
  const end = start + Math.min(windowSeconds, normalizedEnergy.length * frameDuration - start);

  return { beatTimes, tempo, energyCurve: normalizedEnergy, bestSegment: { start, end } };
};

export const analyzeAssets = async (assetFiles: AssetFile[]): Promise<AnalysisResult> => {
  const videos = assetFiles.filter((a) => a.kind === "VIDEO");
  const audio = assetFiles.find((a) => a.kind === "AUDIO");

  const videoDurations = [];
  for (const video of videos) {
    const duration = await probeDuration(video.path);
    videoDurations.push({ assetId: video.id, duration });
  }

  let audioAnalysis:
    | {
        assetId: string;
        duration: number;
        tempo: number;
        beatTimes: number[];
        energyCurve: number[];
        bestSegment: { start: number; end: number };
      }
    | undefined;

  if (audio) {
    const duration = await probeDuration(audio.path);
    const { beatTimes, tempo, energyCurve, bestSegment } = await analyzeAudioStream(audio.path);
    audioAnalysis = {
      assetId: audio.id,
      duration,
      tempo,
      beatTimes,
      energyCurve,
      bestSegment
    };
  }

  return {
    videos: videoDurations,
    audio: audioAnalysis
  };
};
