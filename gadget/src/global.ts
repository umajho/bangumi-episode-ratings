import { createEffect, createSignal, on } from "solid-js";

import { Client } from "./client";
import env from "./env";

export const client = new Client({
  entrypoint: env.APP_ENTRYPOINT,
  token: localStorage.getItem(env.LOCAL_STORAGE_KEY_TOKEN),
});

export const [token, setToken] = createSignal(client.token);
createEffect(on([token], ([token]) => {
  if (token) {
    localStorage.setItem(env.LOCAL_STORAGE_KEY_TOKEN, token);
  } else {
    localStorage.removeItem(env.LOCAL_STORAGE_KEY_TOKEN);
  }

  client.token = token;
}, { defer: true }));
