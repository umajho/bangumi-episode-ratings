import { version } from "../package.json";

import { Client } from "./client";
import env from "./env";
import { Watched } from "./utils";

const global: ReturnType<typeof makeGlobal> = {} as any;
export default global;

export function initializeGlobal() {
  Object.assign(global, makeGlobal());
}

function makeGlobal() {
  const { subjectID, episodeID } = (() => {
    let subjectID: number | null = null;
    let episodeID: number | null = null;

    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (pathParts[0] === "subject") {
      subjectID = Number(pathParts[1]);
    } else if (pathParts.length === 2 && pathParts[0] === "ep") {
      episodeID = Number(pathParts[1]);

      const subjectHref = $("#headerSubject > .nameSingle > a").attr("href")!;
      subjectID = Number(subjectHref.split("/")[2]);
    }

    return { subjectID, episodeID };
  })();

  const claimedUserID: number | null = (() => {
    if ("unsafeWindow" in window) {
      return (window as any).unsafeWindow.CHOBITS_UID || null;
    }
    return (window as any).CHOBITS_UID || null;
  })();

  if (claimedUserID === null) {
    localStorage.removeItem(env.LOCAL_STORAGE_KEY_TOKEN);
  }

  const token = new Watched<string | null>(
    localStorage.getItem(env.LOCAL_STORAGE_KEY_TOKEN),
  );

  window.addEventListener("storage", (ev) => {
    if (ev.key !== env.LOCAL_STORAGE_KEY_TOKEN) return;
    if (ev.newValue === token.getValueOnce()) return;

    token.setValue(ev.newValue);
  });

  const client = new Client({
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

  return {
    version,
    subjectID,
    episodeID,
    claimedUserID,
    token,
    client,
  };
}
