import type { AppClient } from "../clients/app-client";
import type { EpisodeId, SubjectId } from "../definitions";
import { processCluetip } from "../element-processors/cluetip";
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";

export function processPrgList(opts: {
  appClient: AppClient;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;
  initializeCluetip: ReturnType<typeof processCluetip>["initializeCluetip"];

  prgListElement: HTMLUListElement;
  subjectId: SubjectId;
}) {
  let isMouseOver = false;
  for (const liEl of opts.prgListElement.querySelectorAll(":scope > li")) {
    if (!liEl.querySelector(".load-epinfo")) continue;

    liEl.addEventListener("mouseover", () => {
      if (isMouseOver) return;
      isMouseOver = true;

      const aEl = liEl.querySelector("a");
      if (!aEl) return;

      const episodeId = (() => {
        const href = aEl.getAttribute("href");
        if (!href) return;
        const match = href.match(/^\/ep\/(\d+)/);
        if (!match) return;
        return Number(match[1]) as EpisodeId;
      })();
      if (episodeId === undefined) return;

      const hasUserWatched = aEl.classList.contains("epBtnWatched");
      if (hasUserWatched) {
        opts.revealedEpisodesStore.reveal(episodeId);
      }

      opts.initializeCluetip({
        appClient: opts.appClient,
        subjectId: opts.subjectId,
        episodeId,
      });
    });

    liEl.addEventListener("mouseout", () => {
      isMouseOver = false;
    });
  }
}
