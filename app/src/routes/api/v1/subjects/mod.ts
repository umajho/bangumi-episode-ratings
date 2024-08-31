import { Router, RouterContext } from "jsr:@oak/oak@14";

import { StateForAPI, SubjectID } from "../../../../types.ts";
import { tryExtractNumberFromCTXParams } from "../../utils.ts";
import { stringifyResponseForAPI } from "../../../../responses.tsx";
import * as Queries from "../../../../operations/queries.ts";

import episodesRouter from "./episodes.ts";

export const router = new Router<StateForAPI>();
export default router;

router.use(
  "/episodes/:episodeID",
  episodesRouter.routes(),
  episodesRouter.allowedMethods(),
);

router.get("/episodes/ratings", handleGetSubjectEpisodesRatings);

async function handleGetSubjectEpisodesRatings(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, StateForAPI>,
) {
  const claimedUserID = ctx.state.claimedUserID;
  const subjectID = //
    tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;

  if (subjectID === null) {
    ctx.response.body = //
      stringifyResponseForAPI(["error", "BAD_REQUEST", "参数有误。"]);
    return;
  }

  const kv = await Deno.openKv();

  const result = await Queries.querySubjectEpisodesRatings(
    kv,
    ["token", ctx.state.token],
    { claimedUserID, subjectID },
  );

  ctx.response.body = stringifyResponseForAPI(result);
}
