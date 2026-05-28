import type { AppClient } from "../clients/app-client";
import { createEpisodeOverviewInstance } from "../components/EpisodeOverview";
import type { EpisodeId, SubjectId } from "../definitions";
import type { AuthStore } from "../stores/persistent-stores/auth-store";
import type { SettingsStore } from "../stores/persistent-stores/settings-store";
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";
import { createClearDivElement } from "../utils/elements";

export async function processEpPage(opts: {
  settingsStore: SettingsStore;
  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
}) {
  const columnEpAEl = document.querySelector("#columnEpA");
  const epDescEl = columnEpAEl?.querySelector(":scope > .epDesc");
  if (!columnEpAEl || !epDescEl) return;

  {
    const episodeOverviewInstance = createEpisodeOverviewInstance({
      settingsStore: opts.settingsStore,
      appClient: opts.appClient,
      authStore: opts.authStore,
      scoreStore: opts.scoreStore,
      revealedEpisodesStore: opts.revealedEpisodesStore,
      subjectId: opts.subjectId,
      episodeId: opts.episodeId,
    });
    columnEpAEl.prepend(episodeOverviewInstance.element);

    epDescEl.insertAdjacentElement("afterend", createClearDivElement());
  }
}
