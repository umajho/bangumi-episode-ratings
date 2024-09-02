import { Context } from "jsr:@hono/hono";

export function tryExtractNumberFromCTXSearchParams(
  ctx: Context,
  key: string,
): number | null {
  const raw = ctx.req.query(key);
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

export function tryExtractNumberFromCTXParams(
  ctx: Context,
  key: string,
): number | null {
  const raw = ctx.req.param(key);
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}
