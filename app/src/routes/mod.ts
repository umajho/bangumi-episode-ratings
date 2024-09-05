import { match, P } from "npm:ts-pattern";
import { Context, Hono } from "jsr:@hono/hono";

import config from "@/config.ts";

import authRouter from "./auth/mod.ts";
import apiRouter from "./api/mod.ts";
import { respondForAPI } from "@/responding.tsx";

export const router = new Hono();
export default router;

router.get(
  "/",
  (ctx) => ctx.redirect(config.bangumi.URL_HOMEPAGE.toString()),
);

match(config.app.AUTH_ROUTE_MODE)
  .with(["normal"], () => router.route("/auth", authRouter))
  .with(["off"], () => {})
  .exhaustive();

match(config.app.API_ROUTE_MODE)
  .with(["normal"], () => router.route("/api", apiRouter))
  .with(
    ["maintenance", P.select()],
    (message) => router.all("/api/*", createMaintenanceHandler(message)),
  )
  .with(["forward", P.select()], (newEntryPoint) => {
    router.all(
      "/api/*",
      createForwardHandler(
        (path) => new URL(path.slice("/api/".length), newEntryPoint),
      ),
    );
  })
  .exhaustive();

function createMaintenanceHandler(message: string) {
  return (ctx: Context) =>
    respondForAPI(ctx, [
      "error",
      "MAINTAINING",
      "单集评分功能维护中：" + message,
    ]);
}

function createForwardHandler(urlRewriter: (path: string) => URL) {
  return async (ctx: Context) => {
    const newURL = urlRewriter(ctx.req.path);
    const newReq = new Request(newURL, ctx.req.raw);
    const resp = await fetch(newReq);
    return new Response(resp.body, resp);
  };
}
