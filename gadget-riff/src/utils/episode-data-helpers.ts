import { type Accessor, createMemo, on } from "solid-js";
import type { EpisodeDataResponse } from "../stores/temporary-global-stores/score-store";
import {
  type EpisodeData,
  type EpisodeVotes,
  type Score,
  scores,
} from "../definitions";

export function createIsLoading(
  dataResp: Accessor<EpisodeDataResponse>,
): Accessor<boolean> {
  return () => dataResp()[0] === "loading";
}

export function createData(
  dataResp: Accessor<EpisodeDataResponse>,
): Accessor<EpisodeData | undefined> {
  return createMemo(on(dataResp, (dataResp) => {
    switch (dataResp[0]) {
      case "ok":
        return dataResp[1];
      case "loading":
      case "processing":
        return dataResp[1]?.oldData;
    }
  }));
}

export type Computed = ReturnType<typeof createComputed>;

export function createComputedFromData(data: Accessor<EpisodeData>) {
  return createComputed(() => data().votes);
}

export function createComputed(votes: Accessor<EpisodeVotes>) {
  const totalVotes = createMemo(() => {
    return Object.values(votes()).reduce(
      (sum, votesForScore) => sum + votesForScore,
      0,
    );
  });
  const scoreSum = createMemo(() => {
    return Object.entries(votes()).reduce(
      (sum, [score, votesForScore]) => sum + Number(score) * votesForScore,
      0,
    );
  });
  const averageScore = () => scoreSum() / totalVotes();

  const mostVotedScore = createMemo(() => {
    let mostVotedScore: Score = scores[0];
    const votes_ = votes();
    for (const score of scores.slice(1)) {
      if ((votes_[score] ?? 0) > (votes_[mostVotedScore] ?? 0)) {
        mostVotedScore = score;
      }
    }

    return mostVotedScore;
  });

  const votesOfMostVotedScore = createMemo(() =>
    votes()[mostVotedScore()] ?? 0
  );

  return {
    votes,
    totalVotes,
    scoreSum,
    averageScore,
    mostVotedScore,
    votesOfMostVotedScore,
  };
}
