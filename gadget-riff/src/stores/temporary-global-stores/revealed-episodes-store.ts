import {
  type Accessor,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  runWithOwner,
} from "solid-js";
import { createStore } from "solid-js/store";

import type { EpisodeId } from "../../definitions";
import type { SettingsStore } from "../persistent-stores/settings-store";

export type RevealedEpisodesStore = //
  ReturnType<typeof createRevealedEpisodesStore>;

export function createRevealedEpisodesStore({ settingsStore }: {
  settingsStore: SettingsStore;
}) {
  const owner = createRoot(() => getOwner()!);

  const [store, setStore] = createStore<{ [id in EpisodeId]?: boolean }>({});
  const [areAllRevealed, setAreAllRevealed] = createSignal(false);

  const antiSpoilerSetting = settingsStore.getAntiSpoilerSignal();

  function reveal(episodeId: EpisodeId) {
    setStore(episodeId, true);
  }

  function revealAll() {
    setAreAllRevealed(true);
  }

  const isRevealedMemo: Record<EpisodeId, Accessor<boolean>> = {};
  function getIsRevealedAccessor(episodeId: EpisodeId) {
    return isRevealedMemo[episodeId] ??= runWithOwner(
      owner,
      () =>
        createMemo(() => {
          if (antiSpoilerSetting() === "off") return true;
          if (areAllRevealed()) return true;
          return !!store[episodeId];
        }),
    )!;
  }

  return { reveal, revealAll, getIsRevealedAccessor };
}
