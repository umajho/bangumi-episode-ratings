import { Repo } from "./repo/mod.ts";
import { BangumiClient } from "./bangumi-client.ts";

export const repo = await Repo.open();
export const bangumiClient = new BangumiClient();
