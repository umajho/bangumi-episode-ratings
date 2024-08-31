import { match, P } from "npm:ts-pattern";

import * as KVUtils from "../kv-utils.ts";
import { UserID } from "../types.ts";

export async function matchTokenOrUserID(
  kv: Deno.Kv,
  tokenOrUserID: ["token", string | null] | ["userID", UserID],
  opts: { claimedUserID: UserID | null },
): Promise<UserID | null> {
  if (opts.claimedUserID === null) return null;

  return await match(tokenOrUserID)
    .returnType<Promise<UserID | null>>()
    .with(["userID", P.select()], (id) => Promise.resolve(id))
    .with(["token", P.select()], (token) => KVUtils.getUserID(kv, token))
    .exhaustive();
}
