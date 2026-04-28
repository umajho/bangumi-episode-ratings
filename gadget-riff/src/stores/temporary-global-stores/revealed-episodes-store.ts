import { createStore } from "solid-js/store";
import type { EpisodeId } from "../../definitions";

export type RevealedEpisodesStore = //
  ReturnType<typeof createRevealedEpisodesStore>;

export function createRevealedEpisodesStore() {
  const [store, setStore] = createStore<{ [id in EpisodeId]?: boolean }>({});

  function reveal(episodeId: EpisodeId) {
    setStore(episodeId, true);
  }

  function getIsRevealedSignal(episodeId: EpisodeId) {
    return () => !!store[episodeId];
  }

  return { reveal, getIsRevealedSignal };
}
