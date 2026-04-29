import { AppClient } from "./clients/app-client";
import { processRootPage } from "./page-processors/root";
import { processSubjectPage } from "./page-processors/subject";
import {
  type AuthStore,
  createAuthStore,
} from "./stores/persistent-stores/auth-store";
import { createEntryPointStore } from "./stores/persistent-stores/entrypoint-store";
import { readonlyPageData } from "./stores/readonly-page-data";
import { createRevealedEpisodesStore } from "./stores/temporary-global-stores/revealed-episodes-store";
import { createScoreStore } from "./stores/temporary-global-stores/score-store";

async function main() {
  // 不在超展开页面执行。
  // NOTE: 在超展开页面，即使已经登录，`window.CHOBITS_UID` 也没有被定义。
  if (/^\/rakuen(\/|$)/.test(window.location.pathname)) {
    return;
  }

  const entrypointStore = createEntryPointStore({
    // TODO: 用 env 来配置。
    defaultAuthEntrypoint: "https://bgm-ep-ratings.deno.dev/auth/",
    // TODO: 用 env 来配置。
    defaultApiEntrypoint: "https://xn--kbrs5al25jbhj.bgm.zone/api/",
  });
  const authStore = createAuthStore();
  const appClient = new AppClient({ entrypointStore, authStore });

  if ((await setUpToken({ appClient, authStore })).shouldCloseWindow) {
    window.close();
    return;
  }

  const scoreStore = createScoreStore({ appClient });
  const revealedEpisodesStore = createRevealedEpisodesStore();

  switch (detectPageType()) {
    case "root": {
      await processRootPage({ appClient, scoreStore, revealedEpisodesStore });
      break;
    }
    case "subject": {
      const subjectId = readonlyPageData.subjectId;
      if (subjectId) {
        await processSubjectPage({
          appClient,
          scoreStore,
          revealedEpisodesStore,
          subjectId,
        });
      }

      break;
    }
    case "subject_ep_list": {
      // TODO
      break;
    }
    case "ep": {
      // TODO
      break;
    }
    default:
      // no-op
  }
}

async function setUpToken(_opts: {
  appClient: AppClient;
  authStore: AuthStore;
}): Promise<{ shouldCloseWindow: boolean }> {
  // TODO

  return { shouldCloseWindow: false };
}

type BANGUMI_PAGE_TYPE = "root" | "subject" | "subject_ep_list" | "ep";

function detectPageType(): BANGUMI_PAGE_TYPE | null {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (!pathParts.length) {
    return "root";
  } else if (pathParts.length === 2 && pathParts[0] === "subject") {
    return "subject";
  } else if (
    pathParts.length === 3 &&
    pathParts[0] === "subject" && pathParts[2] === "ep"
  ) {
    return "subject_ep_list";
  } else if (pathParts.length === 2 && pathParts[0] === "ep") {
    return "ep";
  } else {
    return null;
  }
}

main();
