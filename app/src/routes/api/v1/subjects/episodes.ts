import { Router, RouterContext } from "jsr:@oak/oak@14";

import { EpisodeID, StateForAPI, SubjectID } from "../../../../types.ts";
import { tryExtractNumberFromCTXParams } from "../../utils.ts";
import { stringifyResponseForAPI } from "../../../../responses.tsx";
import * as Commands from "../../../../operations/commands.ts";
import * as Queries from "../../../../operations/queries.ts";
import { RateEpisodeRequestData__V1 } from "../../../../shared/dto.ts";

export const router = new Router<StateForAPI>();
export default router;

router.get("/ratings", handleGetEpisodeRatings);
router.get("/ratings/mine", handleGetEpisodeRatingOfMine);
router.put("/ratings/mine", handlePutEpisodeRatingOfMine);
router.delete("/ratings/mine", handleDeleteEpisodeRatingOfMine);
router.put("/ratings/mine/is-visible", handlePutIsVisibleOfEpisodeRatingOfMine);

async function handleGetEpisodeRatings(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, StateForAPI>,
) {
  const claimedUserID = ctx.state.claimedUserID;
  const subjectID = //
    tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
  const episodeID = //
    tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

  if (subjectID === null || episodeID === null) {
    ctx.response.body = stringifyResponseForAPI(
      ["error", "BAD_REQUEST", "参数有误。"],
    );
    return;
  }

  const kv = await Deno.openKv();

  const result = await Queries.queryEpisodeRatings(
    kv,
    ["token", ctx.state.token],
    {
      claimedUserID,
      subjectID,
      episodeID,
      compatibility: {
        noPublicRatings: (ctx.state.gadgetVersion ?? 0) < 3_000, // < 0.3.0
      },
    },
  );

  ctx.response.body = stringifyResponseForAPI(result);
}

async function handleGetEpisodeRatingOfMine(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, StateForAPI>,
) {
  const claimedUserID = ctx.state.claimedUserID;
  const subjectID = //
    tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
  const episodeID = //
    tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

  if (subjectID === null || episodeID === null || claimedUserID === null) {
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
}
async function handlePutEpisodeRatingOfMine(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, StateForAPI>,
) {
  const claimedUserID = ctx.state.claimedUserID;
  const subjectID = //
    tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
  const episodeID = //
    tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

  const data = await ctx.request.body.json() as RateEpisodeRequestData__V1;

  if (
    subjectID === null || episodeID === null || claimedUserID === null ||
    // 更具体的判断是否为整数、是否为 1~10 由 `Commands.rateEpisode` 处理。
    typeof data.score !== "number"
  ) {
    ctx.response.body = stringifyResponseForAPI(
      ["error", "BAD_REQUEST", "参数有误。"],
    );
    return;
  }

  const kv = await Deno.openKv();

  const result = await Commands.rateEpisode(kv, ["token", ctx.state.token], {
    claimedUserID,
    claimedSubjectID: subjectID,
    episodeID,
    score: data.score,
  });

  ctx.response.body = stringifyResponseForAPI(result);
}
async function handleDeleteEpisodeRatingOfMine(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, StateForAPI>,
) {
  const claimedUserID = ctx.state.claimedUserID;
  const subjectID = //
    tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
  const episodeID = //
    tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

  if (subjectID === null || episodeID === null || claimedUserID === null) {
    ctx.response.body = stringifyResponseForAPI(
      ["error", "BAD_REQUEST", "参数有误。"],
    );
    return;
  }

  const kv = await Deno.openKv();

  const result = await Commands.rateEpisode(kv, ["token", ctx.state.token], {
    claimedUserID,
    claimedSubjectID: subjectID,
    episodeID,
    score: null,
  });

  ctx.response.body = stringifyResponseForAPI(result);
}

async function handlePutIsVisibleOfEpisodeRatingOfMine(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, StateForAPI>,
) {
  const claimedUserID = ctx.state.claimedUserID;
  const subjectID = //
    tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
  const episodeID = //
    tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

  const data = await ctx.request.body.json() as boolean;

  if (
    subjectID === null || episodeID === null || claimedUserID === null ||
    typeof data !== "boolean"
  ) {
    ctx.response.body = stringifyResponseForAPI(
      ["error", "BAD_REQUEST", "参数有误。"],
    );
    return;
  }

  const kv = await Deno.openKv();

  const result = await Commands.changeUserEpisodeRatingVisibility(kv, [
    "token",
    ctx.state.token,
  ], {
    claimedUserID,
    claimedSubjectID: subjectID,
    episodeID,
    isVisible: data,
  });

  ctx.response.body = stringifyResponseForAPI(result);
}
