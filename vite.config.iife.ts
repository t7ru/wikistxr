import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/lib/index.ts"),
      name: "Wikistxr",
      formats: ["iife"],
      fileName: () => "wikistxr.min.js",
    },
    emptyOutDir: false,
    minify: "esbuild",
  },
});
