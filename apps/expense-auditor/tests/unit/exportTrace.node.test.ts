// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadText } from "../../src/export/exportTrace";
import type { DownloadAnchor, DownloadEnv } from "../../src/export/exportTrace";

function fakeEnv() {
  const calls = { blobs: [] as string[], urls: [] as string[], revoked: [] as string[], clicks: 0 };
  const anchors: DownloadAnchor[] = [];
  const env: DownloadEnv = {
    createBlob: (text) => {
      calls.blobs.push(text);
      return new Blob([text]);
    },
    createObjectURL: () => {
      const u = `blob:fake-${calls.urls.length}`;
      calls.urls.push(u);
      return u;
    },
    revokeObjectURL: (u) => {
      calls.revoked.push(u);
    },
    createAnchor: () => {
      const a: DownloadAnchor = {
        href: "",
        download: "",
        click: () => {
          calls.clicks += 1;
        },
      };
      anchors.push(a);
      return a;
    },
  };
  return { env, calls, anchors };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("downloadText", () => {
  it("creates one Blob and one anchor with the file name, clicks it and revokes the URL", () => {
    const { env, calls, anchors } = fakeEnv();
    downloadText("expense-trace-abcd1234.json", "{}", env);
    expect(calls.blobs).toEqual(["{}"]);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.download).toBe("expense-trace-abcd1234.json");
    expect(anchors[0]?.href).toBe("blob:fake-0");
    expect(calls.clicks).toBe(1);
    expect(calls.revoked).toEqual(["blob:fake-0"]);
  });

  it("makes no network call", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    downloadText("x.json", "{}", fakeEnv().env);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not throw when the env throws, and still revokes a created URL", () => {
    const { env, calls } = fakeEnv();
    const throwing: DownloadEnv = {
      ...env,
      createAnchor: () => {
        throw new Error("no anchor");
      },
    };
    expect(() => downloadText("x.json", "{}", throwing)).not.toThrow();
    expect(calls.revoked).toEqual(["blob:fake-0"]);
    const allThrow: DownloadEnv = {
      ...env,
      createObjectURL: () => {
        throw new Error("no url");
      },
    };
    expect(() => downloadText("x.json", "{}", allThrow)).not.toThrow();
  });

  it("uses the browser APIs by default (jsdom stubs) and does not fetch", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const create = vi.fn(() => "blob:default");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    downloadText("expense-trace-12345678.json", "{}");
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:default");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.querySelector("a[download]")).toBeNull();
  });
});
