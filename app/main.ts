import { Hono } from "jsr:@hono/hono";
import { logger } from "jsr:@hono/hono/logger";
import { cors } from "jsr:@hono/hono/cors";
import { compress } from "jsr:@hono/hono/compress";

import config from "./src/config.ts";
import router from "./src/routes/mod.ts";
import ENDPOINT_PATHS from "./src/shared/endpoint-paths.ts";

const app = new Hono();

app.use(logger());
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
    console.warn(
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
    console.warn(
      "rewriteRequestForCorsPreflightBypass",
      `不支持的路径：${path}`,
    );
    return null;
  }

  if (!config.site.isCorsAllowedMethod(method)) {
    console.warn(
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
      console.warn(
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
