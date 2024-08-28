import { match, P } from "npm:ts-pattern";

import * as KVUtils from "../kv-utils.ts";

export async function matchTokenOrUserID(
  kv: Deno.Kv,
  tokenOrUserID: ["token", string | null] | ["userID", number],
  opts: { claimedUserID: number | null },
): Promise<number | null> {
  if (opts.claimedUserID === null) return null;

  return await match(tokenOrUserID)
    .returnType<Promise<number | null>>()
    .with(["userID", P.select()], (id) => Promise.resolve(id))
    .with(["token", P.select()], (token) => KVUtils.getUserID(kv, token))
    .exhaustive();
}
