import { Hono } from "jsr:@hono/hono";

import timelineRouter from "./timeline.ts";

export const router = new Hono();
export default router;

router.route("/timeline", timelineRouter);
