import { defineConfig } from "vite";
import { resolve } from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  root: "demo",
  plugins: [wasm(), topLevelAwait()],
  resolve: {
    alias: {
      wikistxr: resolve(__dirname, "src/lib/index.ts"),
    },
  },
  build: {
    outDir: "../dist/demo",
  },
});
