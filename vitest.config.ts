import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.{test,spec}.ts"],
    pool: "forks",
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
