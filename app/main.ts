import * as log from "jsr:@std/log";
import * as path from "jsr:@std/path";

import { Hono } from "jsr:@hono/hono";
import { logger } from "jsr:@hono/hono/logger";
import { cors } from "jsr:@hono/hono/cors";
import { compress } from "jsr:@hono/hono/compress";

import config from "./src/config.ts";
import router from "./src/routes/mod.ts";
import ENDPOINT_PATHS from "./src/shared/endpoint-paths.ts";

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

    const fileHandler = new log.RotatingFileHandler("INFO", {
      formatter: log.formatters.jsonFormatter,

      filename: config.app.LOG_FILE_PATH,
      maxBytes: 1024 * 1024 * 10, // 10 MB
      maxBackupCount: Infinity,
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

let lastLogDate: { year: number; month: number; day: number } | null = null;
app.use(logger((str, ...rest) => {
  const now = new Date();
  const nowDate = {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
  };
  if (
    nowDate.day !== lastLogDate?.day ||
    nowDate.month !== lastLogDate?.month ||
    nowDate.year !== lastLogDate?.year
  ) {
    log.info(`TODAY: ${nowDate.year}-${nowDate.month}-${nowDate.day}`);
  }
  const nowHourText = ("" + now.getHours()).padStart(2, "0");
  const nowMinuteText = ("" + now.getMinutes()).padStart(2, "0");
  const nowSecondText = ("" + now.getSeconds()).padStart(2, "0");
  const nowTimeText = `${nowHourText}:${nowMinuteText}:${nowSecondText}`;

  log.info(`${nowTimeText} ${str}`, rest);
  lastLogDate = nowDate;
}));
app.use(cors({
  origin: config.site.CORS_ORIGINS,
  allowHeaders: config.site.cloneCorsAllowedHeaders(),
  allowMethods: config.site.cloneCorsAllowedMethods(),
  credentials: true,
}));
app.use(compress());

app.route("/", router);

const CORS_PREFLIGHT_BYPASS_FULL_PATH =
  `/${ENDPOINT_PATHS.CORS_PREFLIGHT_BYPASS}/`;

Deno.serve({
  ...(config.site.PORT && { port: config.site.PORT }),
}, async (req) => {
  const url = new URL(req.url);
  if (
    req.method === "POST" &&
    url.pathname.startsWith(CORS_PREFLIGHT_BYPASS_FULL_PATH)
  ) {
    const sliceStart = CORS_PREFLIGHT_BYPASS_FULL_PATH.length;
    const methodAndPath = url.pathname.slice(sliceStart);
    const maybeReq = await rewriteRequestForCorsPreflightBypass(req, {
      originalURL: url,
      origin: req.headers.get("Origin") ?? "",
      methodAndPath,
    });
    if (!maybeReq) return new Response(null, { status: 400 });
    req = maybeReq;
  }

  return app.fetch(req);
});

async function rewriteRequestForCorsPreflightBypass(
  req: Request,
  opts: {
    originalURL: URL;
    origin: string;
    methodAndPath: string;
  },
): Promise<Request | null> {
  // 由于没了 preflight，无论是否通过 CORS，操作都会进行，所以这里提前确认
  // Origin，以防止未知的 Origin 去触发操作。
  if (!config.site.CORS_ORIGINS.includes(opts.origin)) {
    log.warn(
      "rewriteRequestForCorsPreflightBypass",
      `未知 Origin：${opts.origin}`,
    );
    return null;
  }

  const firstSlashIndex = opts.methodAndPath.indexOf("/");
  const method = opts.methodAndPath.slice(0, firstSlashIndex);
  const path = opts.methodAndPath.slice(firstSlashIndex);

  // 目前先只支持 `/api/*`。
  if (!path.startsWith("/api/")) {
    log.warn(
      "rewriteRequestForCorsPreflightBypass",
      `不支持的路径：${path}`,
    );
    return null;
  }

  if (!config.site.isCorsAllowedMethod(method)) {
    log.warn(
      "rewriteRequestForCorsPreflightBypass",
      `不支持的 Method：${method}`,
    );
    return null;
  }

  const [additionalHeaders, body] = await req
    .json() as [Record<string, string>, string | null];

  const headers = new Headers(req.headers);
  for (const key of Object.keys(additionalHeaders)) {
    if (!config.site.isCorsAllowedHeader(key)) {
      log.warn(
        "rewriteRequestForCorsPreflightBypass",
        `不支持的 Header：${key}`,
      );
      return null;
    }
    headers.set(key, additionalHeaders[key]);
  }

  const url = new URL(opts.originalURL);
  url.pathname = path;

  return new Request(url, { method, headers, body });
}
