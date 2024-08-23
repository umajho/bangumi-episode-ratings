import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.tsx"),
      name: "BangumiEpisodeRantingsGadget",
      fileName: "dist",
      formats: ["iife"],
    },
  },
});
