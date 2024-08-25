import { Application } from "jsr:@oak/oak@14";

import env from "./src/env.ts";
import { State } from "./src/types.ts";
import { makeErrorResponse } from "./src/responses.tsx";
import router from "./src/routes/mod.ts";

const app = new Application<State>();

app.use(async (ctx, next) => {
  const isForAPI = ctx.request.url.pathname.startsWith("/api/");

  const referrer = ctx.request.headers.get("Referer");
  if (!referrer) {
    ctx.response.body = makeErrorResponse(
      "MISSING_REFERRER",
      "我是谁？我从哪里来？我要到哪里去？",
      { isForAPI },
    );
    return null;
  }

  const referrerURL = new URL(referrer);
  const hostname = referrerURL.hostname;
  if (
    !(env.VALID_BGM_HOSTNAMES as readonly string[])
      .includes(referrerURL.hostname)
  ) {
    ctx.response.body = makeErrorResponse(
      "UNSUPPORTED_REFERRER",
      `“${hostname}” 好像不是 bangumi 的站点。`,
      { isForAPI },
    );
    return null;
  }

  ctx.state.bgmBaseURL = (() => {
    let url = `https://${hostname}`;
    if (referrerURL.port) {
      url += `:${referrerURL.port}`;
    }
    return url;
  })();

  ctx.response.headers.set("Access-Control-Allow-Origin", ctx.state.bgmBaseURL);
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST");
  ctx.response.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, X-Gadget-Version",
  );

  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }

  const authorizationHeader = ctx.request.headers.get("Authorization");
  if (authorizationHeader) {
    const [scheme, rest] = authorizationHeader.split(" ", 2);
    if (scheme !== "Basic") {
      ctx.response.body = makeErrorResponse(
        "UNSUPPORTED_AUTHORIZATION_HEADER_SCHEME",
        `不支持 ${scheme} 作为 Authorization Header 的 Scheme。`,
        { isForAPI },
      );
      return;
    }
    ctx.state.token = rest;
  } else {
    ctx.state.token = null;
  }

  const gadgetVersion = ctx.request.headers.get("X-Gadget-Version");
  ctx.state.gadgetVersion = gadgetVersion;

  await next();
});

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: env.PORT });
