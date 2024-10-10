import { Hono } from "jsr:@hono/hono";

import * as Middlewares from "@/middlewares/mod.ts";
import * as Queries from "@/operations/queries.ts";
import * as Global from "@/global.ts";

import timelineRouter from "./timeline.ts";
import { respondForAPI } from "@/responding.tsx";

export const router = new Hono();
export default router;

router.route("/timeline", timelineRouter);

// TODO: 在未来，一位用户可能会包含不少单集评分的数据，到时候就要考虑缓存或限流
// 了。以 24 小时为时限之类的。
router.get(
  "/episode-ratings-data-file",
  Middlewares.auth(),
  async (ctx) => {
    const userID = await ctx.var.authenticate(Global.repo);

    const result = await Queries.queryUserEpisodeRatings(Global.repo, userID);
    if (result[0] !== "ok") {
      return respondForAPI(ctx, result);
    }
    const [_, resp] = result;

    const now = Date.now();

    let csv = "\uFEFF剧集ID,评分\n";
    for (
      const [episodeID, score] of Object.entries(resp.episode_to_score_map)
    ) {
      csv += `${episodeID},${score}\n`;
    }

    const fileName = `单集评分-${userID}-${now}.csv`;
    return respondForAPI(ctx, ["ok", { fileName, content: csv }]);
  },
);
