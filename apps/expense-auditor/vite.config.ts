import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";

const appRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appRoot, "../..");

/** Dev only: serves api/extract.ts at /api/extract so live mode works with `pnpm dev` and no Vercel CLI. */
function devExtractApi(mode: string): Plugin {
  return {
    name: "dev-extract-api",
    apply: "serve",
    configureServer(server) {
      // Server process only, never injected into the client. Variables already set in the shell win.
      for (const [key, value] of Object.entries(loadEnv(mode, appRoot, ""))) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
      server.middlewares.use("/api/extract", async (req, res) => {
        try {
          const mod = await server.ssrLoadModule("/api/extract.ts");
          const init: RequestInit & { duplex?: "half" } = {
            method: req.method ?? "GET",
            headers: req.headers as HeadersInit,
          };
          if (req.method !== "GET" && req.method !== "HEAD") {
            init.body = Readable.toWeb(req) as unknown as BodyInit;
            init.duplex = "half";
          }
          const forwarded = new Headers(init.headers);
          forwarded.set("x-forwarded-for", req.socket.remoteAddress ?? "127.0.0.1");
          const response: Response = await mod.default.fetch(
            new Request(new URL(req.url ?? "/", "http://localhost"), { ...init, headers: forwarded }),
          );
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "dev_middleware_failed" }));
        }
      });
    },
  };
}

export default defineConfig(({ command, mode }) => ({
  plugins: [react(), ...(command === "serve" ? [devExtractApi(mode)] : [])],
  server: { fs: { allow: [repoRoot] } }, // rules/ and packages/ are outside the app root
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  build: { target: "es2022", sourcemap: false },
}));
