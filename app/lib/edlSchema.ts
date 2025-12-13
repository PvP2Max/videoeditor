import { z } from "zod";

export const transitionEnum = z.enum(["none", "crossfade"]);

export const captionSchema = z.object({
  enabled: z.boolean(),
  font: z.string(),
  size: z.number().positive(),
  position: z.string(),
  texts: z
    .array(
      z.object({
        start: z.number().nonnegative(),
        end: z.number().positive(),
        text: z.string()
      })
    )
    .optional()
});

export const edlSchema = z.object({
  version: z.literal("1.0"),
  output: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().positive(),
    targetDuration: z.number().positive()
  }),
  timeline: z.array(
    z.object({
      sourceAssetId: z.string(),
      in: z.number().nonnegative(),
      out: z.number().positive(),
      start: z.number().nonnegative(),
      speed: z.number().positive().optional(),
      transition: transitionEnum
    })
  ),
  captions: captionSchema,
  audio: z.object({
    useUploadedAudio: z.boolean(),
    selectedSegment: z
      .object({
        start: z.number().nonnegative(),
        end: z.number().positive()
      })
      .nullable(),
    normalize: z.boolean(),
    mixLevel: z.number().min(0).max(1)
  })
});

export type EDL = z.infer<typeof edlSchema>;
