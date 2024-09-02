import { Hono } from "jsr:@hono/hono";

import * as Middlewares from "../../../../middlewares/mod.ts";
import { EpisodeID, SubjectID } from "../../../../types.ts";
import { tryExtractNumberFromCTXParams } from "../../utils.ts";
import { respondForAPI } from "../../../../responding.tsx";
import * as Commands from "../../../../operations/commands.ts";
import * as Queries from "../../../../operations/queries.ts";
import { RateEpisodeRequestData__V1 } from "../../../../shared/dto.ts";
import * as Global from "../../../../global.ts";

export const router = new Hono();
export default router;

router.get(
  "/ratings",
  Middlewares.auth(),
  Middlewares.claimedUserID(),
  Middlewares.gadgetVersion(),
  async (ctx) => {
    const claimedUserID = ctx.var.claimedUserID;
    const subjectID = //
      tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

    if (subjectID === null || episodeID === null) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Queries.queryEpisodeRatings(
      Global.repo,
      ["token", ctx.var.token],
      {
        claimedUserID,
        subjectID,
        episodeID,
        compatibility: {
          noPublicRatings: (ctx.var.gadgetVersion ?? 0) < 3_000, // < 0.3.0
        },
      },
    );

    return respondForAPI(ctx, result);
  },
);

router.get(
  "/ratings/mine",
  Middlewares.auth(),
  Middlewares.claimedUserID(),
  async (ctx) => {
    const claimedUserID = ctx.var.claimedUserID;
    const subjectID = //
      tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

    if (subjectID === null || episodeID === null || claimedUserID === null) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Queries.queryEpisodeMyRating(
      Global.repo,
      ["token", ctx.var.token],
      { claimedUserID, subjectID, episodeID },
    );

    return respondForAPI(ctx, result);
  },
);

router.put(
  "/ratings/mine",
  Middlewares.auth(),
  Middlewares.claimedUserID(),
  async (ctx) => {
    const claimedUserID = ctx.var.claimedUserID;
    const subjectID = //
      tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

    const data = await ctx.req.json() as RateEpisodeRequestData__V1;

    if (
      subjectID === null || episodeID === null || claimedUserID === null ||
      // 更具体的判断是否为整数、是否为 1~10 由 `Commands.rateEpisode` 处理。
      typeof data.score !== "number"
    ) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Commands.rateEpisode(
      Global.repo,
      Global.bangumiClient,
      ["token", ctx.var.token],
      {
        claimedUserID,
        claimedSubjectID: subjectID,
        episodeID,
        score: data.score,
      },
    );

    return respondForAPI(ctx, result);
  },
);

router.delete(
  "/ratings/mine",
  Middlewares.auth(),
  Middlewares.claimedUserID(),
  async (ctx) => {
    const claimedUserID = ctx.var.claimedUserID;
    const subjectID = //
      tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

    if (subjectID === null || episodeID === null || claimedUserID === null) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Commands.rateEpisode(
      Global.repo,
      Global.bangumiClient,
      ["token", ctx.var.token],
      {
        claimedUserID,
        claimedSubjectID: subjectID,
        episodeID,
        score: null,
      },
    );

    return respondForAPI(ctx, result);
  },
);

router.put(
  "/ratings/mine/is-visible",
  Middlewares.auth(),
  Middlewares.claimedUserID(),
  async (ctx) => {
    const claimedUserID = ctx.var.claimedUserID;
    const subjectID = //
      tryExtractNumberFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractNumberFromCTXParams(ctx, "episodeID") as EpisodeID;

    const data = await ctx.req.json() as boolean;

    if (
      subjectID === null || episodeID === null || claimedUserID === null ||
      typeof data !== "boolean"
    ) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Commands.changeUserEpisodeRatingVisibility(
      Global.repo,
      Global.bangumiClient,
      ["token", ctx.var.token],
      {
        claimedUserID,
        claimedSubjectID: subjectID,
        episodeID,
        isVisible: data,
      },
    );

    return respondForAPI(ctx, result);
  },
);
