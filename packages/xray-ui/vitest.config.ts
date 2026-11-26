import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: false,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    css: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
