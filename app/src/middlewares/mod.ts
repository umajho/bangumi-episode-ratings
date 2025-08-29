import * as log from "@std/log";

import { Context } from "hono";
import { createMiddleware } from "hono/factory";

import * as Djwt from "https://deno.land/x/djwt@v3.0.2/mod.ts";

import { UserID } from "@/types.ts";
import { respondWithError } from "@/responding.tsx";
import config from "@/config.ts";
import { Repo } from "@/repo/mod.ts";

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

export const referrers = (opts?: {
  shouldUseSearchParameterIfPresent?: true;
}) =>
  createMiddleware<{
    Variables: {
      referrerHostname:
        | (typeof config.bangumi.VALID_HOSTNAMES)[number]
        | null;
    };
  }>(async (ctx, next) => {
    const isForAPI = checkIsForAPI(ctx);

    const hostname = ((): string | undefined => {
      let referrer: string | undefined;
      if (opts?.shouldUseSearchParameterIfPresent) {
        referrer = ctx.req.query("referrer");
      }
      if (!referrer) {
        referrer = ctx.req.header("Referer");
      }
      return referrer && (new URL(referrer)).hostname;
    })();
    if (hostname) {
      const validHostname = config.bangumi.validateHostname(hostname);
      if (!validHostname) {
        return respondWithError(
          ctx,
          "UNSUPPORTED_REFERRER",
          `“${hostname}” 好像不是 bangumi 的站点。`,
          { isForAPI },
        );
      }
      ctx.set("referrerHostname", validHostname);
    } else {
      ctx.set("referrerHostname", null);
    }

    await next();
  });

export const auth = (opts?: {
  requiresTokenType?: "basic";
}) =>
  createMiddleware<{
    Variables: { authenticate: (repo: Repo) => Promise<UserID | null> };
  }>(async (ctx, next) => {
    const isForAPI = checkIsForAPI(ctx);

    const claimedUserID = extractClaimedUserID(ctx);

    // deno-lint-ignore require-await
    let fn: (repo: Repo) => Promise<UserID | null> = async () => null;

    const tokenResult = extractToken(ctx);
    switch (tokenResult[0]) {
      case "basic": {
        if (!claimedUserID) break;
        const [_, token] = tokenResult;
        fn = async (repo) => {
          return await repo.getUserIDEx(["token", token], { claimedUserID });
        };
        break;
      }
      case "jwt": {
        if (opts?.requiresTokenType === "basic") break;
        const [_, token] = tokenResult;
        fn = async () => {
          try {
            const payload = await Djwt
              .verify(token, await config.app.getJwtVerifyingKey());
            return payload.userID as UserID;
          } catch (e) {
            log.error(e);
            return null;
          }
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
  | ["basic", string]
  | ["jwt", string]
  | [type: "unsupported", scheme: string]
  | ["none"] {
  const authorizationHeader = ctx.req.header("Authorization");
  if (authorizationHeader) {
    const [scheme, rest] = authorizationHeader.split(" ", 2);
    if (scheme === "Basic") {
      return ["basic", rest];
    } else if (scheme === "Bearer") {
      return ["jwt", rest];
    }
    return ["unsupported", scheme];
  } else {
    return ["none"];
  }
}
