"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const stylePresets = [
  { value: "hype", label: "Hype" },
  { value: "cinematic", label: "Cinematic" },
  { value: "clean", label: "Clean" }
];

const outputPresets = [
  { label: "Vertical 1080x1920", width: 1080, height: 1920 },
  { label: "Square 1080x1080", width: 1080, height: 1080 },
  { label: "Horizontal 1920x1080", width: 1920, height: 1080 }
];

const readCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1] ?? "";
};

const ProjectForm = ({ csrfCookie }: { csrfCookie: string }) => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("hype");
  const [targetDuration, setTargetDuration] = useState(30);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1920);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onPresetChange = (presetLabel: string) => {
    const preset = outputPresets.find((p) => p.label === presetLabel);
    if (preset) {
      setWidth(preset.width);
      setHeight(preset.height);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const csrf = readCookie("videolab_csrf") || csrfCookie;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrf
      },
      body: JSON.stringify({
        name,
        prompt,
        style,
        outputWidth: width,
        outputHeight: height,
        targetDuration
      })
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/projects/${data.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Unable to create project");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm text-slate-300">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
          placeholder="Family recap or product hype"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-slate-300">Prompt</label>
        <textarea
          required
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
          placeholder="Short beat-synced montage with captions. Focus on energy."
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Style preset</label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
          >
            {stylePresets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">Output preset</label>
          <select
            onChange={(e) => onPresetChange(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
          >
            {outputPresets.map((preset) => (
              <option key={preset.label}>{preset.label}</option>
            ))}
          </select>
          <div className="flex gap-3">
            <input
              type="number"
              min={320}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
            />
            <input
              type="number"
              min={320}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
            />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm text-slate-300">Target duration (seconds)</label>
        <input
          type="number"
          min={5}
          max={900}
          value={targetDuration}
          onChange={(e) => setTargetDuration(Number(e.target.value))}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
        />
      </div>
      {error && <div className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {loading ? "Creating..." : "Create Project"}
      </button>
    </form>
  );
};

export default ProjectForm;
