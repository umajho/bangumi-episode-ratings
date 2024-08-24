import { Router, RouterContext } from "jsr:@oak/oak@14";

import {
  EpisodeInfoData,
  State,
  UserSubjectEpisodeRatingData,
} from "../../../types.ts";
import ENDPOINT_PATHS from "../../../shared/endpoint-paths.ts";
import {
  GetEpisodeRatingsResponseData,
  RateEpisodeRequestData,
  RateEpisodeResponseData,
} from "../../../shared/dto.ts";
import * as KVUtils from "../../../kv-utils.ts";
import {
  makeErrorAuthRequiredResponseForAPI,
  makeErrorResponseForAPI,
  makeOkResponseForAPI,
} from "../../../responses.tsx";
import env from "../../../env.ts";
import { bangumiClient } from "../../../global.ts";

export const router = new Router<State>();
export default router;

router.post("/" + ENDPOINT_PATHS.API.V0.RATE_EPISODE, async (ctx) => {
  const data = await ctx.request.body.json() as RateEpisodeRequestData;

  if (data.score !== null) {
    if (!Number.isInteger(data.score) || data.score < 1 || data.score > 10) {
      ctx.response.body = makeErrorResponseForAPI(
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
    ctx.response.body = makeErrorAuthRequiredResponseForAPI();
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
        ctx.response.body = makeErrorResponseForAPI(
          "UNABLE_TO_VERIFY_THAT_EPISODE_IS_IN_SUBJECT",
          "服务器无法验证当前剧集是否属于当前条目…",
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
    ctx.response.body = makeErrorResponseForAPI(
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
    ctx.response.body = makeOkResponseForAPI<RateEpisodeResponseData>({
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

  ctx.response.body = makeOkResponseForAPI<RateEpisodeResponseData>({
    score: data.score,
  });
});

router.get("/" + ENDPOINT_PATHS.API.V0.EPISODE_RATINGS, async (ctx) => {
  const claimedUserID = //
    tryExtractNumberFromCTXSearchParams(ctx, "claimed_user_id");
  const subjectID = tryExtractNumberFromCTXSearchParams(ctx, "subject_id");
  const episodeID = tryExtractNumberFromCTXSearchParams(ctx, "episode_id");

  if (!subjectID || !episodeID) {
    ctx.response.body = makeErrorResponseForAPI("BAD_REQUEST", "参数有误。");
    return;
  }

  const kv = await Deno.openKv();

  const votes: { [score: number]: number } = {};
  for await (
    const result of kv.list({
      prefix: env.buildKVPrefixSubjectEpisodeScoreVotes(subjectID, episodeID),
    })
  ) {
    const score = result.key.at(-1) as number;
    votes[score] = Number(result.value as Deno.KvU64);
  }

  const data: GetEpisodeRatingsResponseData = {
    votes,
  };

  if (ctx.state.token) {
    const userID = await KVUtils.getUserID(kv, ctx.state.token);
    if (userID && claimedUserID === userID) {
      const userSubjectEpisodeRatingKey = env
        .buildKVKeyUserSubjectEpisodeRating(
          userID,
          subjectID,
          episodeID,
        );

      const ratingResult = await kv.get<UserSubjectEpisodeRatingData>(
        userSubjectEpisodeRatingKey,
      );
      if (ratingResult.value?.score) {
        data.userScore = ratingResult.value.score;
      }
    }
  }

  ctx.response.body = makeOkResponseForAPI(data);
});

function tryExtractNumberFromCTXSearchParams(
  // deno-lint-ignore no-explicit-any
  ctx: RouterContext<string, any, State>,
  key: string,
): number | null {
  const raw = ctx.request.url.searchParams.get(key);
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}
