import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [],
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "BangumiEpisodeRantingsGadget",
      fileName: "dist",
      formats: ["iife"],
    },
    minify: false,
  },
});
