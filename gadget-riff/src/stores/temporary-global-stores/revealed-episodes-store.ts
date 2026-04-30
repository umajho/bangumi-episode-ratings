import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";

import type { EpisodeId } from "../../definitions";
import type { SettingsStore } from "../persistent-stores/settings-store";

export type RevealedEpisodesStore = //
  ReturnType<typeof createRevealedEpisodesStore>;

export function createRevealedEpisodesStore({ settingsStore }: {
  settingsStore: SettingsStore;
}) {
  const [store, setStore] = createStore<{ [id in EpisodeId]?: boolean }>({});
  const [areAllRevealed, setAreAllRevealed] = createSignal(false);

  const antiSpoilerSetting = settingsStore.getAntiSpoilerSignal();

  function reveal(episodeId: EpisodeId) {
    setStore(episodeId, true);
  }

  function revealAll() {
    setAreAllRevealed(true);
  }

  function getIsRevealedSignal(episodeId: EpisodeId) {
    return () => {
      if (antiSpoilerSetting() === "off") return true;
      if (areAllRevealed()) return true;
      return !!store[episodeId];
    };
  }

  return { reveal, revealAll, getIsRevealedSignal };
}
