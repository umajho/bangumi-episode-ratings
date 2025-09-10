import { afterEach, beforeEach, describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect/expect";

import { EpisodeID, SubjectID, UserID } from "@/types.ts";
import { Repo } from "@/repo/mod.ts";

import {
  queryEpisodePublicRatings,
  queryEpisodeRatings,
  querySubjectEpisodesRatings,
  queryUserTimeLineItems,
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
  beforeEach(async () => {
    await mustSetRatingRelatedForTest(repo, [
      [U1, S1, S1E1, 7, false],
      [U2, S1, S1E1, 7, true],
      [U1, S1, S1E2, 8, true],
      [U2, S1, S1E2, 6, true],
      [U1, S2, S2E1, 8, true],
    ]);
  });

  it("works", async () => {
    expect(
      await querySubjectEpisodesRatings(repo, null, { subjectID: S1 }),
    ).toEqual(["ok", {
      episodes_votes: { [S1E1]: { 7: 2 }, [S1E2]: { 6: 1, 8: 1 } },
    }]);
    expect(
      await querySubjectEpisodesRatings(repo, U1, { subjectID: S1 }),
    ).toEqual(["ok", {
      episodes_votes: { [S1E1]: { 7: 2 }, [S1E2]: { 6: 1, 8: 1 } },
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
      await queryEpisodeRatings(repo, null, { subjectID: S1, episodeID: S1E1 }),
    ).toEqual(["ok", {
      votes: { 7: 2 },
      public_ratings: { public_voters_by_score: { 7: [U2] } },
    }]);
    expect(
      await queryEpisodeRatings(repo, U1, { subjectID: S1, episodeID: S1E1 }),
    ).toEqual(["ok", {
      votes: { 7: 2 },
      public_ratings: { public_voters_by_score: { 7: [U2] } },
      my_rating: { score: 7, visibility: { is_visible: false } },
    }]);
    expect(
      await queryEpisodeRatings(repo, null, { subjectID: S1, episodeID: S1E2 }),
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
        }, oldRatingResult);
      });
      expect(result.ok).toBe(true);
    }
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

describe("function queryUserTimeLineItems", () => {
  let TS1: number;
  beforeEach(async () => {
    TS1 = Date.now();

    await repo.setEpisodeInfo(S1E1, { subjectID: S1 });
    await repo.setEpisodeInfo(S1E2, { subjectID: S1 });
    await repo.setEpisodeInfo(S2E1, { subjectID: S2 });
    const result = await repo.tx((tx) => {
      const fixtureList: [UserID, EpisodeID, number | null][] = [
        [U1, S1E1, 7],
        [U1, S2E1, 6],
        [U1, S1E1, 8],
        [U1, S1E2, 6],
        [U2, S1E2, 5],
        [U1, S2E1, null],
      ];
      for (const [i, [userID, episodeID, score]] of fixtureList.entries()) {
        tx.insertUserTimelineItem(
          userID,
          TS1 + i * 100,
          ["rate-episode", { episodeID, score }],
        );
      }
    });
    expect(result.ok).toBe(true);
  });

  it("works with `limit` >= length", async () => {
    expect(await queryUserTimeLineItems(repo, U1, { offset: 0, limit: 10 }))
      .toEqual(["ok", {
        items: [
          [TS1 + 500, "rate-episode", { episode_id: S2E1, score: null }],
          [TS1 + 300, "rate-episode", { episode_id: S1E2, score: 6 }],
          [TS1 + 200, "rate-episode", { episode_id: S1E1, score: 8 }],
          [TS1 + 100, "rate-episode", { episode_id: S2E1, score: 6 }],
          [TS1, "rate-episode", { episode_id: S1E1, score: 7 }],
        ],
        subjects: {
          [S1]: { episode_ids: [S1E1, S1E2] },
          [S2]: { episode_ids: [S2E1] },
        },
      }]);
    expect(await queryUserTimeLineItems(repo, U2, { offset: 0, limit: 10 }))
      .toEqual(["ok", {
        items: [[TS1 + 400, "rate-episode", { episode_id: S1E2, score: 5 }]],
        subjects: { [S1]: { episode_ids: [S1E2] } },
      }]);
  });

  it("works with `limit` < length", async () => {
    expect(await queryUserTimeLineItems(repo, U1, { offset: 0, limit: 1 }))
      .toEqual(["ok", {
        items: [[TS1 + 500, "rate-episode", { episode_id: S2E1, score: null }]],
        subjects: { [S2]: { episode_ids: [S2E1] } },
      }]);
  });

  it("works with `offset` > 0", async () => {
    expect(await queryUserTimeLineItems(repo, U1, { offset: 1, limit: 2 }))
      .toEqual(["ok", {
        items: [
          [TS1 + 300, "rate-episode", { episode_id: S1E2, score: 6 }],
          [TS1 + 200, "rate-episode", { episode_id: S1E1, score: 8 }],
        ],
        subjects: { [S1]: { episode_ids: [S1E1, S1E2] } },
      }]);
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
      }, oldRatingResult);
      tx.increaseSubjectEpisodeScoreVotes(s, e, score);
      if (isVisible) {
        tx.setSubjectEpisodeScorePublicVoter(s, e, score, u);
      }
    });
    expect(result.ok).toBe(true);
  }
}
