import { Repo } from "@/repo/mod.ts";
import { BangumiClient } from "@/bangumi-client.ts";
import config from "@/config.ts";

export const repo = await Repo.open(config.app.KV_PATH ?? undefined);
export const bangumiClient = new BangumiClient();
