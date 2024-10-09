import { Hono } from "jsr:@hono/hono";

import subjectsRouter from "./subjects/mod.ts";
import usersRouter from "./users/mod.ts";

export const router = new Hono();
export default router;

router.route("/subjects/:subjectID", subjectsRouter);
router.route("/users/:userIDOrMe", usersRouter);
