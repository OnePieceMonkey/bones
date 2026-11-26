import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: { __CASE_FILES_E2E__: false },
  test: {
    globals: false,
    environment: "jsdom",
    environmentMatchGlobs: [["tests/**/*.node.test.ts", "node"]],
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
    css: false,
  },
});
