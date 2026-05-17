import type { AppClient } from "../clients/app-client";
import type { SubjectId } from "../definitions";
import { processCluetip } from "../element-processors/cluetip";
import { processPrgList } from "../element-processors/prg-list";
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";

export function processRootPage(opts: {
  appClient: AppClient;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;
}) {
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
}
