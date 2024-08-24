import { Router } from "jsr:@oak/oak@14";

import { State } from "../../../types.ts";
import ENDPOINT_PATHS from "../../../shared/endpoint-paths.ts";
import { makeOkResponseForAPI } from "../../../responses.tsx";
import * as KVUtils from "../../../kv-utils.ts";

export const router = new Router<State>();
export default router;

router.get("/" + ENDPOINT_PATHS.API.DEV.WHOAMI, async (ctx) => {
  const kv = await Deno.openKv();

  const userID = await KVUtils.getUserID(kv, ctx.state.token);
  if (!userID) {
    ctx.response.body = makeOkResponseForAPI(null);
    return;
  }

  ctx.response.body = makeOkResponseForAPI(userID);
});
