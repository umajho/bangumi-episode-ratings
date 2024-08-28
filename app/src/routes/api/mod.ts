import { Router } from "jsr:@oak/oak@14/router";

import { StateForAPI } from "../../types.ts";

import apiV0Router from "./v0/mod.ts";
import apiV1Router from "./v1/mod.ts";

export const router = new Router<StateForAPI>();
export default router;

router.use("/v0", apiV0Router.routes(), apiV0Router.allowedMethods());
router.use("/v1", apiV1Router.routes(), apiV1Router.allowedMethods());
