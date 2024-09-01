import { Router } from "jsr:@oak/oak@14";
import { match, P } from "npm:ts-pattern";

import { EpisodeID, StateForAPI, SubjectID, UserID } from "../../../types.ts";
import {
  APIResponse,
  GetEpisodeRatingsResponseData__Until_0_1_13,
  GetEpisodeRatingsResponseData__Until_0_3_0,
  RateEpisodeRequestData__V0,
} from "../../../shared/dto.ts";
import { stringifyResponseForAPI } from "../../../responses.tsx";
import * as Commands from "../../../operations/commands.ts";
import * as Queries from "../../../operations/queries.ts";
import { tryExtractNumberFromCTXSearchParams } from "../utils.ts";
import * as Global from "../../../global.ts";

export const router = new Router<StateForAPI>();
export default router;

router.post("/rate-episode", async (ctx) => {
  const data = await ctx.request.body.json() as RateEpisodeRequestData__V0;

  const result = await Commands.rateEpisode(
    Global.repo,
    Global.bangumiClient,
    ["token", ctx.state.token],
    {
      claimedUserID: data.claimed_user_id as UserID,
      claimedSubjectID: data.subject_id as SubjectID,
      episodeID: data.episode_id as EpisodeID,
      score: data.score,
    },
  );

  ctx.response.body = stringifyResponseForAPI(result);
});

router.get("/subject-episodes-ratings", async (ctx) => {
  const claimedUserID = //
    tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id") as UserID;
  const subjectID = //
    tryExtractNumberFromCTXSearchParams(ctx, "subject_id") as SubjectID;

  if (!subjectID) {
    ctx.response.body = //
      stringifyResponseForAPI(["error", "BAD_REQUEST", "参数有误。"]);
    return;
  }

  const result = await Queries.querySubjectEpisodesRatings(
    Global.repo,
    ["token", ctx.state.token],
    { claimedUserID, subjectID },
  );

  ctx.response.body = stringifyResponseForAPI(result);
});

router.get("/episode-ratings", async (ctx) => {
  const claimedUserID = //
    tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id") as UserID;
  const subjectID = //
    tryExtractNumberFromCTXSearchParams(ctx, "subject_id") as SubjectID;
  const episodeID = //
    tryExtractNumberFromCTXSearchParams(ctx, "episode_id") as EpisodeID;

  if (!subjectID || !episodeID) {
    ctx.response.body = stringifyResponseForAPI(
      ["error", "BAD_REQUEST", "参数有误。"],
    );
    return;
  }

  const result_ = await Queries.queryEpisodeRatings(
    Global.repo,
    ["token", ctx.state.token],
    {
      claimedUserID,
      subjectID,
      episodeID,
      compatibility: { noPublicRatings: true },
    },
  ) as APIResponse<GetEpisodeRatingsResponseData__Until_0_3_0>;

  const result = match(result_)
    .returnType<
      APIResponse<
        | GetEpisodeRatingsResponseData__Until_0_3_0
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

router.get("/my-episode-rating", async (ctx) => {
  const claimedUserID = //
    tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id") as UserID;
  const subjectID = //
    tryExtractNumberFromCTXSearchParams(ctx, "subject_id") as SubjectID;
  const episodeID = //
    tryExtractNumberFromCTXSearchParams(ctx, "episode_id") as EpisodeID;

  if (!subjectID || !episodeID) {
    ctx.response.body = stringifyResponseForAPI(
      ["error", "BAD_REQUEST", "参数有误。"],
    );
    return;
  }

  const result = await Queries.queryEpisodeMyRating(
    Global.repo,
    ["token", ctx.state.token],
    { claimedUserID, subjectID, episodeID },
  );

  ctx.response.body = stringifyResponseForAPI(result);
});
