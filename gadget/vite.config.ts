import PackageJSON from "./package.json";

import { resolve } from "node:path";

import { defineConfig } from "vite";
import Userscript from "vite-userscript-plugin";

export default defineConfig({
  plugins: [
    Userscript({
      entry: resolve(__dirname, "src/main.ts"),
      header: {
        name: "bangumi-episode-ratings-gadget",
        version: PackageJSON.version,
        description: PackageJSON.description,
        match: [
          "https://bangumi.tv/*",
          "https://bgm.tv/*",
          "https://chii.in/*",
        ],
      },
      esbuildTransformOptions: {
        minify: false,
      },
    }),
  ],
});
