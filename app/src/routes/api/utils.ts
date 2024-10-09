import { Context } from "jsr:@hono/hono";

import { UserID } from "@/types.ts";

export function tryExtractIntegerFromCTXSearchParams(
  ctx: Context,
  key: string,
): number | null {
  const raw = ctx.req.query(key);
  if (!raw) return null;
  return tryConvertSafeIntegerFromString(raw);
}

export function tryExtractIntegerFromCTXParams(
  ctx: Context,
  key: string,
): number | null {
  const raw = ctx.req.param(key);
  if (!raw) return null;
  return tryConvertSafeIntegerFromString(raw);
}

export function tryExtractUserIDOrMeFromCTXParams(
  ctx: Context,
  key: string,
): UserID | "me" | null {
  const raw = ctx.req.param(key);
  if (!raw) return null;
  if (raw === "me") return "me";
  return tryConvertSafeIntegerFromString(raw) as UserID | null;
}

function tryConvertSafeIntegerFromString(str: string): number | null {
  if (!/^\d+$/.test(str)) return null;
  const num = Number(str);
  if (!Number.isSafeInteger(num)) return null;
  return num;
}
