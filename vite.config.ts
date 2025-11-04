import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/lib/index.ts"),
      name: "Wikistxr",
    },
    rollupOptions: {
      output: [
        {
          format: "es",
          dir: "dist/esm",
          entryFileNames: "[name].js",
          exports: "named",
        },
        {
          format: "cjs",
          dir: "dist/cjs",
          entryFileNames: "[name].js",
          exports: "named",
        },
      ],
    },
    sourcemap: true,
  },
});
