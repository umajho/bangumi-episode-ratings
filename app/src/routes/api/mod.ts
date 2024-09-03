import { Hono } from "jsr:@hono/hono";

import * as Middlewares from "../../middlewares/mod.ts";
import { respondForAPI } from "../../responding.tsx";
import config from "../../config.ts";

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
    const gadgetURL = new URL(
      "/dev/app/3263",
      ctx.var.referrerHostname ??
        `https://${config.bangumi.VALID_HOSTNAMES[0]}`,
    );

    return respondForAPI(ctx, [
      "error",
      "VERSION_TOO_OLD",
      `版本过旧，需要更新。（现已上架为超合金组件：<${gadgetURL}>）`,
    ]);
  },
);
