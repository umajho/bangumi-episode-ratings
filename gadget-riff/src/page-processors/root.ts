import type { AppClient } from "../clients/app-client";
import type { EpisodeId, SubjectId } from "../definitions";
import { processCluetip } from "../element-processors/cluetip";
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";

export async function processRootPage(opts: {
  appClient: AppClient;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;
}) {
  const { initializeCluetip } = processCluetip(opts);

  let isMouseOver = false;
  for (const liEl of document.querySelectorAll("ul.prg_list > li")) {
    if (!liEl.querySelector(".load-epinfo")) continue;

    liEl.addEventListener("mouseover", () => {
      if (isMouseOver) return;
      isMouseOver = true;

      const aEl = liEl.querySelector("a");
      if (!aEl) return;

      const subjectId = Number(aEl.getAttribute("subject_id")) as SubjectId;
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

      initializeCluetip({
        appClient: opts.appClient,
        subjectId,
        episodeId,
      });
    });

    liEl.addEventListener("mouseout", () => {
      isMouseOver = false;
    });
  }
}
