import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { getSession } from "../lib/auth";

export default async function HomePage() {
  if (!getSession()) {
    redirect("/login");
  }

  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      jobs: {
        orderBy: { createdAt: "desc" },
        take: 1
      },
      assets: true
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Projects</h1>
          <p className="text-sm text-slate-400">Create projects, upload media, and render deterministic edits.</p>
        </div>
        <Link
          href="/new"
          className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-400"
        >
          New Project
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => {
          const latestJob = project.jobs[0];
          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 shadow-md shadow-slate-900/40 transition hover:border-emerald-400/70"
            >
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-white">{project.name}</div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-wide text-slate-300">
                  {project.style}
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-400">{project.prompt}</div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <div>{project.assets.length} assets</div>
                <div>
                  {latestJob
                    ? `${latestJob.status} ${latestJob.progress}%`
                    : "No render jobs yet"}
                </div>
              </div>
            </Link>
          );
        })}
        {projects.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-slate-400">
            No projects yet. Start by creating one.
          </div>
        )}
      </div>
    </div>
  );
}
