import { Hono } from "hono";

import * as Middlewares from "@/middlewares/mod.ts";
import {
  makeErrorVersionTooOldResponse,
  respondForAPI,
} from "@/responding.tsx";

import apiV1Router from "./v1/mod.ts";

export const router = new Hono();
export default router;

router.use(Middlewares.setIsForAPI());

router.route("/v1", apiV1Router);

router.all(
  "/v0/*",
  Middlewares.referrers(),
  // deno-lint-ignore require-await
  async (ctx) => {
    return respondForAPI(
      ctx,
      makeErrorVersionTooOldResponse(ctx.var.referrerHostname),
    );
  },
);
