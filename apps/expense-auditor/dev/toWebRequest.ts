// Dev server only (used by vite.config.ts). Never imported from src/, so it stays out of the client bundle.
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";

/** Converts a Node request into a Web Request. The base URL keeps the port from the Host header,
 *  so the handler's same-origin check sees the same host the browser sent in Origin. */
export function toWebRequest(req: IncomingMessage): Request {
  const headers = new Headers(req.headers as HeadersInit);
  headers.set("x-forwarded-for", req.socket?.remoteAddress ?? "127.0.0.1");
  const method = req.method ?? "GET";
  const init: RequestInit & { duplex?: "half" } = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = Readable.toWeb(req) as unknown as BodyInit;
    init.duplex = "half";
  }
  return new Request(new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`), init);
}
