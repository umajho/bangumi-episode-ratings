import { Hono } from "hono";

import * as Middlewares from "@/middlewares/mod.ts";
import { EpisodeID, SubjectID } from "@/types.ts";
import { respondForAPI } from "@/responding.tsx";
import * as Commands from "@/operations/commands.ts";
import * as Queries from "@/operations/queries.ts";
import { RateEpisodeRequestData__V1 } from "@/shared/dto.ts";
import * as Global from "@/global.ts";

import { tryExtractIntegerFromCTXParams } from "@/routes/api/utils.ts";

export const router = new Hono();
export default router;

router.get(
  "/ratings",
  Middlewares.auth(),
  Middlewares.gadgetVersion(),
  async (ctx) => {
    const subjectID = //
      tryExtractIntegerFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractIntegerFromCTXParams(ctx, "episodeID") as EpisodeID;

    if (subjectID === null || episodeID === null) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Queries.queryEpisodeRatings(
      Global.repo,
      await ctx.var.authenticate(Global.repo),
      {
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
  async (ctx) => {
    const subjectID = //
      tryExtractIntegerFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractIntegerFromCTXParams(ctx, "episodeID") as EpisodeID;

    if (subjectID === null || episodeID === null) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Queries.queryEpisodeMyRating(
      Global.repo,
      await ctx.var.authenticate(Global.repo),
      { subjectID, episodeID },
    );

    return respondForAPI(ctx, result);
  },
);

router.put(
  "/ratings/mine",
  Middlewares.auth(),
  async (ctx) => {
    const subjectID = //
      tryExtractIntegerFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractIntegerFromCTXParams(ctx, "episodeID") as EpisodeID;

    const data = await ctx.req.json() as RateEpisodeRequestData__V1;

    if (
      subjectID === null || episodeID === null ||
      // 更具体的判断是否为整数、是否为 1~10 由 `Commands.rateEpisode` 处理。
      typeof data.score !== "number"
    ) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Commands.rateEpisode(
      Global.repo,
      Global.bangumiClient,
      await ctx.var.authenticate(Global.repo),
      { claimedSubjectID: subjectID, episodeID, score: data.score },
    );

    return respondForAPI(ctx, result);
  },
);

router.delete(
  "/ratings/mine",
  Middlewares.auth(),
  async (ctx) => {
    const subjectID = //
      tryExtractIntegerFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractIntegerFromCTXParams(ctx, "episodeID") as EpisodeID;

    if (subjectID === null || episodeID === null) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Commands.rateEpisode(
      Global.repo,
      Global.bangumiClient,
      await ctx.var.authenticate(Global.repo),
      { claimedSubjectID: subjectID, episodeID, score: null },
    );

    return respondForAPI(ctx, result);
  },
);

router.put(
  "/ratings/mine/is-visible",
  Middlewares.auth(),
  async (ctx) => {
    const subjectID = //
      tryExtractIntegerFromCTXParams(ctx, "subjectID") as SubjectID;
    const episodeID = //
      tryExtractIntegerFromCTXParams(ctx, "episodeID") as EpisodeID;

    const data = await ctx.req.json() as boolean;

    if (
      subjectID === null || episodeID === null ||
      typeof data !== "boolean"
    ) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Commands.changeUserEpisodeRatingVisibility(
      Global.repo,
      Global.bangumiClient,
      await ctx.var.authenticate(Global.repo),
      { claimedSubjectID: subjectID, episodeID, isVisible: data },
    );

    return respondForAPI(ctx, result);
  },
);
