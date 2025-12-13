"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Asset = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  kind: string;
  createdAt: string;
};

const readCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1] ?? "";
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const UploadPanel = ({
  projectId,
  assets,
  csrfToken
}: {
  projectId: string;
  assets: Asset[];
  csrfToken: string;
}) => {
  const router = useRouter();
  const [videos, setVideos] = useState<FileList | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!videos && !audio) {
      setError("Select at least one file to upload.");
      return;
    }
    const form = new FormData();
    if (videos) {
      Array.from(videos).forEach((file) => form.append("files", file));
    }
    if (audio) {
      form.append("files", audio);
    }
    setUploading(true);
    const csrf = readCookie("videolab_csrf") || csrfToken;
    const res = await fetch(`/api/projects/${projectId}/assets`, {
      method: "POST",
      headers: {
        "x-csrf-token": csrf
      },
      body: form
    });
    setUploading(false);
    if (res.ok) {
      setVideos(null);
      setAudio(null);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-slate-900/40">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Assets</h2>
        <div className="text-xs text-slate-400">Videos + one optional audio track</div>
      </div>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Videos</label>
          <input
            type="file"
            accept="video/*"
            multiple
            onChange={(e) => setVideos(e.target.files)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Optional audio</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setAudio(e.target.files ? e.target.files[0] : null)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none"
          />
        </div>
        {error && <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
        <button
          type="submit"
          disabled={uploading}
          className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-70"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </form>
      <div className="mt-6 space-y-2">
        <div className="text-sm font-semibold text-slate-200">Existing assets</div>
        <div className="divide-y divide-slate-800 rounded-lg border border-slate-800">
          {assets.length === 0 && <div className="p-3 text-sm text-slate-400">No assets yet.</div>}
          {assets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between p-3 text-sm text-slate-200">
              <div className="flex flex-col">
                <span className="font-medium text-white">{asset.filename}</span>
                <span className="text-xs text-slate-400">
                  {asset.kind.toLowerCase()} • {asset.contentType} • {formatBytes(asset.size)}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(asset.createdAt).toLocaleString(undefined, { hour12: false })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UploadPanel;
