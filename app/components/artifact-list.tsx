"use client";

import { useState } from "react";

type Artifact = {
  id: string;
  type: string;
  createdAt: string;
};

const ArtifactList = ({ artifacts, csrfToken }: { artifacts: Artifact[]; csrfToken: string }) => {
  const [error, setError] = useState("");

  const download = async (artifactId: string) => {
    setError("");
    const res = await fetch(`/api/artifacts/${artifactId}/signed-url`, {
      headers: {
        "x-csrf-token": csrfToken
      }
    });
    if (res.ok) {
      const data = await res.json();
      window.open(data.url, "_blank");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to fetch download URL");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/40">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Artifacts</h2>
        <div className="text-xs text-slate-400">Analysis JSON, EDL, logs, renders</div>
      </div>
      {error && <div className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      <div className="mt-4 divide-y divide-slate-800 rounded-lg border border-slate-800">
        {artifacts.length === 0 && <div className="p-3 text-sm text-slate-400">No artifacts yet.</div>}
        {artifacts.map((artifact) => (
          <div key={artifact.id} className="flex items-center justify-between p-3 text-sm text-slate-200">
            <div>
              <div className="font-semibold capitalize text-white">{artifact.type.toLowerCase()}</div>
              <div className="text-xs text-slate-400">
                {new Date(artifact.createdAt).toLocaleString(undefined, { hour12: false })}
              </div>
            </div>
            <button
              onClick={() => download(artifact.id)}
              className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:border-emerald-400 hover:text-white"
            >
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArtifactList;
