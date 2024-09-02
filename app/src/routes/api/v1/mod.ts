import { Hono } from "jsr:@hono/hono";

import subjectsRouter from "./subjects/mod.ts";

export const router = new Hono();
export default router;

router.route("/subjects/:subjectID", subjectsRouter);
