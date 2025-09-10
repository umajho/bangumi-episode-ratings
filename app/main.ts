import * as log from "@std/log";
import * as path from "@std/path";

import { Hono } from "hono";
import { compress } from "hono/compress";

import config from "./src/config.ts";
import router from "./src/routes/mod.ts";
import { cors } from "./src/middlewares/cors.ts";

Deno.addSignalListener("SIGTERM", () => {
  log.info("Exiting App...");
  Deno.exit();
});

log.setup((() => {
  const logConfig: log.LogConfig = {
    handlers: {
      console: new log.ConsoleHandler("DEBUG"),
    },
    loggers: {
      default: {
        level: "DEBUG",
        handlers: ["console"],
      },
    },
  };

  if (config.app.LOG_FILE_PATH) {
    Deno.mkdirSync(path.dirname(config.app.LOG_FILE_PATH), { recursive: true });

    const fileHandler = new log.FileHandler("INFO", {
      formatter: log.formatters.jsonFormatter,
      filename: config.app.LOG_FILE_PATH,
    });

    globalThis.addEventListener("unload", fileHandler.flush);
    // 1 second。
    // FIXME: 不知道为什么还是有些延迟，而且我用 k6 发了几千个请求生成一堆 log
    // 后 log 文件更是一点动静都没有，要直到 ^C 时才会 flush。更谜的是如果不包在
    // 匿名函数里，就会完全没有作用。
    setInterval(() => fileHandler.flush(), 1000);

    logConfig.handlers!.file = fileHandler;
    logConfig.loggers!.default.handlers!.push("file");
  }

  return logConfig;
})());

const app = new Hono();

app.use(cors({
  origin: config.site.CORS_ORIGINS,
  allowHeaders: config.site.cloneCorsAllowedHeaders(),
  allowMethods: config.site.cloneCorsAllowedMethods(),
  credentials: true,
  privateNetwork: config.app.DEV,
}));
app.use(compress());

app.route("/", router);

Deno.serve({
  ...(config.site.PORT && { port: config.site.PORT }),
}, app.fetch);
