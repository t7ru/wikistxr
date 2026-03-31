import { defineConfig } from "vite";
import { resolve } from "path";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [topLevelAwait()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/lib/index.ts"),
      name: "wikistxr",
      fileName: "index",
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  assetsInclude: ["**/*.wasm"],
});
