import { Router } from "jsr:@oak/oak@14";

import { StateForAPI } from "../../../types.ts";

import subjectsRouter from "./subjects/mod.ts";

export const router = new Router<StateForAPI>();
export default router;

router.use(
  "/subjects/:subjectID",
  subjectsRouter.routes(),
  subjectsRouter.allowedMethods(),
);
