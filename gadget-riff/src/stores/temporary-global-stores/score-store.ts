import { type Accessor, createMemo, createSignal, type Signal } from "solid-js";

import type {
  EpisodeId,
  EpisodeVotes,
  Score,
  SubjectEpisodesVotes,
  SubjectId,
} from "../../definitions";
import type { APIResponse } from "../../shared/dto";
import type { AppClient } from "../../clients/app-client";

export type ScoreStore = ReturnType<typeof createScoreStore>;

export type SubjectEpisodesVotesResponse =
  | APIResponse<SubjectEpisodesVotes>
  | [tag: "loading"];
export type EpisodeVotesResponse =
  | APIResponse<EpisodeVotes>
  | [tag: "loading"];

export function createScoreStore(opts: { appClient: AppClient }) {
  const knownCompleteSubjects: {
    [subjectId: number]: Signal<SubjectEpisodesVotesResponse>;
  } = {};
  const knownEpisodes: {
    [episodeId: number]: Signal<EpisodeVotesResponse>;
  } = {};

  function hasTouchedCompleteSubjectVotes(subjectId: SubjectId): boolean {
    return !!knownCompleteSubjects[subjectId];
  }

  function queryCompleteSubjectVotesTracked(
    subjectId: SubjectId,
  ): Accessor<SubjectEpisodesVotesResponse> {
    const [known, _] = knownCompleteSubjects[subjectId] ??= (() => {
      const newKnownSignal = knownCompleteSubjects[subjectId] = //
        createSignal<SubjectEpisodesVotesResponse>(["loading"]);

      (async () => {
        const resp = await opts.appClient
          .getSubjectEpisodesRatings({ subjectID: subjectId });

        switch (resp[0]) {
          case "ok": {
            const votes: SubjectEpisodesVotes = {};
            for (
              const [epId_, rawEpVotes] of Object
                .entries(resp[1].episodes_votes)
            ) {
              const epId = Number(epId_) as EpisodeId;
              if (!rawEpVotes) continue;
              const epVotes: EpisodeVotes = {};
              for (const [scoreStr, votes] of Object.entries(rawEpVotes)) {
                epVotes[scoreStr as unknown as Score] = votes;
              }
              votes[epId as unknown as EpisodeId] = epVotes;
              updateEpisodeVotes(subjectId, epId, epVotes, {
                shouldAlsoUpdateCompleteSubjectVotes: false,
              });
            }
            newKnownSignal[1](["ok", votes]);
            break;
          }
          case "error": {
            newKnownSignal[1](resp);
            break;
          }
        }
      })();

      return newKnownSignal;
    })();
    return known;
  }

  function updateEpisodeVotes(
    _subjectId: SubjectId,
    episodeId: EpisodeId,
    votes: EpisodeVotes,
    _opts: { shouldAlsoUpdateCompleteSubjectVotes: false },
  ) {
    const [_, setEpisodeVotes] = knownEpisodes[episodeId] ??= //
      createSignal<EpisodeVotesResponse>(["loading"]);
    setEpisodeVotes(["ok", votes]);
  }

  function queryEpisodeVotesTracked(
    subjectId: SubjectId,
    episodeId: EpisodeId,
    opts: { prefersFetchingCompleteSubjectVotes: true },
  ): Accessor<EpisodeVotesResponse> {
    if (opts.prefersFetchingCompleteSubjectVotes) {
      return createMemo((): EpisodeVotesResponse => {
        const completeVotesResp = queryCompleteSubjectVotesTracked(subjectId)();
        if (completeVotesResp[0] !== "ok") return completeVotesResp;
        const completeVotes = completeVotesResp[1];
        const episodeVotes = completeVotes[episodeId];
        if (!episodeVotes) return ["ok", {}];
        return ["ok", episodeVotes];
      });
    }
    throw new Error("TODO");
  }

  return {
    hasTouchedCompleteSubjectVotes,
    queryCompleteSubjectVotesTracked,
    queryEpisodeVotesTracked,
  };
}
