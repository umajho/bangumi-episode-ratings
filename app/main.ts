import { Application } from "jsr:@oak/oak@14";

import env from "./src/env.ts";
import { State } from "./src/types.ts";
import router from "./src/routes/mod.ts";
import * as Middlewares from "./src/middlewares/mod.ts";

const app = new Application<State>();

app.use(Middlewares.headers());
app.use(Middlewares.referrer());
app.use(Middlewares.auth());
app.use(Middlewares.cors());

app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: env.PORT });
