import { Router, RouterContext } from "jsr:@oak/oak@14";

import { StateForAPI } from "../../../types.ts";
import ENDPOINT_PATHS from "../../../shared/endpoint-paths.ts";
import {
  APIResponse,
  GetEpisodeRatingsResponseData,
  GetEpisodeRatingsResponseData__Until_0_1_13,
  RateEpisodeRequestData,
} from "../../../shared/dto.ts";
import { stringifyResponseForAPI } from "../../../responses.tsx";
import * as Commands from "../../../operations/commands.ts";
import * as Queries from "../../../operations/queries.ts";
import { match, P } from "npm:ts-pattern";

export const router = new Router<StateForAPI>();
export default router;

router.post("/" + ENDPOINT_PATHS.API.V0.RATE_EPISODE, async (ctx) => {
  const data = await ctx.request.body.json() as RateEpisodeRequestData;

  const result = await Commands.rateEpisode(null, ["token", ctx.state.token], {
    claimedUserID: data.claimed_user_id,
    claimedSubjectID: data.subject_id,
    episodeID: data.episode_id,
    score: data.score,
  });

  ctx.response.body = stringifyResponseForAPI(result);
});

router.get(
  "/" + ENDPOINT_PATHS.API.V0.SUBJECT_EPISODES_RATINGS,
  async (ctx) => {
    const claimedUserID = //
      tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id");
    const subjectID = tryExtractNumberFromCTXSearchParams(ctx, "subject_id");

    if (!subjectID) {
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
  },
);

router.get("/" + ENDPOINT_PATHS.API.V0.EPISODE_RATINGS, async (ctx) => {
  const claimedUserID = //
    tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id");
  const subjectID = tryExtractNumberFromCTXSearchParams(ctx, "subject_id");
  const episodeID = tryExtractNumberFromCTXSearchParams(ctx, "episode_id");

  if (!subjectID || !episodeID) {
    ctx.response.body = stringifyResponseForAPI(
      ["error", "BAD_REQUEST", "参数有误。"],
    );
    return;
  }

  const kv = await Deno.openKv();

  const result_ = await Queries.queryEpisodeRatings(
    kv,
    ["token", ctx.state.token],
    { claimedUserID, subjectID, episodeID },
  );

  const result = match(result_)
    .returnType<
      APIResponse<
        | GetEpisodeRatingsResponseData
        | GetEpisodeRatingsResponseData__Until_0_1_13
      >
    >()
    .with([
      "ok",
      // < 0.1.4
      P.when(() => !ctx.state.gadgetVersion || ctx.state.gadgetVersion < 1_004),
    ], ([_, data]) => {
      return ["ok", {
        votes: data.votes,
        ...(data.my_rating ? { userScore: data.my_rating.score } : {}),
      }];
    })
    .with(P._, (v) => v)
    .exhaustive();

  ctx.response.body = stringifyResponseForAPI(result);
});

router.get("/" + ENDPOINT_PATHS.API.V0.MY_EPISODE_RATING, async (ctx) => {
  const claimedUserID = //
    tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id");
  const subjectID = tryExtractNumberFromCTXSearchParams(ctx, "subject_id");
  const episodeID = tryExtractNumberFromCTXSearchParams(ctx, "episode_id");

  if (!subjectID || !episodeID) {
    ctx.response.body = stringifyResponseForAPI(
      ["error", "BAD_REQUEST", "参数有误。"],
    );
    return;
  }

  const kv = await Deno.openKv();

  const result = await Queries.queryEpisodeMyRating(
    kv,
    ["token", ctx.state.token],
    { claimedUserID, subjectID, episodeID },
  );

  ctx.response.body = stringifyResponseForAPI(result);
});

function tryExtractNumberFromCTXSearchParams(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, any>,
  key: string,
): number | null {
  const raw = ctx.request.url.searchParams.get(key);
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}
