import {
  type Accessor,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  runWithOwner,
  untrack,
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
  const antiSpoilerForMusicSetting = settingsStore
    .getAntiSpoilerForMusicSignal();

  function reveal(episodeId: EpisodeId) {
    if (untrack(() => !store[episodeId])) {
      setStore(episodeId, true);
    }
  }

  function revealAll() {
    setAreAllRevealed(true);
  }

  const isRevealedMemo: Record<EpisodeId, Accessor<boolean>> = {};
  function getIsRevealedAccessor(
    episodeId: EpisodeId,
    opts: { isMusic: boolean },
  ) {
    return isRevealedMemo[episodeId] ??= runWithOwner(
      owner,
      () =>
        createMemo(() => {
          if (opts.isMusic) {
            if (antiSpoilerForMusicSetting() === "off") return true;
          } else {
            if (antiSpoilerSetting() === "off") return true;
          }

          if (areAllRevealed()) return true;
          return !!store[episodeId];
        }),
    )!;
  }

  return { reveal, revealAll, getIsRevealedAccessor };
}
