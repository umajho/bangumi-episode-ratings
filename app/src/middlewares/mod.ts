import { Context } from "jsr:@hono/hono";
import { createMiddleware } from "jsr:@hono/hono/factory";

import { UserID } from "../types.ts";
import { respondWithError } from "../responding.tsx";
import env from "../env.ts";

export const setIsForAPI = () =>
  createMiddleware<{
    Variables: { isForAPI: true };
  }>(async (ctx, next) => {
    ctx.set("isForAPI", true);
    await next();
  });

// deno-lint-ignore no-explicit-any
function checkIsForAPI(ctx: Context<any>): boolean {
  return !!ctx.var.isForAPI;
}

type GadgetVersion = number & { readonly __tag: unique symbol };

export const gadgetVersion = () =>
  createMiddleware<{
    Variables: { gadgetVersion: GadgetVersion | null };
  }>(async (ctx, next) => {
    ctx.set(
      "gadgetVersion",
      parseGadgetVersion(ctx.req.header("X-Gadget-Version")),
    );

    await next();
  });

export const claimedUserID = () =>
  createMiddleware<{
    Variables: { claimedUserID: UserID | null };
  }>(async (ctx, next) => {
    const claimedUserIDRaw = ctx.req.header("X-Claimed-User-ID");
    if (claimedUserIDRaw && /^\d+$/.test(claimedUserIDRaw)) {
      ctx.set("claimedUserID", Number(claimedUserIDRaw) as UserID);
    } else {
      ctx.set("claimedUserID", null);
    }

    await next();
  });

function parseGadgetVersion(raw: string | undefined): GadgetVersion | null {
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error("unreachable!");
  }
  const numParts = parts.map(Number) as [number, number, number];
  if (numParts[1] >= 1_000 || numParts[2] >= 1_000) {
    throw new Error("unreachable!");
  }

  return (
    numParts[0] * 1_000_000 + numParts[1] * 1_000 + numParts[2]
  ) as GadgetVersion;
}

export const referrers = () =>
  createMiddleware<{
    Variables: {
      referrerHostname:
        | `https://${(typeof env.VALID_BGM_HOSTNAMES)[number]}`
        | null;
    };
  }>(async (ctx, next) => {
    const isForAPI = checkIsForAPI(ctx);

    const referrer = ctx.req.header("Referer");
    if (referrer) {
      const hostname = (new URL(referrer)).hostname;
      const validHostname = env.validateBgmHostname(hostname);
      if (!validHostname) {
        return respondWithError(
          ctx,
          "UNSUPPORTED_REFERRER",
          `“${hostname}” 好像不是 bangumi 的站点。`,
          { isForAPI },
        );
      }
      ctx.set("referrerHostname", `https://${validHostname}`);
    } else {
      ctx.set("referrerHostname", null);
    }

    await next();
  });

export const auth = () =>
  createMiddleware<{
    Variables: { token: string | null };
  }>(async (ctx, next) => {
    const isForAPI = checkIsForAPI(ctx);

    const authorizationHeader = ctx.req.header("Authorization");
    if (authorizationHeader) {
      const [scheme, rest] = authorizationHeader.split(" ", 2);
      if (scheme !== "Basic") {
        return respondWithError(
          ctx,
          "UNSUPPORTED_AUTHORIZATION_HEADER_SCHEME",
          `不支持 ${scheme} 作为 Authorization Header 的 Scheme。`,
          { isForAPI },
        );
      }
      ctx.set("token", rest);
    } else {
      ctx.set("token", null);
    }

    await next();
  });
