import { Router } from "jsr:@oak/oak@14";
import { State, TokenData } from "../../../types.ts";

import ENDPOINT_PATHS from "../../../shared/endpoint-paths.ts";

import { makeOkResponseForAPI } from "../../../responses.tsx";

export const router = new Router<State>();
export default router;

router.get("/" + ENDPOINT_PATHS.API.DEV.WHOAMI, async (ctx) => {
  const kv = await Deno.openKv();

  const userID = await getUserID(kv, ctx.state.token);
  if (!userID) {
    ctx.response.body = makeOkResponseForAPI(null);
    return;
  }

  ctx.response.body = makeOkResponseForAPI(userID);
});

async function getUserID(
  kv: Deno.Kv,
  token: string | null,
): Promise<number | null> {
  if (!token) return null;

  const tokenResult = await kv.get<TokenData>(["tokens", token]);
  if (!tokenResult.value) return null;

  return tokenResult.value.userID;
}
