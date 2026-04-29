import type { AppClient } from "../clients/app-client";
import type { SubjectId } from "../definitions";
import { processCluetip } from "../element-processors/cluetip";
import { processPrgList } from "../element-processors/prg-list";
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";

export async function processSubjectPage(opts: {
  appClient: AppClient;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
}) {
  const { initializeCluetip } = processCluetip(opts);

  const prgListEl = document.querySelector("ul.prg_list");
  if (!prgListEl) return;

  processPrgList({
    appClient: opts.appClient,
    scoreStore: opts.scoreStore,
    revealedEpisodesStore: opts.revealedEpisodesStore,
    initializeCluetip,
    prgListElement: prgListEl as HTMLUListElement,
    subjectId: opts.subjectId,
  });
}
