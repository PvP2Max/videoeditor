import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "../../../lib/db";
import { CSRF_COOKIE, getSession } from "../../../lib/auth";
import UploadPanel from "../../../components/upload-panel";
import JobPanel from "../../../components/job-panel";
import ArtifactList from "../../../components/artifact-list";

type Params = { params: { id: string } };

export default async function ProjectDetail({ params }: Params) {
  if (!getSession()) {
    redirect("/login");
  }
  const csrf = cookies().get(CSRF_COOKIE)?.value ?? "";

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      assets: { orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" }, take: 1 },
      artifacts: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!project) {
    notFound();
  }

  const latestJob = project.jobs[0] ?? null;

  const assets = project.assets.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString()
  }));

  const artifacts = project.artifacts.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString()
  }));

  const job = latestJob
    ? {
        ...latestJob,
        createdAt: latestJob.createdAt.toISOString(),
        updatedAt: latestJob.updatedAt.toISOString(),
        startedAt: latestJob.startedAt ? latestJob.startedAt.toISOString() : null,
        completedAt: latestJob.completedAt ? latestJob.completedAt.toISOString() : null
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm uppercase tracking-wide text-emerald-300">Project</div>
            <h1 className="text-3xl font-semibold text-white">{project.name}</h1>
            <p className="mt-2 text-sm text-slate-300">{project.prompt}</p>
          </div>
          <div className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase text-slate-300">
            {project.style}
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-slate-300">
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-3">
            <div className="text-slate-500 text-xs">Output</div>
            <div className="font-semibold">{project.outputWidth}x{project.outputHeight} @ 30fps</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-3">
            <div className="text-slate-500 text-xs">Target Duration</div>
            <div className="font-semibold">{project.targetDuration ?? 30} sec</div>
          </div>
          <div className="rounded-lg border border-slate-800/80 bg-slate-900/70 p-3">
            <div className="text-slate-500 text-xs">Assets</div>
            <div className="font-semibold">{project.assets.length}</div>
          </div>
        </div>
      </div>

      <UploadPanel projectId={project.id} assets={assets} csrfToken={csrf} />

      <JobPanel projectId={project.id} initialJob={job} hasVideo={assets.some((a) => a.kind === "VIDEO")} csrfToken={csrf} />

      <ArtifactList artifacts={artifacts} csrfToken={csrf} />
    </div>
  );
}
