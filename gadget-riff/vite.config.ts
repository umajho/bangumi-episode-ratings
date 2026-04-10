import PackageJSON from "./package.json";

import { resolve } from "node:path";

import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  build: {
    lib: {
      name: "BangumiEpisodeRatingsGadgetRiff",
      entry: resolve(__dirname, "src/main.ts"),
      formats: ["iife"],
    },
    minify: false,
    rolldownOptions: { output: { banner: makeMetablock(PackageJSON) } },
  },
});

function makeMetablock(
  opts: { version: string; description: string; license: string },
) {
  if (opts.description.includes("\n")) {
    throw new Error("Description should not contain newlines.");
  }

  // 由于不（再）是真正的 UserScript，省略 `@grant`。
  return `
// ==UserScript==
// @namespace   https://github.com/umajho
// @name        Bangumi 单集评分（riff）
// @version     ${opts.version}
// @description ${opts.description}
// @license     ${opts.license}
// @website     https://github.com/umajho/bangumi-episode-ratings
// @match       https://bangumi.tv/*
// @match       https://bgm.tv/*
// @match       https://chii.in/*
// ==/UserScript==
  `.trim();
}
