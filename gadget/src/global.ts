import { Client } from "./client";
import env from "./env";
import { Watched } from "./utils";

export const { subjectID, episodeID } = (() => {
  let subjectID: number | null = null;
  let episodeID: number | null = null;

  if (location.pathname.startsWith("/subject/")) {
    subjectID = Number(location.pathname.split("/")[2]);
  } else if (location.pathname.startsWith("/ep/")) {
    episodeID = Number(location.pathname.split("/")[2]);

    const subjectHref = $("#headerSubject > .nameSingle > a").attr("href")!;
    subjectID = Number(subjectHref.split("/")[2]);
  }

  return { subjectID, episodeID };
})();

export const claimedUserID: number | null = (() => {
  if ("unsafeWindow" in window) {
    return (window as any).unsafeWindow.CHOBITS_UID || null;
  }
  return (window as any).CHOBITS_UID || null;
})();

if (!claimedUserID === null) {
  localStorage.removeItem(env.LOCAL_STORAGE_KEY_TOKEN);
}

export const token = new Watched<string | null>(
  localStorage.getItem(env.LOCAL_STORAGE_KEY_TOKEN),
);

window.addEventListener("storage", (ev) => {
  if (ev.key !== env.LOCAL_STORAGE_KEY_TOKEN) return;
  if (ev.newValue === token.getValueOnce()) return;

  token.setValue(ev.newValue);
});

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
