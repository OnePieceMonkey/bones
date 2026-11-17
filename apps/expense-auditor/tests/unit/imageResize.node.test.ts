import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES } from "../../shared/wire";
import {
  JPEG_QUALITY,
  MAX_RAW_FILE_BYTES,
  prepareImage,
  type ImageEnv,
  type PreparedImage,
} from "../../src/extraction/imageResize";

function makeFile(size: number, type: string, fill = 7): File {
  return new File([new Uint8Array(size).fill(fill)], "receipt", { type });
}

interface Calls {
  encode: Array<{ width: number; height: number; quality: number }>;
  urls: Blob[];
}

function makeEnv(opts: {
  decoded?: { width: number; height: number } | null;
  encoded?: Blob | null;
}): { env: ImageEnv; calls: Calls } {
  const calls: Calls = { encode: [], urls: [] };
  const decoded = opts.decoded === undefined ? { width: 3200, height: 2400 } : opts.decoded;
  const env: ImageEnv = {
    async decode() {
      return decoded ? { ...decoded, draw: () => {} } : null;
    },
    async encodeJpeg(width, height, _draw, quality) {
      calls.encode.push({ width, height, quality });
      return opts.encoded === undefined ? new Blob([new Uint8Array(10).fill(1)]) : opts.encoded;
    },
    createUrl(blob) {
      calls.urls.push(blob);
      return "blob:fake";
    },
  };
  return { env, calls };
}

describe("prepareImage", () => {
  it("rejects a GIF with reason type", async () => {
    const { env } = makeEnv({});
    const result = await prepareImage(makeFile(100, "image/gif"), env);
    expect(result).toMatchObject({ reason: "type" });
  });

  it("rejects a file above the raw cap with too_large", async () => {
    const { env, calls } = makeEnv({});
    const result = await prepareImage(makeFile(MAX_RAW_FILE_BYTES + 1, "image/jpeg"), env);
    expect(result).toMatchObject({ reason: "too_large" });
    expect(calls.encode).toHaveLength(0);
  });

  it("returns too_large when the encoded JPEG is above 3 MiB", async () => {
    const { env } = makeEnv({ encoded: new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)]) });
    const result = await prepareImage(makeFile(1000, "image/jpeg"), env);
    expect(result).toMatchObject({ reason: "too_large" });
  });

  it("falls back to the original bytes when decoding fails within 3 MiB", async () => {
    const { env } = makeEnv({ decoded: null });
    const result = (await prepareImage(makeFile(500, "image/png", 9), env)) as PreparedImage;
    expect(result.mediaType).toBe("image/png");
    expect(result.bytes).toEqual(new Uint8Array(500).fill(9));
    expect(result.previewUrl).toBe("blob:fake");
  });

  it("returns unreadable when decoding fails above 3 MiB", async () => {
    const { env } = makeEnv({ decoded: null });
    const result = await prepareImage(makeFile(MAX_IMAGE_BYTES + 1, "image/jpeg"), env);
    expect(result).toMatchObject({ reason: "unreadable" });
  });

  it("returns unreadable when the decoder throws on a file above 3 MiB", async () => {
    const { env } = makeEnv({});
    env.decode = async () => {
      throw new Error("boom");
    };
    const result = await prepareImage(makeFile(MAX_IMAGE_BYTES + 1, "image/png"), env);
    expect(result).toMatchObject({ reason: "unreadable" });
  });

  it("converts a PNG to a downsized JPEG", async () => {
    const { env, calls } = makeEnv({ decoded: { width: 3200, height: 2400 } });
    const result = (await prepareImage(makeFile(1000, "image/png"), env)) as PreparedImage;
    expect(result.mediaType).toBe("image/jpeg");
    expect(result.bytes).toEqual(new Uint8Array(10).fill(1));
    expect(result.previewUrl).toBe("blob:fake");
    expect(calls.encode).toEqual([{ width: 1600, height: 1200, quality: JPEG_QUALITY }]);
  });
});
