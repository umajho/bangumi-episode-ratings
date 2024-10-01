import PackageJSON from "./package.json" with { type: "json" };

import { defineConfig } from "rolldown";

import metablock from "rollup-plugin-userscript-metablock";
import dotenv from "rollup-plugin-dotenv";

export default defineConfig([
  {
    input: "src/main.ts",
    output: {
      name: "bangumiEpisodeRatingsGadget",
      format: "iife",
    },
    plugins: [
      metablock({
        file: "metablock.yaml",
        override: {
          version: PackageJSON.version,
          description: PackageJSON.description,
          license: PackageJSON.license,
          website: PackageJSON.homepage,
        },
        order: [
          ...["namespace", "name", "version", "description", "license"],
          ...["website", "match", "grant"],
        ],
      }),
      dotenv({ envKey: [".env"] }),
    ],
  },
]);
