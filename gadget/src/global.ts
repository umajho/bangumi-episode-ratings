import { version } from "../package.json";
import { BangumiClient } from "./bangumi-client";

import { Client } from "./client";
import env from "./env";
import { Watched } from "./utils/watched";

const global: ReturnType<typeof makeGlobal> = {} as any;
export default global;

export function initializeGlobal() {
  Object.assign(global, makeGlobal());

  // @ts-ignore
  (((window as any).unsafeWindow ?? window).__bgm_ep_ratings__debug ??= {})
    .Global = global;
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

  const meAEl = $("#dock .content .first > a");
  const claimedUserTextID = meAEl.attr("href")?.split("/")?.at(-1) ?? null;
  const claimedUserName = meAEl.text().trim() ?? null;

  const token = new Watched<string | null>(
    localStorage.getItem(env.LOCAL_STORAGE_KEY_TOKEN),
  );

  window.addEventListener("storage", (ev) => {
    if (ev.key !== env.LOCAL_STORAGE_KEY_TOKEN) return;
    if (ev.newValue === token.getValueOnce()) return;

    token.setValue(ev.newValue);
  });

  const client = new Client({
    authEntrypoint: env.APP_AUTH_ENTRYPOINT,
    apiEntrypoint: env.APP_API_ENTRYPOINT,
    token: token.getValueOnce(),
  });

  const bangumiClient = new BangumiClient();

  token.watchDeferred((newToken) => {
    if (newToken) {
      localStorage.setItem(env.LOCAL_STORAGE_KEY_TOKEN, newToken);
    } else {
      localStorage.removeItem(env.LOCAL_STORAGE_KEY_TOKEN);
      localStorage.removeItem(env.LOCAL_STORAGE_KEY_JWT);
    }

    client.token = newToken;
    client.clearCache();
  });

  // 不用第三方包，响应式状态管理太麻烦了，摆了。
  // 下面这个变量只在章节页面有效。
  const currentEpisodeVisibilityFromServer = //
    new Watched<{ isVisible: boolean } | null>(null, {
      broadcastID: `bgm_ep_ratings::broadcasts::${episodeID}::visibility`,
    });
  function updateCurrentEpisodeVisibilityFromServerRaw(
    raw: { is_visible: boolean } | null | undefined,
  ) {
    if (!raw) {
      currentEpisodeVisibilityFromServer.setValue(null);
    } else {
      currentEpisodeVisibilityFromServer.setValue({
        isVisible: raw.is_visible,
      });
    }
  }

  return {
    version,
    subjectID,
    episodeID,
    claimedUserID,
    claimedUserTextID,
    claimedUserName,
    token,
    client,
    bangumiClient,

    currentEpisodeVisibilityFromServer,
    updateCurrentEpisodeVisibilityFromServerRaw,
  };
}
