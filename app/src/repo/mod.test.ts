import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
// @deno-types="npm:@types/sinonjs__fake-timers"
import FakeTimers from "npm:@sinonjs/fake-timers";

import { EpisodeID, SubjectID, UserID } from "@/types.ts";

import { Repo } from "./mod.ts";

const U1 = 11 as UserID, U2 = 12 as UserID, U3 = 13 as UserID;
const T1 = "TA", T2 = "TB", T3 = "TC";
const S1 = 21 as SubjectID, S2 = 22 as SubjectID;
const S1E1 = 31 as EpisodeID,
  S1E2 = 32 as EpisodeID,
  S2E1 = 33 as EpisodeID,
  _S2E2 = 34 as EpisodeID;

describe("class Repo", () => {
  let repo!: Repo;

  beforeEach(async () => {
    repo = await Repo.__openForTest();
  });
  afterEach(() => repo.__closeForTest());

  describe("User", () => {
    it("works", async () => {
      {
        const oldUserData = await repo.getUserResult(U1);
        expect(oldUserData.value).toBe(null);
        const result = await repo.tx((tx) => {
          tx.setUser(U1, { tokens: [T1] }, oldUserData);
        });
        expect(result.ok).toBe(true);

        const retrievedUserData = await repo.getUserResult(U1);
        expect(retrievedUserData.value).toEqual({ tokens: [T1] });
      }

      {
        const oldUserData = await repo.getUserResult(U1);
        expect(oldUserData.value).not.toBe(null);
        const result = await repo.tx((tx) => {
          tx.setUser(U1, { tokens: [T1, T2] }, oldUserData);
        });
        expect(result.ok).toBe(true);

        const retrievedUserData = await repo.getUserResult(U1);
        expect(retrievedUserData.value).toEqual({
          tokens: [T1, T2],
        });
      }

      {
        const anotherUserData = await repo.getUserResult(U2);
        expect(anotherUserData.value).toBe(null);
      }
    });
  });

  describe("TokenEntry", () => {
    describe("method getUserIDByToken", () => {
      it("works", async () => {
        const result = await repo.tx((tx) => {
          tx.setTokenEntry(T1, { userID: U1 });
          tx.setTokenEntry(T2, { userID: U2 });
        });
        expect(result.ok).toBe(true);

        expect(await repo.getUserIDByToken(T1)).toBe(U1);
        expect(await repo.getUserIDByToken(T2)).toBe(U2);
        expect(await repo.getUserIDByToken(T3)).toBe(null);
      });
    });

    describe("method getUserIDEx", () => {
      describe("传入 token", () => {
        it("在 token 为 `null` 时，返回 `null`", async () => {
          expect(
            await repo.getUserIDEx(["token", null], { claimedUserID: null }),
          ).toBe(null);

          expect(
            await repo.getUserIDEx(["token", null], { claimedUserID: U1 }),
          ).toBe(null);
        });

        it("在 token 不为空时，从 repo 获取对应的用户 ID", async () => {
          expect(
            await repo.getUserIDEx(["token", T1], { claimedUserID: U1 }),
          ).toBe(null);

          {
            const result = await repo.tx((tx) => {
              tx.setTokenEntry(T1, { userID: U1 });
            });
            expect(result.ok).toBe(true);
          }

          expect(
            await repo.getUserIDEx(["token", T1], { claimedUserID: U1 }),
          ).toBe(U1);
          expect(
            await repo.getUserIDEx(["token", T1], { claimedUserID: null }),
          ).toBe(null);
          expect(
            await repo.getUserIDEx(["token", T2], { claimedUserID: U2 }),
          ).toBe(null);
        });
      });

      describe("传入用户 ID", () => {
        it("works", async () => {
          expect(
            await repo.getUserIDEx(["userID", U1], { claimedUserID: null }),
          ).toBe(null);
          expect(
            await repo.getUserIDEx(["userID", U1], { claimedUserID: U2 }),
          ).toBe(null);
          expect(
            await repo.getUserIDEx(["userID", U1], { claimedUserID: U1 }),
          ).toBe(U1);
        });
      });
    });

    describe("method deleteTokenEntry in class RepoTransaction", () => {
      it("works", async () => {
        {
          const result = await repo.tx((tx) => {
            tx.setTokenEntry(T1, { userID: U1 });
            tx.setTokenEntry(T2, { userID: U2 });
          });
          expect(result.ok).toBe(true);
        }

        {
          const result = await repo.tx((tx) => {
            tx.deleteTokenEntry(T1);
          });
          expect(result.ok).toBe(true);

          expect(await repo.getUserIDByToken(T1)).toBe(null);
          expect(await repo.getUserIDByToken(T2)).toBe(U2);
        }
      });
    });
  });

  describe("TokenCouponEntry", () => {
    it("works", async () => {
      expect(await repo.popTokenCouponEntryToken("FOO")).toBe(null);
      expect(await repo.popTokenCouponEntryToken("BAR")).toBe(null);
      expect(await repo.popTokenCouponEntryToken("BAZ")).toBe(null);

      await repo.tx((tx) => {
        tx.setTokenCouponEntry("FOO", { token: T1 });
        tx.setTokenCouponEntry("BAR", { token: T2 });
      });

      expect(await repo.popTokenCouponEntryToken("FOO")).toBe(T1);
      expect(await repo.popTokenCouponEntryToken("BAR")).toBe(T2);
      expect(await repo.popTokenCouponEntryToken("BAZ")).toBe(null);

      expect(await repo.popTokenCouponEntryToken("FOO")).toBe(null);
      expect(await repo.popTokenCouponEntryToken("BAR")).toBe(null);
      expect(await repo.popTokenCouponEntryToken("BAZ")).toBe(null);
    });

    it("超过一定时限后不再有效", async () => {
      const clock = FakeTimers.install();
      try {
        await repo.tx((tx) => {
          tx.setTokenCouponEntry("FOO", { token: T1, expiresInMs: 1000 });
        });
        clock.tick(1500);
        expect(await repo.popTokenCouponEntryToken("FOO")).toBe(null);
      } finally {
        clock.uninstall();
      }
    });
  });

  describe("EpisodeInfo", () => {
    it("works", async () => {
      expect(await repo.getEpisodeInfo(S1E1)).toBe(null);

      await repo.setEpisodeInfo(S1E1, { subjectID: S1 });
      await repo.setEpisodeInfo(S1E2, { subjectID: S1 });
      await repo.setEpisodeInfo(S2E1, { subjectID: S2 });

      expect(await repo.getEpisodeInfo(S1E1)).toEqual({ subjectID: S1 });
      expect(await repo.getEpisodeInfo(S1E2)).toEqual({ subjectID: S1 });
      expect(await repo.getEpisodeInfo(S2E1)).toEqual({ subjectID: S2 });
    });

    it("works for get many", async () => {
      expect(await repo.getManyEpisodeInfos(new Set())).toEqual({});

      await repo.setEpisodeInfo(S1E1, { subjectID: S1 });
      await repo.setEpisodeInfo(S1E2, { subjectID: S1 });
      await repo.setEpisodeInfo(S2E1, { subjectID: S2 });

      expect(await repo.getManyEpisodeInfos(new Set([S1E1]))).toEqual({
        [S1E1]: { subjectID: S1 },
      });
      expect(await repo.getManyEpisodeInfos(new Set([S1E1, S1E2, S2E1])))
        .toEqual({
          [S1E1]: { subjectID: S1 },
          [S1E2]: { subjectID: S1 },
          [S2E1]: { subjectID: S2 },
        });
    });
  });

  describe("UserSubjectEpisodeRating", () => {
    async function setNewUserEpisodeRating(
      U: UserID,
      S: SubjectID,
      E: EpisodeID,
      opts: {
        score: number | null;
        submittedAtMs?: number;
      },
    ) {
      const { score } = opts;
      const submittedAtMs = opts.submittedAtMs ?? Date.now();

      const oldResult = await repo.getUserEpisodeRatingResult(U, S, E);
      expect(oldResult.value).toBe(null);

      const result = await repo.tx((tx) => {
        tx.setUserEpisodeRating(U, S, E, {
          score,
          submittedAtMs,
        }, oldResult);
      });
      expect(result.ok).toBe(true);
    }

    it("works", async () => {
      const firstSubmittedAtMs = Date.now();

      await setNewUserEpisodeRating(U1, S1, S1E1, {
        score: 7,
        submittedAtMs: firstSubmittedAtMs,
      });

      expect(
        (await repo.getUserEpisodeRatingResult(U2, S1, S1E1)).value,
      ).toBe(null);
      expect(
        (await repo.getUserEpisodeRatingResult(U1, S1, S1E2)).value,
      ).toBe(null);
      expect(
        (await repo.getUserEpisodeRatingResult(U1, S2, S2E1)).value,
      ).toBe(null);
      expect( // `subjectID` 与 `episodeID` 不匹配的情况。
        (await repo.getUserEpisodeRatingResult(U1, S2, S1E1)).value,
      ).toBe(null);

      expect(await repo.getUserEpisodesRatingsUnderSubject(U1, S1))
        .toEqual({ [S1E1]: 7 });

      {
        const oldResult = await repo.getUserEpisodeRatingResult(U1, S1, S1E1);
        expect(oldResult.value).toEqual({
          score: 7,
          submittedAtMs: firstSubmittedAtMs,
        });

        const secondSubmittedAtMs = firstSubmittedAtMs + 1000;
        const result = await repo.tx((tx) => {
          tx.setUserEpisodeRating(U1, S1, S1E1, {
            score: null,
            submittedAtMs: secondSubmittedAtMs,
          }, oldResult);
        });
        expect(result.ok).toBe(true);

        expect(
          (await repo.getUserEpisodeRatingResult(U1, S1, S1E1)).value,
        ).toEqual({
          score: null,
          submittedAtMs: secondSubmittedAtMs,
        });
      }

      await setNewUserEpisodeRating(U1, S1, S1E2, { score: 8 });
      await setNewUserEpisodeRating(U1, S2, S2E1, { score: 6 });
      expect(await repo.getUserEpisodesRatingsUnderSubject(U1, S1))
        .toEqual({ [S1E2]: 8 });
      expect(await repo.getUserEpisodesRatingsUnderSubject(U1, S2))
        .toEqual({ [S2E1]: 6 });
    });
  });

  describe("SubjectEpisodeScoreVotes", () => {
    it("works", async () => {
      expect(await repo.getAllEpisodeVotesGroupedByScore(S1, S1E1))
        .toEqual({});
      expect(
        await repo.getAllEpisodesVotesInSubjectGroupedByScoreAndEpisodeEx(S1),
      ).toEqual({ votesByScoreBySubject: {} });

      {
        const result = await repo.tx((tx) => {
          tx.increaseSubjectEpisodeScoreVotes(S1, S1E1, 7);
          tx.increaseSubjectEpisodeScoreVotes(S2, S2E1, 10);
        });
        expect(result.ok).toBe(true);
        expect(await repo.getAllEpisodeVotesGroupedByScore(S1, S1E1))
          .toEqual({ 7: 1 });
        expect(await repo.getAllEpisodeVotesGroupedByScore(S2, S2E1))
          .toEqual({ 10: 1 });
        expect(
          await repo.getAllEpisodesVotesInSubjectGroupedByScoreAndEpisodeEx(S1),
        ).toEqual({ votesByScoreBySubject: { [S1E1]: { 7: 1 } } });
        expect(
          await repo.getAllEpisodesVotesInSubjectGroupedByScoreAndEpisodeEx(S2),
        ).toEqual({ votesByScoreBySubject: { [S2E1]: { 10: 1 } } });
      }

      {
        const result = await repo.tx((tx) => {
          tx.decreaseSubjectEpisodeScoreVotes(S1, S1E1, 7);
          for (let i = 0; i < 10; i++) {
            tx.increaseSubjectEpisodeScoreVotes(S1, S1E2, 6);
          }
          tx.increaseSubjectEpisodeScoreVotes(S1, S1E2, 8);
        });
        expect(result.ok).toBe(true);
        expect(await repo.getAllEpisodeVotesGroupedByScore(S1, S1E1))
          .toEqual({});
        expect(await repo.getAllEpisodeVotesGroupedByScore(S1, S1E2))
          .toEqual({ 6: 10, 8: 1 });
        expect(
          await repo.getAllEpisodesVotesInSubjectGroupedByScoreAndEpisodeEx(S1),
        ).toEqual({
          votesByScoreBySubject: { [S1E1]: null, [S1E2]: { 6: 10, 8: 1 } },
        });
      }
    });
  });

  describe("SubjectEpisodeScorePublicVoters", () => {
    it("works", async () => {
      expect(await repo.getAllEpisodePublicVotersGroupedByScore(S1, S1E1))
        .toEqual({});

      {
        const result = await repo.tx((tx) => {
          tx.setSubjectEpisodeScorePublicVoter(S1, S1E1, 7, U1);
        });
        expect(result.ok).toBe(true);
        expect(await repo.getAllEpisodePublicVotersGroupedByScore(S1, S1E1))
          .toEqual({ 7: [U1] });
        expect(await repo.getAllEpisodePublicVotersGroupedByScore(S1, S1E2))
          .toEqual({});
      }

      {
        const result = await repo.tx((tx) => {
          tx.setSubjectEpisodeScorePublicVoter(S1, S1E1, 7, U2);
          tx.setSubjectEpisodeScorePublicVoter(S1, S1E1, 8, U3);
        });
        expect(result.ok).toBe(true);
        expect(await repo.getAllEpisodePublicVotersGroupedByScore(S1, S1E1))
          .toEqual({ 7: [U1, U2], 8: [U3] });
      }

      {
        const result = await repo.tx((tx) => {
          tx.deleteSubjectEpisodeScorePublicVoter(S1, S1E1, 7, U1);
          tx.deleteSubjectEpisodeScorePublicVoter(S1, S1E1, 8, U3);
        });
        expect(result.ok).toBe(true);
        expect(await repo.getAllEpisodePublicVotersGroupedByScore(S1, S1E1))
          .toEqual({ 7: [U2] });
      }
    });
  });

  describe("UserTimelineItem", () => {
    const TS1 = Date.now(),
      TS2 = TS1 + 1000,
      TS3 = TS2 + 1000,
      TS4 = TS3 + 1000;

    it("works", async () => {
      const result = await repo.tx((tx) => {
        tx.insertUserTimelineItem(U1, TS1, ["rate-episode", {
          episodeID: S1E1,
          score: 7,
        }]);
        tx.insertUserTimelineItem(U1, TS2, ["rate-episode", {
          episodeID: S1E2,
          score: 8,
        }]);
        tx.insertUserTimelineItem(U2, TS3, ["rate-episode", {
          episodeID: S1E1,
          score: 6,
        }]);
        tx.insertUserTimelineItem(U1, TS4, ["rate-episode", {
          episodeID: S1E1,
          score: null,
        }]);
      });
      expect(result.ok).toBe(true);
      expect(await repo.getUserTimelineItems(U1)).toEqual([
        [TS4, "rate-episode", { episodeID: S1E1, score: null }],
        [TS2, "rate-episode", { episodeID: S1E2, score: 8 }],
        [TS1, "rate-episode", { episodeID: S1E1, score: 7 }],
      ]);
      expect(await repo.getUserTimelineItems(U2))
        .toEqual([[TS3, "rate-episode", { episodeID: S1E1, score: 6 }]]);

      expect(await repo.getUserTimelineItems(U1, { limit: 2 })).toEqual([
        [TS4, "rate-episode", { episodeID: S1E1, score: null }],
        [TS2, "rate-episode", { episodeID: S1E2, score: 8 }],
      ]);
      expect(await repo.getUserTimelineItems(U2, { limit: 3 }))
        .toEqual([[TS3, "rate-episode", { episodeID: S1E1, score: 6 }]]);

      expect(await repo.getUserTimelineItems(U1, { offset: 1, limit: 1 }))
        .toEqual([[TS2, "rate-episode", { episodeID: S1E2, score: 8 }]]);
      expect(await repo.getUserTimelineItems(U1, { offset: 1, limit: 2 }))
        .toEqual([
          [TS2, "rate-episode", { episodeID: S1E2, score: 8 }],
          [TS1, "rate-episode", { episodeID: S1E1, score: 7 }],
        ]);
    });

    it("在用户、时间都相同时失败", async () => {
      {
        const result = await repo.tx((tx) => {
          tx.insertUserTimelineItem(U1, TS1, ["rate-episode", {
            episodeID: S1E1,
            score: 7,
          }]);
        });
        expect(result.ok).toBe(true);
      }
      {
        const result = await repo.tx((tx) => {
          tx.insertUserTimelineItem(U1, TS1, ["rate-episode", {
            episodeID: S1E1,
            score: null,
          }]);
        });
        expect(result.ok).toBe(false);
      }
    });
  });
});
