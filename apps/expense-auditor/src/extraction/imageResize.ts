import { MAX_IMAGE_BYTES } from "../../shared/wire";
import type { UploadProblem } from "../state/reducer";

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.85;
/** Sanity cap before decoding (design: 20 MiB). */
export const MAX_RAW_FILE_BYTES = 20 * 1024 * 1024;

export interface PreparedImage {
  bytes: Uint8Array;
  mediaType: "image/jpeg" | "image/png";
  previewUrl: string;
}

/** Scale down to fit `maxEdge` on the long edge. Never enlarges. */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface ImageEnv {
  decode(file: Blob): Promise<{
    width: number;
    height: number;
    draw(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  } | null>;
  encodeJpeg(
    width: number,
    height: number,
    draw: (ctx: CanvasRenderingContext2D) => void,
    quality: number,
  ): Promise<Blob | null>;
  createUrl(blob: Blob): string;
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function paint(ctx: Ctx2D | null, width: number, height: number, draw: (c: CanvasRenderingContext2D) => void): boolean {
  if (!ctx) return false;
  // JPEG has no alpha: flatten transparent PNGs onto white.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  draw(ctx as CanvasRenderingContext2D);
  return true;
}

export const browserImageEnv: ImageEnv = {
  async decode(file) {
    if (typeof createImageBitmap !== "function") return null;
    try {
      // Browsers apply EXIF orientation by default.
      const bitmap = await createImageBitmap(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      };
    } catch {
      return null;
    }
  },
  async encodeJpeg(width, height, draw, quality) {
    try {
      if (typeof OffscreenCanvas === "function") {
        const canvas = new OffscreenCanvas(width, height);
        if (!paint(canvas.getContext("2d"), width, height, draw)) return null;
        return await canvas.convertToBlob({ type: "image/jpeg", quality });
      }
      if (typeof document === "undefined") return null;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      if (!paint(canvas.getContext("2d"), width, height, draw)) return null;
      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    } catch {
      return null;
    }
  },
  createUrl: (blob) => URL.createObjectURL(blob),
};

const TOO_LARGE_AFTER_SHRINK = "This photo is too large even after shrinking. Try a smaller photo.";

export async function prepareImage(
  file: File,
  env: ImageEnv = browserImageEnv,
): Promise<PreparedImage | UploadProblem> {
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    return { reason: "type", message: "Choose a JPEG or PNG photo." };
  }
  if (file.size > MAX_RAW_FILE_BYTES) {
    return { reason: "too_large", message: "This file is too large. Choose a photo under 20 MB." };
  }
  const originalType = file.type;

  const useOriginal = async (failure: UploadProblem): Promise<PreparedImage | UploadProblem> => {
    if (file.size > MAX_IMAGE_BYTES) return failure;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      return { bytes, mediaType: originalType, previewUrl: env.createUrl(file) };
    } catch {
      return { reason: "unreadable", message: "This photo could not be read. Try another file." };
    }
  };

  const unreadable: UploadProblem = {
    reason: "unreadable",
    message: "This photo could not be read. Try another file.",
  };
  const tooLarge: UploadProblem = { reason: "too_large", message: TOO_LARGE_AFTER_SHRINK };

  try {
    const decoded = await env.decode(file);
    if (!decoded) return await useOriginal(unreadable);
    const size = fitWithin(decoded.width, decoded.height);
    const blob = await env.encodeJpeg(
      size.width,
      size.height,
      (ctx) => decoded.draw(ctx, size.width, size.height),
      JPEG_QUALITY,
    );
    if (!blob) return await useOriginal(tooLarge);
    if (blob.size > MAX_IMAGE_BYTES) return tooLarge;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { bytes, mediaType: "image/jpeg", previewUrl: env.createUrl(blob) };
  } catch {
    return await useOriginal(unreadable);
  }
}
