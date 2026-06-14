import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standard multi-asset build + dev server. Vitest config is colocated here.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["dyno/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    setupFiles: ["./dyno/setup.ts"],
    testTimeout: 30_000,
  },
});
