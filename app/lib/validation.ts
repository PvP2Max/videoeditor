import { z } from "zod";

export const stylePresets = ["hype", "cinematic", "clean"] as const;

export const projectInputSchema = z.object({
  name: z.string().min(3).max(120),
  prompt: z.string().min(3).max(2000),
  style: z.enum(stylePresets),
  outputWidth: z.coerce.number().int().positive().max(7680),
  outputHeight: z.coerce.number().int().positive().max(4320),
  targetDuration: z.coerce.number().int().positive().max(900).optional().nullable()
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

export const renderJobSchema = z.object({
  projectId: z.string()
});

export const fileLimits = {
  maxUploadBytes: 800 * 1024 * 1024
};

export const sanitizeFilename = (name: string) => {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.slice(0, 200) || "file";
};
