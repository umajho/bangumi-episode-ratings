import { APIResponse, RateEpisodeResponseData } from "../shared/dto.ts";
import * as KVUtils from "../kv-utils.ts";
import env from "../env.ts";
import { EpisodeInfoData, UserSubjectEpisodeRatingData } from "../types.ts";
import { bangumiClient } from "../global.ts";
import { matchTokenOrUserID } from "./utils.ts";

export async function rateEpisode(
  kv: Deno.Kv | null,
  tokenOrUserID: ["token", string | null] | ["userID", number],
  opts: {
    claimedUserID: number;
    claimedSubjectID: number;
    episodeID: number;
    score: number | null;
  },
): Promise<APIResponse<RateEpisodeResponseData>> {
  if (opts.score !== null) {
    if (!Number.isInteger(opts.score) || opts.score < 1 || opts.score > 10) {
      return [
        "error",
        "BAD_SCORE",
        "评分在可接受范围（null 或 0.9 至 10.1 之间的整数）之外。How？",
      ];
    }
  }

  kv ??= await Deno.openKv();

  const userID = await matchTokenOrUserID(kv, tokenOrUserID, opts);

  if (userID === null || opts.claimedUserID !== userID) {
    if (opts.claimedUserID !== userID) {
      // TODO: 无效化 token。
    }
    return ["auth_required"];
  }

  const subjectID = await (async (): Promise<number | null> => {
    const episodeInfoKey = env.buildKVKeyEpisodeInfo(opts.episodeID);
    const episodeInfo = await kv.get<EpisodeInfoData>(episodeInfoKey);
    if (episodeInfo.value) return episodeInfo.value.subjectID;

    const episodeData = await bangumiClient.getEpisode(opts.episodeID);
    if (!episodeData) return null;

    const subjectID = episodeData.subject_id;
    await kv.set(episodeInfoKey, { subjectID } satisfies EpisodeInfoData);

    return subjectID;
  })();
  if (subjectID === null) {
    return [
      "error",
      "UNABLE_TO_VERIFY_THAT_EPISODE_IS_IN_SUBJECT",
      "服务器无法验证当前剧集是否属于当前条目…（可能是因为当前条目属于受限内容）",
    ];
  }

  if (subjectID !== opts.claimedSubjectID) {
    return [
      "error",
      "EPISODE_NOT_IN_SUBJECT",
      `剧集 ${opts.episodeID} 并不属于 ${opts.claimedSubjectID}，而是属于 ${subjectID}。为啥会出现这种情况…？`,
    ];
  }

  let scoreDelta = opts.score ?? 0;

  const userSubjectEpisodeRatingKey = //
    env.buildKVKeyUserSubjectEpisodeRating(userID, subjectID, opts.episodeID);
  const oldRatingResult = //
    await kv.get<UserSubjectEpisodeRatingData>(userSubjectEpisodeRatingKey);

  if (oldRatingResult.value && oldRatingResult.value.score === opts.score) {
    return ["ok", { score: opts.score }];
  }

  const userRatingData: UserSubjectEpisodeRatingData = {
    score: opts.score,
    submittedAtMs: Date.now(),
    history: oldRatingResult.value?.history || [],
  };
  if (oldRatingResult.value) {
    const oldRating = oldRatingResult.value;
    scoreDelta -= oldRating.score ?? 0;
    userRatingData.history.push({
      score: oldRating.score,
      submittedAtMs: oldRating.submittedAtMs,
    });
  }

  let isOk: boolean;

  isOk = false;
  while (!isOk) {
    const result = await kv.atomic()
      .check(oldRatingResult)
      .set(userSubjectEpisodeRatingKey, userRatingData).commit();
    isOk = result.ok;
  }

  isOk = false;
  while (!isOk) {
    let tx = kv.atomic();
    if (opts.score !== null) {
      const key = env.buildKVKeySubjectEpisodeScoreVotes(
        subjectID,
        opts.episodeID,
        opts.score,
      );
      tx = tx.sum(key, 1n);
    }
    if (oldRatingResult.value && oldRatingResult.value.score !== null) {
      const key = env.buildKVKeySubjectEpisodeScoreVotes(
        subjectID,
        opts.episodeID,
        oldRatingResult.value.score,
      );
      tx = KVUtils.sumFreely(tx, key, -1n);
    }
    const result = await tx.commit();
    isOk = result.ok;
  }

  return ["ok", { score: opts.score }];
}
