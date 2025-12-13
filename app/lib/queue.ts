import { Asset, Job, Project } from "@prisma/client";
import { prisma } from "./db";

type ClaimedJob = {
  job: Job;
  project: Project;
  assets: Asset[];
};

export const claimNextJob = async (): Promise<ClaimedJob | null> => {
  const jobId = await prisma.$transaction(async (tx) => {
    const queued = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM Job WHERE status = 'QUEUED' ORDER BY createdAt ASC LIMIT 1
    `;
    if (!queued.length) return null;
    const targetId = queued[0].id;
    const updated = await tx.job.updateMany({
      where: { id: targetId, status: "QUEUED" },
      data: { status: "PROCESSING", stage: "analyze", progress: 0, startedAt: new Date() }
    });
    if (updated.count === 0) return null;
    return targetId;
  });

  if (!jobId) return null;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { project: true }
  });
  if (!job) return null;
  const assets = await prisma.asset.findMany({ where: { projectId: job.projectId } });
  return { job, project: job.project, assets };
};

export const updateJobStage = async (jobId: string, stage: string, progress: number, logSnippet?: string) => {
  return prisma.job.update({
    where: { id: jobId },
    data: { stage, progress, logSnippet }
  });
};

export const markJobFailed = async (jobId: string, error: string, logSnippet?: string) => {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      stage: "failed",
      progress: 100,
      error,
      logSnippet,
      completedAt: new Date()
    }
  });
};

export const markJobCompleted = async (jobId: string, logSnippet?: string) => {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      stage: "completed",
      progress: 100,
      logSnippet,
      completedAt: new Date()
    }
  });
};
