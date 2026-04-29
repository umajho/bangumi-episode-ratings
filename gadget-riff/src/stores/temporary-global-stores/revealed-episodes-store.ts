import { createStore } from "solid-js/store";
import type { EpisodeId } from "../../definitions";
import type { SettingsStore } from "../persistent-stores/settings-store";

export type RevealedEpisodesStore = //
  ReturnType<typeof createRevealedEpisodesStore>;

export function createRevealedEpisodesStore({ settingsStore }: {
  settingsStore: SettingsStore;
}) {
  const [store, setStore] = createStore<{ [id in EpisodeId]?: boolean }>({});

  const antiSpoilerSetting = settingsStore.getAntiSpoilerSignal();

  function reveal(episodeId: EpisodeId) {
    setStore(episodeId, true);
  }

  function getIsRevealedSignal(episodeId: EpisodeId) {
    return () => {
      if (antiSpoilerSetting() === "off") return true;

      return !!store[episodeId];
    };
  }

  return { reveal, getIsRevealedSignal };
}
