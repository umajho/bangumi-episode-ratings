import { Client } from "./client";
import env from "./env";
import { Watched } from "./utils";

export const token = new Watched<string | null>(
  localStorage.getItem(env.LOCAL_STORAGE_KEY_TOKEN),
);

export const client = new Client({
  entrypoint: env.APP_ENTRYPOINT,
  token: token.getValueOnce(),
});

token.watchDeferred((newToken) => {
  if (newToken) {
    localStorage.setItem(env.LOCAL_STORAGE_KEY_TOKEN, newToken);
  } else {
    localStorage.removeItem(env.LOCAL_STORAGE_KEY_TOKEN);
  }

  client.token = newToken;
});
