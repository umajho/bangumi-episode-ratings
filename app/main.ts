import { Hono } from "jsr:@hono/hono";
import { logger } from "jsr:@hono/hono/logger";
import { cors } from "jsr:@hono/hono/cors";
import { compress } from "jsr:@hono/hono/compress";

import env from "./src/env.ts";
import router from "./src/routes/mod.ts";

const app = new Hono();

app.use(logger());
app.use(cors({
  origin: env.VALID_BGM_HOSTNAMES.map((hostname) => `https://${hostname}`),
  allowHeaders: ["Authorization", "X-Gadget-Version", "X-Claimed-User-ID"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
}));
app.use(compress());

app.route("/", router);

Deno.serve(app.fetch);
