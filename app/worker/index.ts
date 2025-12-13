import fs from "fs";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { prisma } from "../lib/db";
import { claimNextJob, markJobCompleted, markJobFailed, updateJobStage } from "../lib/queue";
import { analyzeAssets } from "../lib/analysis";
import { buildEdl } from "../lib/planner";
import { renderEdl } from "../lib/render";
import { downloadToFile, uploadBuffer, uploadStream } from "../lib/r2";
import { EDL } from "../lib/edlSchema";
import { sanitizeFilename } from "../lib/validation";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const createTempDir = async (jobId: string) => {
  const dir = path.join(os.tmpdir(), `job-${jobId}`);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
};

const writeLogFile = async (dir: string, content: string) => {
  const logPath = path.join(dir, "job.log");
  await fsp.writeFile(logPath, content, "utf-8");
  return logPath;
};

const persistArtifact = async (
  projectId: string,
  jobId: string,
  type: "ANALYSIS" | "EDL" | "LOG" | "RENDER",
  key: string,
  contentType: string,
  size?: number
) => {
  await prisma.artifact.create({
    data: {
      projectId,
      jobId,
      type,
      r2Key: key,
      contentType,
      size
    }
  });
};

const processJob = async () => {
  const claimed = await claimNextJob();
  if (!claimed) return false;
  const { job, project, assets } = claimed;
  let tempDir: string | null = null;

  const logLines: string[] = [];
  const appendLog = (line: string) => {
    const entry = `[${new Date().toISOString()}] ${line}`;
    logLines.push(entry);
    if (logLines.length > 80) {
      logLines.shift();
    }
  };
  const logSnippet = () => logLines.slice(-10).join("\n");

  try {
    appendLog(`Claimed job ${job.id} for project ${project.id}`);
    tempDir = await createTempDir(job.id);

    // Download assets locally
    const assetPaths: Record<string, string> = {};
    for (const asset of assets) {
      const localPath = path.join(tempDir, `${asset.id}-${sanitizeFilename(asset.filename)}`);
      appendLog(`Downloading ${asset.filename} -> ${localPath}`);
      await downloadToFile(asset.r2Key, localPath);
      assetPaths[asset.id] = localPath;
    }

    await updateJobStage(job.id, "analyze", 15, logSnippet());
    const analysis = await analyzeAssets(
      assets.map((a) => ({
        id: a.id,
        path: assetPaths[a.id],
        kind: a.kind === "AUDIO" ? "AUDIO" : "VIDEO"
      }))
    );
    appendLog("Analysis complete");

    const analysisKey = `projects/${project.id}/analysis/${job.id}.json`;
    const analysisBuffer = Buffer.from(JSON.stringify(analysis, null, 2));
    await uploadBuffer(analysisKey, analysisBuffer, "application/json");
    await persistArtifact(project.id, job.id, "ANALYSIS", analysisKey, "application/json", analysisBuffer.length);

    await updateJobStage(job.id, "plan", 40, logSnippet());
    let edl: EDL;
    try {
      edl = buildEdl({
        project: {
          id: project.id,
          prompt: project.prompt,
          style: project.style,
          outputHeight: project.outputHeight,
          outputWidth: project.outputWidth,
          targetDuration: project.targetDuration
        },
        assets,
        analysis
      });
    } catch (err: any) {
      appendLog(`Planning failed: ${err?.message ?? err}`);
      await markJobFailed(job.id, err?.message ?? "Planning failed", logSnippet());
      const logPath = await writeLogFile(tempDir, logLines.join("\n"));
      const logKey = `projects/${project.id}/logs/${job.id}.log`;
      await uploadStream(logKey, "text/plain", fs.createReadStream(logPath));
      await persistArtifact(project.id, job.id, "LOG", logKey, "text/plain");
      await fsp.rm(tempDir, { recursive: true, force: true });
      return true;
    }
    appendLog("EDL planned");
    const edlKey = `projects/${project.id}/edl/${job.id}.json`;
    const edlBuffer = Buffer.from(JSON.stringify(edl, null, 2));
    await uploadBuffer(edlKey, edlBuffer, "application/json");
    await persistArtifact(project.id, job.id, "EDL", edlKey, "application/json", edlBuffer.length);

    await updateJobStage(job.id, "render", 65, logSnippet());
    const audioAssetId = analysis.audio?.assetId ?? null;
    const audioPath = audioAssetId ? assetPaths[audioAssetId] : null;
    const outputPath = await renderEdl(edl, assetPaths, audioPath, tempDir, appendLog);
    appendLog("Render complete");

    const renderKey = `projects/${project.id}/renders/${job.id}.mp4`;
    const stat = await fsp.stat(outputPath);
    await uploadStream(renderKey, "video/mp4", fs.createReadStream(outputPath));
    await persistArtifact(project.id, job.id, "RENDER", renderKey, "video/mp4", stat.size);

    await updateJobStage(job.id, "finalize", 90, logSnippet());
    appendLog("Uploading logs");
    const logPath = await writeLogFile(tempDir, logLines.join("\n"));
    const logKey = `projects/${project.id}/logs/${job.id}.log`;
    await uploadStream(logKey, "text/plain", fs.createReadStream(logPath));
    await persistArtifact(project.id, job.id, "LOG", logKey, "text/plain");

    await markJobCompleted(job.id, logSnippet());
    await fsp.rm(tempDir, { recursive: true, force: true });
  } catch (err: any) {
    const message = err?.message ?? "Worker error";
    appendLog(`Error: ${message}`);
    await markJobFailed(job.id, message, logSnippet());
    try {
      if (!tempDir) {
        tempDir = await createTempDir(`log-${job.id}`);
      }
      const logPath = await writeLogFile(tempDir, logLines.join("\n"));
      const logKey = `projects/${project.id}/logs/${job.id}.log`;
      await uploadStream(logKey, "text/plain", fs.createReadStream(logPath));
      await persistArtifact(project.id, job.id, "LOG", logKey, "text/plain");
      await fsp.rm(tempDir, { recursive: true, force: true });
    } catch (logErr) {
      console.error("Failed to upload error log", logErr);
    }
  }

  return true;
};

const runWorker = async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const processed = await processJob();
    if (!processed) {
      await sleep(2000);
    }
  }
};

runWorker().catch((err) => {
  console.error("Worker crashed", err);
  process.exit(1);
});
