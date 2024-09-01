import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";

import { mockFetch, resetFetch } from "jsr:@c4spar/mock-fetch";

import { EpisodeID, SubjectID, UserID } from "../types.ts";
import { Repo } from "../repo/mod.ts";

import { rateEpisode } from "./commands.ts";
import { changeUserEpisodeRatingVisibility } from "./commands.ts";

const U1 = 11 as UserID;
const T1 = "TA";
const S1 = 21 as SubjectID;
const S1E1 = 31 as EpisodeID;

let repo!: Repo;
beforeEach(async () => {
  repo = await Repo.__openForTest();
  const oldUser = await repo.getUserResult(U1);
  const result = await repo.tx((tx) => {
    tx.setUser(U1, { tokens: [T1] }, oldUser);
  });
  expect(result.ok).toBe(true);
});
afterEach(() => repo.__closeForTest());

describe("function rateEpisode", () => {
  it("能处理非法输入", async () => {
    for (const input of [-1, 11, 1.1, 0, NaN, Infinity]) {
      const resp = await rateEpisode(repo, ["userID", U1], {
        claimedUserID: U1,
        claimedSubjectID: S1,
        episodeID: S1E1,
        score: input,
      });
      expect(resp[0]).toBe("error");
    }
  });

  it("能处理正常情况", async () => {
    expect(await repo.getEpisodeInfo(S1E1)).toBe(null);

    try {
      mockFetch(`https://api.bgm.tv/v0/episodes/${S1E1}`, {
        body: JSON.stringify({ subject_id: S1 }),
      });

      const resp = await rateEpisode(repo, ["userID", U1], {
        claimedUserID: U1,
        claimedSubjectID: S1,
        episodeID: S1E1,
        score: 7,
      });
      expect(resp).toEqual(["ok", {
        score: 7,
        // TODO: 也许 `visibility` 应该恒不为空，第一次时返回
        // `{ is_visible: false }`？组件那边的处理则是：如果不可见，但是自己的吐
        // 槽数为 0，则视为尚未设置可见性？
        visibility: null,
      }]);
      expect(await repo.getEpisodeInfo(S1E1)).toEqual({ subjectID: S1 });
      const rating = (await repo.getUserEpisodeRatingResult(U1, S1, S1E1))
        .value;
      expect(rating?.score).toBe(7);
      expect(rating?.isVisible).toBe(false);
      expect(rating?.history).toEqual([]);
      expect(await repo.getAllEpisodeVotesGroupedByScore(S1, S1E1))
        .toEqual({ 7: 1 });
      expect(await repo.getAllEpisodePublicVotersGroupedByScore(S1, S1E1))
        .toEqual({});
    } finally {
      resetFetch();
    }

    {
      const resp = await rateEpisode(repo, ["userID", U1], {
        claimedUserID: U1,
        claimedSubjectID: S1,
        episodeID: S1E1,
        score: null,
      });
      expect(resp).toEqual(["ok", {
        score: null,
        visibility: { is_visible: false },
      }]);
      const rating = (await repo.getUserEpisodeRatingResult(U1, S1, S1E1))
        .value;
      expect(rating?.score).toBe(null);
      expect(rating?.isVisible).toBe(false);
      expect(rating?.history.length).toBe(1);
      expect(rating?.history[0].score).toBe(7);
      expect(await repo.getAllEpisodeVotesGroupedByScore(S1, S1E1))
        .toEqual({});
      expect(await repo.getAllEpisodePublicVotersGroupedByScore(S1, S1E1))
        .toEqual({});
    }
  });
});

describe("function changeUserEpisodeRatingVisibility", () => {
  it("在尚未评分时就尝试改变可见性时，返回错误", async () => {
    try {
      mockFetch(`https://api.bgm.tv/v0/episodes/${S1E1}`, {
        body: JSON.stringify({ subject_id: S1 }),
      });
      const result = await changeUserEpisodeRatingVisibility(
        repo,
        ["userID", U1],
        {
          claimedUserID: U1,
          claimedSubjectID: S1,
          episodeID: S1E1,
          isVisible: true,
        },
      );
      expect(result[0]).toBe("error");
    } finally {
      resetFetch();
    }
  });

  it("works", async () => {
    // TODO!!!
  });
});
