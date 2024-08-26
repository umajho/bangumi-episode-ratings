import { Router, RouterContext } from "jsr:@oak/oak@14";

import {
  EpisodeInfoData,
  StateForAPI,
  UserSubjectEpisodeRatingData,
} from "../../../types.ts";
import ENDPOINT_PATHS from "../../../shared/endpoint-paths.ts";
import {
  APIResponse,
  GetEpisodeRatingsResponseData,
  GetEpisodeRatingsResponseData__Until_0_1_13,
  GetMyEpisodeRatingResponseData,
  GetSubjectEpisodesResponseData,
  RateEpisodeRequestData,
  RateEpisodeResponseData,
} from "../../../shared/dto.ts";
import * as KVUtils from "../../../kv-utils.ts";
import {
  stringifyErrorResponseForAPI,
  stringifyOkResponseForAPI,
  stringifyResponseForAPI,
} from "../../../responses.tsx";
import env from "../../../env.ts";
import { bangumiClient } from "../../../global.ts";

export const router = new Router<StateForAPI>();
export default router;

router.post("/" + ENDPOINT_PATHS.API.V0.RATE_EPISODE, async (ctx) => {
  const data = await ctx.request.body.json() as RateEpisodeRequestData;

  if (data.score !== null) {
    if (!Number.isInteger(data.score) || data.score < 1 || data.score > 10) {
      ctx.response.body = stringifyErrorResponseForAPI(
        "BAD_SCORE",
        "评分在可接受范围（null 或 0.9 至 10.1 之间的整数）之外。How？",
      );
    }
  }

  const kv = await Deno.openKv();

  const userID = await KVUtils.getUserID(kv, ctx.state.token);
  if (!userID || data.claimed_user_id !== userID) {
    if (data.claimed_user_id !== userID) {
      // TODO: 无效化 token。
    }
    ctx.response.body = stringifyResponseForAPI(["auth_required"]);
    return;
  }

  let episodeSubjectID: number;
  {
    const episodeInfoKey = env.buildKVKeyEpisodeInfo(data.episode_id);
    const episodeInfo = await kv.get<EpisodeInfoData>(episodeInfoKey);
    if (episodeInfo.value) {
      episodeSubjectID = episodeInfo.value.subjectID;
    } else {
      const episodeData = await bangumiClient.getEpisode(data.episode_id);
      if (!episodeData) {
        ctx.response.body = stringifyErrorResponseForAPI(
          "UNABLE_TO_VERIFY_THAT_EPISODE_IS_IN_SUBJECT",
          "服务器无法验证当前剧集是否属于当前条目…（可能是因为当前条目属于受限内容）",
        );
        return;
      }
      episodeSubjectID = episodeData.subject_id;

      await kv.set(
        episodeInfoKey,
        { subjectID: episodeSubjectID } satisfies EpisodeInfoData,
      );
    }
  }

  if (episodeSubjectID !== data.subject_id) {
    ctx.response.body = stringifyErrorResponseForAPI(
      "EPISODE_NOT_IN_SUBJECT",
      `剧集 ${data.episode_id} 并不属于 ${data.subject_id}。为啥会出现这种情况…？`,
    );
    return;
  }

  let episodeScoreDelta = data.score ?? 0;

  const userSubjectEpisodeRatingKey = env.buildKVKeyUserSubjectEpisodeRating(
    data.claimed_user_id,
    data.subject_id,
    data.episode_id,
  );
  const oldRatingResult = //
    await kv.get<UserSubjectEpisodeRatingData>(userSubjectEpisodeRatingKey);

  if (oldRatingResult.value && oldRatingResult.value.score === data.score) {
    ctx.response.body = stringifyOkResponseForAPI<RateEpisodeResponseData>({
      score: data.score,
    });
    return;
  }

  const userRatingData: UserSubjectEpisodeRatingData = {
    score: data.score,
    submittedAtMs: Date.now(),
    history: oldRatingResult.value?.history || [],
  };
  if (oldRatingResult.value) {
    const oldRating = oldRatingResult.value;
    episodeScoreDelta -= oldRating.score ?? 0;
    userRatingData.history.push({
      score: oldRating.score,
      submittedAtMs: oldRating.submittedAtMs,
    });
  }

  {
    let isOk = false;
    while (!isOk) {
      const result = await kv.atomic()
        .check(oldRatingResult)
        .set(userSubjectEpisodeRatingKey, userRatingData).commit();
      isOk = result.ok;
    }
  }

  {
    let isOk = false;
    while (!isOk) {
      let tx = kv.atomic();
      if (data.score !== null) {
        const key = env.buildKVKeySubjectEpisodeScoreVotes(
          data.subject_id,
          data.episode_id,
          data.score,
        );
        tx = tx.sum(key, 1n);
      }
      if (oldRatingResult.value && oldRatingResult.value.score !== null) {
        const key = env.buildKVKeySubjectEpisodeScoreVotes(
          data.subject_id,
          data.episode_id,
          oldRatingResult.value.score,
        );
        tx = KVUtils.sumFreely(tx, key, -1n);
      }
      const result = await tx.commit();
      isOk = result.ok;
    }
  }

  ctx.response.body = stringifyOkResponseForAPI<RateEpisodeResponseData>({
    score: data.score,
  });
});

router.get(
  "/" + ENDPOINT_PATHS.API.V0.SUBJECT_EPISODES_RATINGS,
  async (ctx) => {
    const claimedUserID = //
      tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id");
    const subjectID = tryExtractNumberFromCTXSearchParams(ctx, "subject_id");

    if (!subjectID) {
      ctx.response.body = //
        stringifyErrorResponseForAPI("BAD_REQUEST", "参数有误。");
      return;
    }

    const kv = await Deno.openKv();

    const LIMIT = 1000;
    const episodesVotes: {
      [episodeID: number]: { [score: number]: number } | null;
    } = {};
    let lastEpisodeID: number | null = null;
    let count = 0;
    for await (
      const result of kv.list({
        prefix: env.buildKVPrefixSubjectEpisodeScoreVotes([subjectID]),
      }, { limit: LIMIT })
    ) {
      count++;

      const episodeID = result.key.at(-2) as number;
      lastEpisodeID = episodeID;

      const score = result.key.at(-1) as number;

      const scoreVotes = result.value as Deno.KvU64;
      if (scoreVotes.value) {
        const votes = episodesVotes[episodeID] ??
          (episodesVotes[episodeID] = {});
        votes[score] = Number(scoreVotes.value);
      } else if (!episodesVotes[episodeID]) {
        episodesVotes[episodeID] = null;
      }
    }

    const isCertainThatEpisodesVotesAreIntegral = count < LIMIT;
    if (
      !isCertainThatEpisodesVotesAreIntegral &&
      episodesVotes[lastEpisodeID!] &&
      !(10 in episodesVotes[lastEpisodeID!]!)
    ) {
      // `list` 返回的结果可能被截取了，靠最后的那一集的评分投票数据可能因此而不完整，故而删去。
      delete episodesVotes[lastEpisodeID!];
    }

    const data: GetSubjectEpisodesResponseData = {
      episodes_votes: episodesVotes,
      is_certain_that_episodes_votes_are_integral:
        isCertainThatEpisodesVotesAreIntegral,
    };

    if (ctx.state.token) {
      const userID = await KVUtils.getUserID(kv, ctx.state.token);
      if (userID && claimedUserID === userID) {
        data.my_ratings = {};

        const prefix = env
          .buildKVPrefixUserSubjectEpisodeRating([userID, subjectID]);

        for await (
          const result of kv.list<UserSubjectEpisodeRatingData>({ prefix })
        ) {
          const episodeID = result.key.at(-1) as number;
          if (result.value.score !== null) {
            data.my_ratings[episodeID] = result.value.score;
          }
        }
      }
    }

    ctx.response.body = stringifyOkResponseForAPI(data);
  },
);

router.get("/" + ENDPOINT_PATHS.API.V0.EPISODE_RATINGS, async (ctx) => {
  const claimedUserID = //
    tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id");
  const subjectID = tryExtractNumberFromCTXSearchParams(ctx, "subject_id");
  const episodeID = tryExtractNumberFromCTXSearchParams(ctx, "episode_id");

  if (!subjectID || !episodeID) {
    ctx.response.body = stringifyErrorResponseForAPI(
      "BAD_REQUEST",
      "参数有误。",
    );
    return;
  }

  const kv = await Deno.openKv();

  const votes: { [score: number]: number } = {};
  for await (
    const result of kv.list({
      prefix: env.buildKVPrefixSubjectEpisodeScoreVotes([subjectID, episodeID]),
    })
  ) {
    const score = result.key.at(-1) as number;

    const scoreVotes = result.value as Deno.KvU64;
    if (scoreVotes.value) {
      votes[score] = Number(scoreVotes.value);
    }
  }

  const data: GetEpisodeRatingsResponseData = { votes };

  if (ctx.state.token) {
    const userID = await KVUtils.getUserID(kv, ctx.state.token);
    const result = await getMyRating({
      kv,
      claimedUserID,
      userID,
      subjectID,
      episodeID,
    });
    if (result[0] === "ok") {
      data.my_rating = result[1];
    } else if (result[0] === "auth_required") {
      // 用不设置 `data.myRating` 来表示需要认证。
    } else {
      ctx.response.body = stringifyResponseForAPI(result);
      return;
    }
  }

  if (!ctx.state.gadgetVersion || ctx.state.gadgetVersion < 1_004) { // < 0.1.4
    const dataOld: GetEpisodeRatingsResponseData__Until_0_1_13 = {
      votes: data.votes,
      ...(data.my_rating ? { userScore: data.my_rating.score } : {}),
    };
    ctx.response.body = stringifyOkResponseForAPI(dataOld);
  } else {
    ctx.response.body = stringifyOkResponseForAPI(data);
  }
});

router.get("/" + ENDPOINT_PATHS.API.V0.MY_EPISODE_RATING, async (ctx) => {
  const claimedUserID = //
    tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id");
  const subjectID = tryExtractNumberFromCTXSearchParams(ctx, "subject_id");
  const episodeID = tryExtractNumberFromCTXSearchParams(ctx, "episode_id");

  if (!subjectID || !episodeID) {
    ctx.response.body = stringifyErrorResponseForAPI(
      "BAD_REQUEST",
      "参数有误。",
    );
    return;
  }

  const kv = await Deno.openKv();
  const userID = await KVUtils.getUserID(kv, ctx.state.token);

  ctx.response.body = stringifyResponseForAPI(
    await getMyRating({
      kv,
      claimedUserID,
      userID,
      subjectID,
      episodeID,
    }),
  );
});

async function getMyRating(
  opts: {
    kv: Deno.Kv;
    claimedUserID: number | null;
    userID: number | null;
    subjectID: number;
    episodeID: number;
  },
): Promise<APIResponse<GetMyEpisodeRatingResponseData>> {
  if (!opts.userID || opts.claimedUserID !== opts.userID) {
    return ["auth_required"];
  }

  const userSubjectEpisodeRatingKey = env.buildKVKeyUserSubjectEpisodeRating(
    opts.userID,
    opts.subjectID,
    opts.episodeID,
  );

  const ratingResult = await opts.kv.get<UserSubjectEpisodeRatingData>(
    userSubjectEpisodeRatingKey,
  );

  return ["ok", {
    score: ratingResult.value?.score ?? null,
  }];
}

function tryExtractNumberFromCTXSearchParams(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, any>,
  key: string,
): number | null {
  const raw = ctx.request.url.searchParams.get(key);
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}
