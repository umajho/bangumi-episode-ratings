import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect/expect";

import { EpisodeID, SubjectID, UserID } from "@/types.ts";
import { Repo } from "@/repo/mod.ts";

import {
  queryEpisodeMyRating,
  queryEpisodePublicRatings,
  queryEpisodeRatings,
  querySubjectEpisodesRatings,
} from "./queries.ts";

const U1 = 11 as UserID, U2 = 12 as UserID;
const T1 = "TA", T2 = "TB";
const S1 = 21 as SubjectID, S2 = 22 as SubjectID;
const S1E1 = 31 as EpisodeID, S1E2 = 32 as EpisodeID, S2E1 = 33 as EpisodeID;

let repo!: Repo;
beforeEach(async () => {
  repo = await Repo.__openForTest();

  for (const [u, t] of [[U1, T1], [U2, T2]] as const) {
    const oldUser = await repo.getUserResult(u);
    const result = await repo.tx((tx) => {
      tx.setUser(u, { tokens: [t] }, oldUser);
    });
    expect(result.ok).toBe(true);
  }
});
afterEach(() => repo.__closeForTest());

describe("function querySubjectEpisodesRatings", () => {
  it("works", async () => {
    await mustSetRatingRelatedForTest(repo, [
      [U1, S1, S1E1, 7, false],
      [U2, S1, S1E1, 7, true],
      [U1, S1, S1E2, 8, true],
      [U2, S1, S1E2, 6, true],
      [U1, S2, S2E1, 8, true],
    ]);

    expect(
      await querySubjectEpisodesRatings(repo, null, { subjectID: S1 }),
    ).toEqual(["ok", {
      episodes_votes: { [S1E1]: { 7: 2 }, [S1E2]: { 6: 1, 8: 1 } },
      is_certain_that_episodes_votes_are_integral: true,
    }]);
    expect(
      await querySubjectEpisodesRatings(repo, U1, { subjectID: S1 }),
    ).toEqual(["ok", {
      episodes_votes: { [S1E1]: { 7: 2 }, [S1E2]: { 6: 1, 8: 1 } },
      is_certain_that_episodes_votes_are_integral: true,
      my_ratings: { [S1E1]: 7, [S1E2]: 8 },
    }]);
  });
});

describe("function queryEpisodeRatings", () => {
  it("works", async () => {
    await mustSetRatingRelatedForTest(repo, [
      [U1, S1, S1E1, 7, false],
      [U2, S1, S1E1, 7, true],
      [U1, S1, S1E2, 8, true],
      [U2, S1, S1E2, 6, true],
    ]);

    expect(
      await queryEpisodeRatings(repo, null, {
        subjectID: S1,
        episodeID: S1E1,
        compatibility: { noPublicRatings: false },
      }),
    ).toEqual(["ok", {
      votes: { 7: 2 },
      public_ratings: { public_voters_by_score: { 7: [U2] } },
    }]);
    expect(
      await queryEpisodeRatings(repo, U1, {
        subjectID: S1,
        episodeID: S1E1,
        compatibility: { noPublicRatings: false },
      }),
    ).toEqual(["ok", {
      votes: { 7: 2 },
      public_ratings: { public_voters_by_score: { 7: [U2] } },
      my_rating: { score: 7, visibility: { is_visible: false } },
    }]);
    expect(
      await queryEpisodeRatings(repo, null, {
        subjectID: S1,
        episodeID: S1E2,
        compatibility: { noPublicRatings: false },
      }),
    ).toEqual(["ok", {
      votes: { 6: 1, 8: 1 },
      public_ratings: { public_voters_by_score: { 6: [U2], 8: [U1] } },
    }]);
  });
});

describe("function queryEpisodeMyRating", () => {
  it("works", async () => {
    {
      const oldRatingResult = await repo
        .getUserEpisodeRatingResult(U1, S1, S1E1);

      const result = await repo.tx((tx) => {
        tx.setUserEpisodeRating(U1, S1, S1E1, {
          score: 7,
          submittedAtMs: Date.now(),
          isVisible: false,
          history: [],
        }, oldRatingResult);
      });
      expect(result.ok).toBe(true);
    }

    {
      const oldRatingResult = await repo
        .getUserEpisodeRatingResult(U1, S1, S1E2);

      const result = await repo.tx((tx) => {
        tx.setUserEpisodeRating(U1, S1, S1E2, {
          score: 8,
          submittedAtMs: Date.now(),
          isVisible: true,
          history: [],
        }, oldRatingResult);
      });
      expect(result.ok).toBe(true);
    }

    expect(
      await queryEpisodeMyRating(repo, U1, {
        subjectID: S1,
        episodeID: S1E1,
      }),
    ).toEqual(["ok", {
      score: 7,
      visibility: { is_visible: false },
    }]);
    expect(
      await queryEpisodeMyRating(repo, U1, {
        subjectID: S1,
        episodeID: S1E2,
      }),
    ).toEqual(["ok", {
      score: 8,
      visibility: { is_visible: true },
    }]);
  });
});

describe("function queryEpisodePublicRatings", () => {
  it("works", async () => {
    {
      const result = await repo.tx((tx) => {
        tx.setSubjectEpisodeScorePublicVoter(S1, S1E1, 7, U1);
        tx.setSubjectEpisodeScorePublicVoter(S1, S1E1, 8, U2);
        tx.setSubjectEpisodeScorePublicVoter(S1, S1E2, 8, U1);
        tx.setSubjectEpisodeScorePublicVoter(S1, S1E2, 8, U2);
      });
      expect(result.ok).toBe(true);
    }

    {
      const resp = await queryEpisodePublicRatings(repo, {
        subjectID: S1,
        episodeID: S1E1,
      });
      expect(resp).toEqual(["ok", {
        public_voters_by_score: { 7: [U1], 8: [U2] },
      }]);
    }

    {
      const resp = await queryEpisodePublicRatings(repo, {
        subjectID: S1,
        episodeID: S1E2,
      });
      expect(resp).toEqual(["ok", {
        public_voters_by_score: { 8: [U1, U2] },
      }]);
    }
  });
});

async function mustSetRatingRelatedForTest(
  repo: Repo,
  table: [
    u: UserID,
    s: SubjectID,
    e: EpisodeID,
    score: number,
    isVisible: boolean,
  ][],
) {
  for (
    const [u, s, e, score, isVisible] of table
  ) {
    const oldRatingResult = await repo.getUserEpisodeRatingResult(u, s, e);
    const result = await repo.tx((tx) => {
      tx.setUserEpisodeRating(u, s, e, {
        score,
        submittedAtMs: Date.now(),
        isVisible,
        history: [],
      }, oldRatingResult);
      tx.increaseSubjectEpisodeScoreVotes(s, e, score);
      if (isVisible) {
        tx.setSubjectEpisodeScorePublicVoter(s, e, score, u);
      }
    });
    expect(result.ok).toBe(true);
  }
}
