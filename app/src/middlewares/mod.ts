import { Context } from "jsr:@hono/hono";
import { createMiddleware } from "jsr:@hono/hono/factory";

import { UserID } from "../types.ts";
import { respondWithError } from "../responding.tsx";
import env from "../env.ts";
import { Repo } from "../repo/mod.ts";

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
    Variables: { authenticate: (repo: Repo) => Promise<UserID | null> };
  }>(async (ctx, next) => {
    const isForAPI = checkIsForAPI(ctx);

    const claimedUserID = extractClaimedUserID(ctx);

    // deno-lint-ignore require-await
    let fn: (repo: Repo) => Promise<UserID | null> = async () => null;

    const tokenResult = extractToken(ctx);
    switch (tokenResult[0]) {
      case "token": {
        if (!claimedUserID) break;
        const [_, token] = tokenResult;
        fn = async (repo) => {
          return await repo.getUserIDEx(["token", token], { claimedUserID });
        };
        break;
      }
      case "unsupported": {
        const [_, scheme] = tokenResult;
        return respondWithError(
          ctx,
          "UNSUPPORTED_AUTHORIZATION_HEADER_SCHEME",
          `不支持 ${scheme} 作为 Authorization Header 的 Scheme。`,
          { isForAPI },
        );
      }
      case "none":
        break;
      default:
        tokenResult satisfies never;
    }

    ctx.set("authenticate", fn);

    await next();
  });

function extractClaimedUserID(ctx: Context): UserID | null {
  const claimedUserIDRaw = ctx.req.header("X-Claimed-User-ID");
  if (claimedUserIDRaw && /^\d+$/.test(claimedUserIDRaw)) {
    return Number(claimedUserIDRaw) as UserID;
  } else {
    return null;
  }
}

function extractToken(ctx: Context):
  | ["token", string]
  | [type: "unsupported", scheme: string]
  | ["none"] {
  const authorizationHeader = ctx.req.header("Authorization");
  if (authorizationHeader) {
    const [scheme, rest] = authorizationHeader.split(" ", 2);
    if (scheme !== "Basic") {
      return ["unsupported", scheme];
    }
    return ["token", rest];
  } else {
    return ["none"];
  }
}
