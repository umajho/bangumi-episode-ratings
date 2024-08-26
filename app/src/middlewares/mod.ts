import { Context, Next } from "jsr:@oak/oak@14";

import { State } from "../types.ts";
import { stringifyErrorResponse } from "../responses.tsx";
import env from "../env.ts";

export const gadgetVersion =
  () => async (ctx: Context<State, State>, next: Next) => {
    const gadgetVersion = ctx.request.headers.get("X-Gadget-Version");
    if (gadgetVersion) {
      const parts = gadgetVersion?.split(".");
      if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
        throw new Error("unreachable!");
      }
      const numberParts = parts
        .map((part) => parseInt(part)) as [number, number, number];
      if (numberParts[1] >= 1_000 || numberParts[2] >= 1_000) {
        throw new Error("unreachable!");
      }
      ctx.state.gadgetVersion = numberParts[0] * 1_000_000 +
        numberParts[1] * 1_000 + numberParts[2];
    } else {
      ctx.state.gadgetVersion = null;
    }
    await next();
  };

export const referrer =
  () => async (ctx: Context<State, State>, next: Next) => {
    const isForAPI = ctx.request.url.pathname.startsWith("/api/");

    const referrer = ctx.request.headers.get("Referer");

    if (referrer) {
      const hostname_ = (new URL(referrer)).hostname;
      // TODO: 处理存在端口之类的情况？
      if (!(env.VALID_BGM_HOSTNAMES as readonly string[]).includes(hostname_)) {
        ctx.response.body = stringifyErrorResponse(
          "UNSUPPORTED_REFERRER",
          `“${hostname_}” 好像不是 bangumi 的站点。`,
          { isForAPI },
        );
        return;
      }
      const hostname = hostname_ as (typeof env.VALID_BGM_HOSTNAMES)[number];
      ctx.state.referrerHostname = `https://${hostname}`;
    }

    await next();
  };

export const auth = () => async (ctx: Context<State, State>, next: Next) => {
  const isForAPI = ctx.request.url.pathname.startsWith("/api/");

  const authorizationHeader = ctx.request.headers.get("Authorization");
  if (authorizationHeader) {
    const [scheme, rest] = authorizationHeader.split(" ", 2);
    if (scheme !== "Basic") {
      ctx.response.body = stringifyErrorResponse(
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

  await next();
};

export const cors = () => async (ctx: Context<State, State>, next: Next) => {
  // 我不知道 oak 的 Router Middleware 该怎么用，按照常识使用 `router.use` 结果
  // 根本不会触发，就先这么办了。
  if (
    !(["/api", "/auth"].some((path) =>
      ctx.request.url.pathname.startsWith(path)
    ))
  ) {
    await next();
    return;
  }

  const isForAPI = ctx.request.url.pathname.startsWith("/api/");

  if (!ctx.state.referrerHostname) {
    ctx.response.body = stringifyErrorResponse(
      "MISSING_REFERRER",
      "我是谁？我从哪里来？我要到哪里去？",
      { isForAPI },
    );
    return null;
  }

  ctx.response.headers.set(
    "Access-Control-Allow-Origin",
    ctx.state.referrerHostname,
  );
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST");
  ctx.response.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, X-Gadget-Version",
  );

  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  } else {
    await next();
  }
};
