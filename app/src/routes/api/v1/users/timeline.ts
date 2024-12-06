import { Hono } from "jsr:@hono/hono";

import * as Middlewares from "@/middlewares/mod.ts";
import {
  tryExtractIntegerFromCTXParams,
  tryExtractIntegerFromCTXSearchParams,
  tryExtractUserIDOrMeFromCTXParams,
} from "@/routes/api/utils.ts";
import { respondForAPI } from "@/responding.tsx";
import * as Commands from "@/operations/commands.ts";
import * as Queries from "@/operations/queries.ts";
import * as Global from "@/global.ts";

export const router = new Hono();
export default router;

router.get(
  "items",
  Middlewares.auth(),
  async (ctx) => {
    const userIDOrMe = tryExtractUserIDOrMeFromCTXParams(ctx, "userIDOrMe");
    const offset = tryExtractIntegerFromCTXSearchParams(ctx, "offset") ?? 0;
    const limit = tryExtractIntegerFromCTXSearchParams(ctx, "limit");

    if (
      userIDOrMe !== "me" || limit !== 10 || (offset % 10 !== 0) || offset > 90
    ) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Queries.queryUserTimeLineItems(
      Global.repo,
      await ctx.var.authenticate(Global.repo),
      { offset, limit },
    );

    return respondForAPI(ctx, result);
  },
);

router.delete(
  "items/:timestampMs",
  Middlewares.auth(),
  async (ctx) => {
    const userIDOrMe = tryExtractUserIDOrMeFromCTXParams(ctx, "userIDOrMe");
    const timestampMs = tryExtractIntegerFromCTXParams(
      ctx,
      "timestampMs",
    );

    if (userIDOrMe !== "me" || timestampMs === null) {
      return respondForAPI(ctx, ["error", "BAD_REQUEST", "参数有误。"]);
    }

    const result = await Commands.deleteUserTimeLineItem(
      Global.repo,
      await ctx.var.authenticate(Global.repo),
      { timestampMs },
    );

    return respondForAPI(ctx, result);
  },
);
