import PackageJSON from "./package.json";

import { relative, resolve } from "node:path";
import { loadEnv } from "vite";

import { defineConfig, PluginOption } from "vite";

import { parseAndWalk } from "oxc-walker";
import type { Node } from "@oxc-project/types";
import { generate } from "astring";

export default defineConfig({
  plugins: [
    regionComments(),
    whyDoesNotViteImportMetaEnvWorkAnymore(),
    workaroundViteWeirdnessPlugin(),
  ],
  define: {
    VITE_TEST: JSON.stringify("test"),
  },
  build: {
    lib: {
      name: "BangumiEpisodeRatingsGadget",
      entry: resolve(__dirname, "src/main.ts"),
      formats: ["iife"],
    },
    minify: false,
    rollupOptions: {
      output: {
        banner: workaroundViteWeirdness(makeMetablock({
          version: PackageJSON.version,
          description: PackageJSON.description,
        })),
      },
    },
  },
});

function makeMetablock(opts: { version: string; description: string }) {
  if (opts.description.includes("\n")) {
    throw new Error("Description should not contain newlines.");
  }

  return `
// ==UserScript==
// @namespace   https://github.com/umajho
// @name        bangumi-episode-ratings-gadget
// @version     ${opts.version}
// @description ${opts.description}
// @license     MIT
// @website     https://github.com/umajho/bangumi-episode-ratings
// @match       https://bangumi.tv/*
// @match       https://bgm.tv/*
// @match       https://chii.in/*
// @grant       GM_info
// @grant       unsafeWindow
// @grant       window.close
// ==/UserScript==
  `.trim();
}

/**
 * Vite 会自顾自地移除 `// <at>license …` `//!` 之外的注释，因此需要
 * workaround。
 */
function workaroundViteWeirdness(content: string, dummyVariable = true) {
  const lines = content.split("\n").map((line) => `//! ${line}`);
  if (dummyVariable) {
    lines.push("WILL_BE_REMOVED();");
  }
  return lines.join("\n");
}

function workaroundViteWeirdnessPlugin(): PluginOption {
  return {
    name: "workaround-vite-removing-comments",
    generateBundle: (_opts, bundle) => {
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        if (chunk.type === "chunk" && chunk.code) {
          chunk.code = chunk.code.replaceAll(
            // 看起来 rolldown-vite 有 bug（因为原本的 vite 就正常），导致
            // `WILL_BE_REMOVED();` 会被转换成 `WILL_BE_REMOVED(), WILL_BE_REMOVED();`
            /(^\s*\/\/! |WILL_BE_REMOVED\(\), |WILL_BE_REMOVED\(\);\n)/gm,
            "",
          );
        }
      }
    },
  };
}

/**
 * Rolldown 生成的代码可以包含 `#region` 和 `#endregion` 注释，但 Vite 没有暴露
 * 这一功能，这里补上这个功能。
 */
function regionComments(): PluginOption {
  return {
    name: "region-comments",
    transform(code, id) {
      const path = id.startsWith("/") ? relative(__dirname, id) : id;
      return {
        code: [
          // `#region` 后如果不存在 dummy 变量，很多会被 Vite 移除。
          workaroundViteWeirdness(`// #region ${path}`),
          code,
          // `#endregion` 后如果存在 dummy 变量，大部分反而会被 Vite 移除…
          workaroundViteWeirdness("// #endregion", false),
        ].join("\n"),
      };
    },
  };
}

function whyDoesNotViteImportMetaEnvWorkAnymore(): PluginOption {
  const envs = loadEnv("production", process.cwd(), ["VITE_"]);
  const envKeys = new Set(Object.keys(envs));

  function isImportMetaEnv(node: Node) {
    if (node.type !== "MemberExpression") return false;
    if (node.object.type !== "MemberExpression") return false;
    if (!isIdentifier(node.object.property, "env")) return false;
    if (node.object.object.type !== "MetaProperty") return false;
    if (!isIdentifier(node.object.object.property, "meta")) return false;
    if (!isIdentifier(node.object.object.meta, "import")) return false;
    return true;
  }

  function isIdentifier(node: Node, name: string) {
    return node.type === "Identifier" && node.name === name;
  }

  return {
    name: "why-does-not-vite-import-meta-env-work-anymore",
    transform: async (code, id) => {
      let hasModified = false;

      const parsed = parseAndWalk(code, id, function (node) {
        if (
          node.type === "MemberExpression" && isImportMetaEnv(node) &&
          node.property.type === "Identifier"
        ) {
          const key = `VITE_${node.property.name}`;
          if (envKeys.has(key)) {
            hasModified = true;
            const value = envs[key];
            const raw = JSON.stringify(value);
            this.replace({ type: "Literal", value, raw });
          }
        }
      });
      return {
        // 关于将 oxc 的 AST 转换回 JavaScript 的方式，参见：
        // https://github.com/oxc-project/oxc/issues/11495
        code: hasModified ? generate(parsed.program) : code,
      };
    },
  };
}
