import {
  type Accessor,
  batch,
  createMemo,
  createRoot,
  createSignal,
  getOwner,
  on,
  type Owner,
  runWithOwner,
  type Setter,
  untrack,
} from "solid-js";

import type {
  EpisodeData,
  EpisodeId,
  EpisodeVotes,
  MyRating,
  Score,
  SubjectData,
  SubjectId,
} from "../../definitions";
import type {
  APIResponse,
  GetSubjectEpisodesResponseData,
  RateEpisodeResponseData,
} from "../../shared/dto";
import type { AppClient } from "../../clients/app-client";
import type { AuthStore } from "../persistent-stores/auth-store";

export type ScoreStore = ReturnType<typeof createScoreStore>;

export type SubjectDataResponse =
  | APIResponse<SubjectData>
  | [tag: "loading", opts: { oldData?: SubjectData }];
export type EpisodeDataResponse =
  | APIResponse<EpisodeData>
  | [tag: "loading", opts: { oldData?: EpisodeData }]
  | [tag: "processing", opts: { oldData?: EpisodeData }];

export function createScoreStore(opts: {
  authStore: AuthStore;
  appClient: AppClient;
}) {
  const knownSubjects: { [subjectId: SubjectId]: SubjectStore } = {};

  function getKnownSubject(
    subjectId: SubjectId,
  ): { store: SubjectStore; isCached: boolean } {
    const isCached = subjectId in knownSubjects;
    const store = knownSubjects[subjectId] ??= new SubjectStore();
    return { store, isCached };
  }

  function hasTouchedCompleteSubjectVotes(subjectId: SubjectId): boolean {
    return !!knownSubjects[subjectId];
  }

  function queryCompleteSubjectDataTracked(
    subjectId: SubjectId,
    innerOpts?: { shouldRefetch?: boolean },
  ): Accessor<SubjectDataResponse> {
    const { store, isCached } = getKnownSubject(subjectId);

    if (
      (!innerOpts?.shouldRefetch && isCached) ||
      (innerOpts?.shouldRefetch && store.isLoading)
    ) {
      return store.subjectAccessor;
    }
    store.markSubjectAsLoading();

    (async () => {
      const resp = await opts.appClient
        .getSubjectEpisodesRatings({ subjectID: subjectId });

      switch (resp[0]) {
        case "ok":
          store.mergeSubjectData(resp[1]);
          break;
        case "error":
          store.setSubjectError(resp);
          break;
        default:
          resp[0] satisfies never;
          throw new Error("unreachable!");
      }
    })();

    return store.subjectAccessor;
  }

  function queryEpisodeDataTracked(
    subjectId: SubjectId,
    episodeId: EpisodeId,
    opts: {
      prefersFetchingCompleteSubjectVotes: true;
      shouldRefetch?: boolean;
    },
  ): Accessor<EpisodeDataResponse> {
    if (opts.prefersFetchingCompleteSubjectVotes) {
      queryCompleteSubjectDataTracked(subjectId, {
        shouldRefetch: opts.shouldRefetch,
      });
    } else {
      throw new Error("TODO");
    }

    const { store } = getKnownSubject(subjectId);
    return store.getEpisodeDataResponseMemo(episodeId);
  }

  function updateMyRating(
    subjectId: SubjectId,
    episodeId: EpisodeId,
    myRating: { score?: Score | null; visibility?: { isVisible: boolean } },
  ) {
    const { store } = getKnownSubject(subjectId);

    if (!store.tryMarkEpisodeAsProcessing(episodeId)) return;

    (async () => {
      const resp = await opts.appClient.patchEpisodeRating({
        subjectID: subjectId,
        episodeID: episodeId,
        ...(myRating.score !== undefined ? { score: myRating.score } : {}),
        ...(myRating.visibility
          ? { isVisible: myRating.visibility.isVisible }
          : {}),
      });
      switch (resp[0]) {
        case "ok": {
          store.updateMyRating(episodeId, {
            ...(resp[1].score ? { score: resp[1].score as Score } : {}),
            ...(resp[1].visibility
              ? { visibility: { isVisible: resp[1].visibility.is_visible } }
              : {}),
          });
          break;
        }
        case "error": {
          store.setEpisodeError(episodeId, resp);
          break;
        }
        case "auth_required": {
          opts.authStore.clear();
          store.clearPersonalData();
          break;
        }
        default:
          resp satisfies never;
      }
    })();
  }

  return {
    hasTouchedCompleteSubjectVotes,
    queryCompleteSubjectDataTracked,
    queryEpisodeDataTracked,
    updateMyRating,
  };
}

class SubjectStore {
  #owner: Owner;

  #accessor: Accessor<SubjectDataResponse>;
  #setter: Setter<SubjectDataResponse>;

  #episodeMemos: { [episodeId: EpisodeId]: Accessor<EpisodeDataResponse> } = {};

  constructor() {
    this.#owner = createRoot(() => getOwner()!);
    [this.#accessor, this.#setter] = //
      createSignal<SubjectDataResponse>(["loading", {}]);
  }

  get subjectAccessor() {
    return this.#accessor;
  }

  get currentSubjectState() {
    return untrack(this.#accessor)[0];
  }

  get isLoading() {
    return this.currentSubjectState === "loading";
  }

  /**
   * not reactive.
   */
  #tryQuerySubjectData(): SubjectData | null {
    const resp = untrack(this.#accessor);
    switch (resp[0]) {
      case "ok":
        return resp[1];
      case "error":
        return null;
      case "loading":
        return resp[1].oldData ?? null;
      default:
        resp[0] satisfies never;
        throw new Error("unreachable!");
    }
  }

  /**
   * not reactive.
   */
  #tryQueryEpisodeData(episodeId: EpisodeId): EpisodeData | null {
    const sData = this.#tryQuerySubjectData();
    if (!sData) return null;
    const epResp = sData.episodes[episodeId];
    if (!epResp) return null;
    switch (epResp[0]) {
      case "ok":
        return epResp[1];
      case "error":
        return null;
      case "loading":
      case "processing":
        return epResp[1].oldData ?? null;
      default:
        epResp[0] satisfies never;
        throw new Error("unreachable!");
    }
  }

  #tryUpdateSubjectData(newData: SubjectData): boolean {
    switch (this.currentSubjectState) {
      case "ok":
        this.#setter(["ok", newData]);
        return true;
      case "loading":
        this.#setter(["loading", { oldData: newData }]);
        return true;
      case "error":
        return false;
      default:
        this.currentSubjectState satisfies never;
        throw new Error("unreachable!");
    }
  }

  #tryUpdateEpisodeData(episodeId: EpisodeId, newData: EpisodeData): boolean {
    const sData = this.#tryQuerySubjectData();
    if (!sData) return false;
    const epResp = sData.episodes[episodeId];
    if (!epResp) return false;
    const newEpState = ((): EpisodeDataResponse => {
      switch (epResp[0]) {
        case "ok":
          return ["ok", newData];
        case "error":
          return epResp;
        case "loading":
        case "processing":
          return [epResp[0], { oldData: newData }];
        default:
          epResp[0] satisfies never;
          throw new Error("unreachable!");
      }
    })();
    const newSData: SubjectData = {
      ...sData,
      episodes: { ...sData.episodes, [episodeId]: newEpState },
    };
    return this.#tryUpdateSubjectData(newSData);
  }

  #tryUpdateEpisodeState(
    episodeId: EpisodeId,
    newState: "loading" | "processing",
  ): boolean {
    const sData = this.#tryQuerySubjectData();
    if (!sData) return false;
    const epData = this.#tryQueryEpisodeData(episodeId);
    const newSData: SubjectData = {
      ...sData,
      episodes: {
        ...sData.episodes,
        [episodeId]: [newState, epData ? { oldData: epData } : {}],
      },
    };
    return this.#tryUpdateSubjectData(newSData);
  }

  #tryUpdateEpisodeStateWithData(
    episodeId: EpisodeId,
    newState: APIResponse<EpisodeData> | null,
  ): boolean {
    const sData = this.#tryQuerySubjectData();
    if (!sData) return false;
    const newSData = ((): SubjectData => {
      if (newState) {
        return {
          ...sData,
          episodes: { ...sData.episodes, [episodeId]: newState },
        };
      } else {
        const newSData = { ...sData, episodes: { ...sData.episodes } };
        delete newSData.episodes[episodeId];
        return newSData;
      }
    })();
    this.#setter(["ok", newSData]);
    return true;
  }

  markSubjectAsLoading() {
    const sData = this.#tryQuerySubjectData();
    this.#setter(["loading", sData ? { oldData: sData } : {}]);
  }

  tryMarkEpisodeAsProcessing(episodeId: EpisodeId): boolean {
    return this.#tryUpdateEpisodeState(episodeId, "processing");
  }

  mergeSubjectData(newData: GetSubjectEpisodesResponseData) {
    const oldSData = this.#tryQuerySubjectData();
    const mergedSData: SubjectData = {
      episodes: { ...oldSData?.episodes },
      isComplete: true,
      hasMyRatings: !!newData.my_ratings,
    };
    for (const [epId_, rawEpVotes] of Object.entries(newData.episodes_votes)) {
      const epId = Number(epId_) as EpisodeId;
      if (!rawEpVotes) continue;
      const votes = { ...rawEpVotes } as EpisodeVotes;
      const myRating = ((): MyRating | undefined => {
        if (!newData.my_ratings) return undefined;
        if (epId in newData.my_ratings) {
          const rawMyRating = newData.my_ratings[epId];
          return {
            score: rawMyRating as Score,
            // FIXME: 需要改服务端。
            visibility: "unknown",
          };
        } else {
          return { score: null, visibility: "unknown" };
        }
      })();
      const epData: EpisodeData = {
        votes,
        ...myRating ? { myRating } : {},
      };
      mergedSData.episodes[epId] = ["ok", epData];
    }
    this.#setter(["ok", mergedSData]);
  }

  setSubjectError(
    errResp: APIResponse<GetSubjectEpisodesResponseData> & { 0: "error" },
  ) {
    this.#setter(errResp);
  }

  setEpisodeError(
    episodeId: EpisodeId,
    errResp: APIResponse<RateEpisodeResponseData> & { 0: "error" },
  ) {
    this.#tryUpdateEpisodeStateWithData(episodeId, errResp);
  }

  updateMyRating(
    episodeId: EpisodeId,
    myRating: { score?: Score | null; visibility?: { isVisible: boolean } },
  ) {
    const oldEpData = this.#tryQueryEpisodeData(episodeId);
    if (!oldEpData) throw new Error("unreachable!");
    if (!oldEpData.myRating) throw new Error("unreachable!");

    const newEpData = { ...oldEpData };

    if (myRating.score !== undefined) {
      if (oldEpData.myRating.score !== null) {
        newEpData.votes[oldEpData.myRating.score] =
          (newEpData.votes[oldEpData.myRating.score] ?? 1) - 1;
      }
      if (myRating.score !== null) {
        newEpData.votes[myRating.score] =
          (newEpData.votes[myRating.score] ?? 0) + 1;
      }
      newEpData.myRating!.score = myRating.score;
    }
    if (myRating.visibility !== undefined) {
      newEpData.myRating!.visibility = myRating.visibility;
    }
    this.#tryUpdateEpisodeStateWithData(episodeId, ["ok", newEpData]);
  }

  /**
   * TODO: 现在的这个实现太乱了。
   */
  clearPersonalData() {
    const sData = this.#tryQuerySubjectData();
    if (!sData) return;
    batch(() => {
      for (const [epId_, _] of Object.entries(sData.episodes)) {
        const epId = Number(epId_) as EpisodeId;
        const epData = this.#tryQueryEpisodeData(epId);
        if (!epData || !epData.myRating) continue;
        const newEpData = { ...epData };
        delete newEpData.myRating;
        this.#tryUpdateEpisodeData(epId, newEpData);
      }
    });
  }

  getEpisodeDataResponseMemo(
    episodeId: EpisodeId,
  ): Accessor<EpisodeDataResponse> {
    // NOTE: 原先这里的 memos 有不 reactive 的问题，Copilot 最先提出的方案是在这
    // 里用 `createRoot`。但我不希望每次创建一个 memo 都创建一个 root，因此改用
    // 现行的方案（`this.#owner` + `runWithOwner`）。

    return (this.#episodeMemos[episodeId] ??= runWithOwner(
      this.#owner,
      () =>
        createMemo(on(
          this.#accessor,
          (sDataResp): EpisodeDataResponse => {
            switch (sDataResp[0]) {
              case "error":
                return sDataResp;
              case "loading":
                return ["loading", {}];
              default:
                sDataResp[0] satisfies "ok";
            }
            const completeData = sDataResp[1];
            const episodeData = completeData.episodes[episodeId];
            if (!episodeData) {
              if (completeData.hasMyRatings) {
                return ["ok", {
                  votes: {},
                  myRating: { score: null, visibility: "unknown" },
                }];
              } else {
                return ["ok", { votes: {} }];
              }
            }
            return episodeData;
          },
        )),
    )!);
  }
}
