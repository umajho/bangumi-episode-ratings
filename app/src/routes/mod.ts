import { Hono } from "jsr:@hono/hono";

import env from "../env.ts";

import authRouter from "./auth/mod.ts";
import apiRouter from "./api/mod.ts";

export const router = new Hono();
export default router;

// deno-lint-ignore require-await
router.get("/", async (ctx) => {
  ctx.redirect(env.BGM_HOMEPAGE);
});

router.route("/auth", authRouter);
router.route("/api", apiRouter);
