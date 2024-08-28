import { RouterContext } from "jsr:@oak/oak@14";

export function tryExtractNumberFromCTXSearchParams<T extends string>(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<T, any, any>,
  key: string,
): number | null {
  const raw = ctx.request.url.searchParams.get(key);
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

export function tryExtractNumberFromCTXParams(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, any>,
  key: string,
): number | null {
  const raw = ctx.params?.[key];
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}
