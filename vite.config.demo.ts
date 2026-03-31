import { defineConfig } from "vite";
import { resolve } from "path";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  root: "demo",
  plugins: [topLevelAwait()],
  resolve: {
    alias: {
      wikistxr: resolve(__dirname, "src/lib/index.ts"),
    },
  },
  build: {
    outDir: "../dist/demo",
  },
});
