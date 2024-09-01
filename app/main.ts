import { Application } from "jsr:@oak/oak@14";

import env from "./src/env.ts";
import { State } from "./src/types.ts";
import router from "./src/routes/mod.ts";
import * as Middlewares from "./src/middlewares/mod.ts";
import { Repo } from "./src/repo/mod.ts";
import { BangumiClient } from "./src/bangumi-client.ts";

const app = new Application<State>({
  state: {
    repo: await Repo.open(),
    bangumiClient: new BangumiClient(),
  } as State,
});

app.use(Middlewares.headers());
app.use(Middlewares.referrer());
app.use(Middlewares.auth());
app.use(Middlewares.cors());

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: env.PORT });
