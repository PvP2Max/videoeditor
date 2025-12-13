import { execFile } from "child_process";
import { promisify } from "util";
import { EDL } from "./edlSchema";

const exec = promisify(execFile);

const run = async (cmd: string, args: string[], log?: (msg: string) => void) => {
  log?.(`${cmd} ${args.join(" ")}`);
  const { stdout, stderr } = await exec(cmd, args);
  if (stdout) log?.(stdout.toString());
  if (stderr) log?.(stderr.toString());
};

type AssetPathMap = Record<string, string>;

export const renderEdl = async (
  edl: EDL,
  assetPaths: AssetPathMap,
  audioPath: string | null,
  tempDir: string,
  log?: (msg: string) => void
) => {
  if (edl.timeline.length === 0) {
    throw new Error("EDL timeline is empty");
  }
  const segmentPaths: string[] = [];
  const clipDurations: number[] = [];

  for (let i = 0; i < edl.timeline.length; i++) {
    const clip = edl.timeline[i];
    const sourcePath = assetPaths[clip.sourceAssetId];
    if (!sourcePath) {
      throw new Error(`Missing asset file for ${clip.sourceAssetId}`);
    }
    const output = `${tempDir}/segment-${i}.mp4`;
    const vf = `scale=${edl.output.width}:${edl.output.height}:force_original_aspect_ratio=cover,crop=${edl.output.width}:${edl.output.height},setsar=1,fps=${edl.output.fps}`;
    await run("ffmpeg", [
      "-y",
      "-ss",
      clip.in.toString(),
      "-to",
      clip.out.toString(),
      "-i",
      sourcePath,
      "-an",
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      output
    ], log);
    segmentPaths.push(output);
    clipDurations.push(clip.out - clip.in);
  }

  const inputs: string[] = [];
  segmentPaths.forEach((seg) => inputs.push("-i", seg));
  if (audioPath) {
    inputs.push("-i", audioPath);
  } else {
    inputs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
  }

  const videoFilters: string[] = [];
  for (let i = 0; i < segmentPaths.length; i++) {
    videoFilters.push(`[${i}:v]setpts=PTS-STARTPTS[v${i}]`);
  }

  let currentLabel = "[v0]";
  let accumulated = clipDurations[0] ?? 0;
  let labelIndex = 0;
  for (let i = 1; i < segmentPaths.length; i++) {
    const clip = edl.timeline[i];
    const duration = clipDurations[i];
    const transitionDuration = clip.transition === "crossfade" ? 0.75 : 0.001;
    const offset = Math.max(0, accumulated - transitionDuration);
    const nextLabel = `[vxf${labelIndex}]`;
    videoFilters.push(
      `${currentLabel}[v${i}]xfade=transition=fade:duration=${transitionDuration.toFixed(
        3
      )}:offset=${offset.toFixed(3)}${nextLabel}`
    );
    currentLabel = nextLabel;
    accumulated = accumulated + duration - transitionDuration;
    labelIndex += 1;
  }

  const videoOut = segmentPaths.length > 1 ? `[vxf${labelIndex - 1}]` : "[v0]";

  const audioInputIndex = segmentPaths.length;
  const audioFilters: string[] = [];
  const useAudio = edl.audio.useUploadedAudio && audioPath;
  if (useAudio) {
    const seg = edl.audio.selectedSegment;
    const start = seg ? seg.start : 0;
    const end = seg ? seg.end : edl.output.targetDuration;
    const normalizeFilter = edl.audio.normalize ? "loudnorm=I=-14:TP=-1.5:LRA=11," : "";
    audioFilters.push(
      `[${audioInputIndex}:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,${normalizeFilter}volume=${edl.audio.mixLevel}[aout]`
    );
  } else {
    audioFilters.push(`[${audioInputIndex}:a]atrim=0:${edl.output.targetDuration},asetpts=PTS-STARTPTS,volume=0[aout]`);
  }

  const filterComplex = [...videoFilters, ...audioFilters].join(";");
  const outputPath = `${tempDir}/render.mp4`;

  await run(
    "ffmpeg",
    [
      "-y",
      ...inputs,
      "-filter_complex",
      filterComplex,
      "-map",
      videoOut,
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-shortest",
      "-movflags",
      "+faststart",
      "-t",
      edl.output.targetDuration.toString(),
      outputPath
    ],
    log
  );

  return outputPath;
};
