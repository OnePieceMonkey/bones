import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const appRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(appRoot, "../..");

export default defineConfig({
  plugins: [react()],
  // rules/ and packages/ are outside the app root
  server: { host: "127.0.0.1", port: 5201, strictPort: true, fs: { allow: [repoRoot] } },
  preview: { host: "127.0.0.1", port: 5202, strictPort: true },
  // The e2e fixture flag (task 7.1): true only for CASE_FILES_E2E=1, so a normal build drops the e2e code.
  define: { __CASE_FILES_E2E__: JSON.stringify(process.env.CASE_FILES_E2E === "1") },
  build: { target: "es2022", sourcemap: false },
});
