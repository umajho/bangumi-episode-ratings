import { Router } from "jsr:@oak/oak@14/router";

import { State } from "../../types.ts";

import apiDevRouter from "./dev/mod.ts";
import apiV0Router from "./v0/mod.ts";

export const router = new Router<State>();
export default router;

router.use("/dev", apiDevRouter.routes(), apiDevRouter.allowedMethods());
router.use("/v0", apiV0Router.routes(), apiV0Router.allowedMethods());
