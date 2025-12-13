"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Job = {
  id: string;
  status: string;
  stage: string;
  progress: number;
  error?: string | null;
  logSnippet?: string | null;
  createdAt: string;
  updatedAt: string;
};

const readCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1] ?? "";
};

const JobPanel = ({
  projectId,
  initialJob,
  hasVideo,
  csrfToken
}: {
  projectId: string;
  initialJob: Job | null;
  hasVideo: boolean;
  csrfToken: string;
}) => {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(initialJob);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canRender = useMemo(() => hasVideo && !loading, [hasVideo, loading]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (job && (job.status === "PROCESSING" || job.status === "QUEUED")) {
      timer = setInterval(async () => {
        const res = await fetch(`/api/jobs/${job.id}`);
        if (res.ok) {
          const data = await res.json();
          setJob((prev) => (prev ? { ...prev, ...data } : data));
          if (data.status === "COMPLETED" || data.status === "FAILED") {
            router.refresh();
          }
        }
      }, 2500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [job, router]);

  const startJob = async () => {
    setLoading(true);
    setError("");
    const csrf = readCookie("videolab_csrf") || csrfToken;
    const res = await fetch(`/api/projects/${projectId}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf
      },
      body: JSON.stringify({ projectId })
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setJob(data);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create render job");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/40">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Render Job</h2>
        <button
          onClick={startJob}
          disabled={!canRender}
          className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? "Scheduling..." : "Render"}
        </button>
      </div>
      {!hasVideo && <div className="mt-2 text-sm text-red-200">Upload at least one video to render.</div>}
      {error && <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      {job ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Status</span>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase text-slate-200">
              {job.status}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Stage</span>
            <span>{job.stage}</span>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Progress</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-emerald-400 transition-all"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
          {job.logSnippet && (
            <div className="rounded-md border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Recent log</div>
              <pre className="whitespace-pre-wrap break-words text-slate-200">{job.logSnippet}</pre>
            </div>
          )}
          {job.error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {job.error}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-400">No render jobs yet.</div>
      )}
    </div>
  );
};

export default JobPanel;
