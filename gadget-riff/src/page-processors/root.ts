import { createEffect, on } from "solid-js";

import type { AppClient } from "../clients/app-client";
import { createMyTimelineContentInstance } from "../components/MyTimelineContent";
import type { SubjectId } from "../definitions";
import { processCluetip } from "../element-processors/cluetip";
import { processPrgList } from "../element-processors/prg-list";
import type { SettingsStore } from "../stores/persistent-stores/settings-store";
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";
import type { AuthStore } from "../stores/persistent-stores/auth-store";
import type { BangumiClient } from "../clients/bangumi-client";

interface ProcessOptions {
  settingsStore: SettingsStore;
  appClient: AppClient;
  bgmClient: BangumiClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;
}

export function processRootPage(opts: ProcessOptions) {
  {
    for (const epInfoEl of document.querySelectorAll(".load-epinfo")) {
      const href = epInfoEl.getAttribute("href");
      const title = epInfoEl.getAttribute("title");
      if (!href || !title) continue;

      const episodeID = Number(href.split("/").at(-1));
      const m = /^ep\.(.+?) (.+)$/.exec(title);
      if (isNaN(episodeID) || !m) continue;

      const sort = Number(m[1]);
      const name = m[2];
      if (isNaN(sort)) continue;

      opts.bgmClient.putEntryIntoEpisodeCache(episodeID, { name, sort });
    }
  }

  const { initializeCluetip } = processCluetip(opts);

  for (const prgListEl of document.querySelectorAll("ul.prg_list")) {
    const subjectId = (() => {
      const epGrid = prgListEl.closest(".epGird");
      if (!epGrid) return;
      const a = epGrid.querySelector("a[data-subject-id]");
      if (!a) return;
      return Number(a.getAttribute("data-subject-id")) as SubjectId;
    })();
    if (subjectId === undefined || Number.isNaN(subjectId)) continue;

    processPrgList({
      appClient: opts.appClient,
      scoreStore: opts.scoreStore,
      revealedEpisodesStore: opts.revealedEpisodesStore,
      initializeCluetip,
      prgListElement: prgListEl as HTMLUListElement,
      subjectId,
    });
  }

  processTimelineColumn(opts);
}

function processTimelineColumn(opts: ProcessOptions) {
  const topUl = document.querySelector("ul#timelineTabs > li:has(a.top) > ul");
  const topLi = topUl?.closest("li");
  if (!topUl || !topLi) return;

  let currentTabButtonLiEl: HTMLElement | null = null;

  function replaceTimelineContent(ev: Event) {
    ev.preventDefault();

    const containerEl = document.querySelector("#tmlContent");
    if (!containerEl) return;

    document.querySelector("#timelineTabs > li > a.focus")?.classList
      .remove("focus");
    focus();

    containerEl.innerHTML = "";

    const myTimelineContentInstance = createMyTimelineContentInstance({
      appClient: opts.appClient,
      bgmClient: opts.bgmClient,
      authStore: opts.authStore,
    });
    containerEl.appendChild(myTimelineContentInstance.element);
  }

  function focus() {
    currentTabButtonLiEl?.querySelector("a")?.classList.add("focus");
  }
  function hasFocus() {
    return currentTabButtonLiEl?.querySelector("a")?.classList
      .contains("focus");
  }

  createEffect(
    on(opts.settingsStore.getTimelineTabButtonLocationSignal(), (s) => {
      const hadFocus = hasFocus();
      currentTabButtonLiEl?.remove();
      switch (s) {
        case "more-dropdown": {
          const myTimelineTabButton = document.createElement("li");
          currentTabButtonLiEl = myTimelineTabButton;
          myTimelineTabButton.innerHTML =
            `<a href="#"><span class="ico"></span><span>我的单集评分</span></a>`;
          myTimelineTabButton.addEventListener("click", replaceTimelineContent);
          topUl.appendChild(myTimelineTabButton);

          break;
        }
        case "main-row": {
          const myTimelineTabButton = document.createElement("li");
          currentTabButtonLiEl = myTimelineTabButton;
          myTimelineTabButton.innerHTML = `<a href="#">我的单集评分</a>`;
          myTimelineTabButton.addEventListener("click", replaceTimelineContent);
          topLi.insertAdjacentElement("beforebegin", myTimelineTabButton);

          break;
        }
        default:
          s satisfies never;
      }

      if (hadFocus) {
        focus();
      }
    }),
  );
}
