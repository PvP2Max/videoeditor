import { Asset } from "@prisma/client";
import { AnalysisResult } from "./analysis";
import { EDL, edlSchema } from "./edlSchema";

type PlanParams = {
  project: {
    id: string;
    prompt: string;
    style: string;
    outputWidth: number;
    outputHeight: number;
    targetDuration: number | null;
  };
  assets: Asset[];
  analysis: AnalysisResult;
};

const presetConfig: Record<
  string,
  { clipDuration: number; transition: "none" | "crossfade"; mixLevel: number; captions: boolean }
> = {
  hype: { clipDuration: 3.5, transition: "crossfade", mixLevel: 0.95, captions: false },
  cinematic: { clipDuration: 4.8, transition: "crossfade", mixLevel: 0.85, captions: false },
  clean: { clipDuration: 4.0, transition: "none", mixLevel: 0.9, captions: false }
};

const pickStyle = (prompt: string, desired: string) => {
  const normalized = desired.toLowerCase();
  if (presetConfig[normalized]) return normalized;
  const lower = prompt.toLowerCase();
  if (lower.includes("hype") || lower.includes("energy")) return "hype";
  if (lower.includes("cinematic") || lower.includes("film") || lower.includes("dramatic")) return "cinematic";
  return "clean";
};

export const buildEdl = ({ project, assets, analysis }: PlanParams): EDL => {
  const style = pickStyle(project.prompt, project.style);
  const preset = presetConfig[style];
  const targetDuration = project.targetDuration ?? 30;
  const transitionDuration = preset.transition === "crossfade" ? 0.75 : 0;

  const timeline: EDL["timeline"] = [];
  let cursor = 0;
  const videoDurations: Record<string, number> = {};
  for (const v of analysis.videos) {
    videoDurations[v.assetId] = v.duration;
  }

  const videoAssets = assets.filter((a) => a.kind === "VIDEO");
  for (const [index, asset] of videoAssets.entries()) {
    const duration = videoDurations[asset.id] ?? preset.clipDuration;
    const segmentLength = Math.min(preset.clipDuration, Math.max(1.5, duration));
    const available = Math.max(0, duration - segmentLength);
    const inPoint = available > 0 ? Math.min(available, (duration * 0.1 + index) % available) : 0;
    const outPoint = Math.min(duration, inPoint + segmentLength);
    const usedDuration = Math.max(0.3, outPoint - inPoint);

    timeline.push({
      sourceAssetId: asset.id,
      in: Number(inPoint.toFixed(3)),
      out: Number(outPoint.toFixed(3)),
      start: Number(cursor.toFixed(3)),
      transition: index === 0 ? "none" : preset.transition
    });

    cursor += usedDuration;
    if (preset.transition === "crossfade" && index !== 0) {
      cursor -= transitionDuration;
    }
    if (preset.transition === "crossfade" && index !== 0) {
      cursor -= transitionDuration;
    }
    if (cursor >= targetDuration) break;
  }

  if (timeline.length === 0) {
    throw new Error("No timeline clips planned");
  }

  const audioSettings = analysis.audio
    ? {
        useUploadedAudio: true,
        selectedSegment: {
          start: analysis.audio.bestSegment.start,
          end: Math.min(
            analysis.audio.duration,
            analysis.audio.bestSegment.start + Math.min(targetDuration, analysis.audio.bestSegment.end - analysis.audio.bestSegment.start)
          )
        },
        normalize: true,
        mixLevel: preset.mixLevel
      }
    : {
        useUploadedAudio: false,
        selectedSegment: null,
        normalize: false,
        mixLevel: 0.8
      };

  const edl: EDL = {
    version: "1.0",
    output: {
      width: project.outputWidth,
      height: project.outputHeight,
      fps: 30,
      targetDuration
    },
    timeline,
    captions: {
      enabled: preset.captions,
      font: "Inter",
      size: 22,
      position: "bottom",
      texts: preset.captions
        ? timeline.map((clip, idx) => ({
            start: clip.start,
            end: Math.min(targetDuration, clip.start + 2),
            text: `Beat ${idx + 1}`
          }))
        : []
    },
    audio: audioSettings
  };

  const parsed = edlSchema.safeParse(edl);
  if (!parsed.success) {
    throw new Error(`EDL validation failed: ${parsed.error.message}`);
  }
  return parsed.data;
};
