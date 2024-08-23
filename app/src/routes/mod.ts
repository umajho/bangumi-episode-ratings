import { Router } from "jsr:@oak/oak@14/router";

import { State } from "../types.ts";
import env from "../env.ts";

import authRouter from "./auth/mod.ts";
import apiRouter from "./api/mod.ts";

export const router = new Router<State>();
export default router;

router.get("/", (ctx) => {
  ctx.response.redirect(env.BGM_HOMEPAGE);
});

router.use("/auth", authRouter.routes(), authRouter.allowedMethods());
router.use("/api", apiRouter.routes(), apiRouter.allowedMethods());
