import {
  APIResponse,
  ChangeUserEpisodeRatingVisibilityResponseData,
  RateEpisodeResponseData,
} from "@/shared/dto.ts";
import {
  EpisodeID,
  SubjectID,
  UserID,
  UserSubjectEpisodeRatingData,
} from "@/types.ts";
import { APIErrorResponse } from "@/shared/dto.ts";
import { Repo } from "@/repo/mod.ts";
import { BangumiClient } from "@/bangumi-client.ts";

export async function rateEpisode(
  repo: Repo,
  bangumiClient: BangumiClient,
  userID: UserID | null,
  opts: {
    claimedSubjectID: SubjectID;
    episodeID: EpisodeID;
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

  if (userID === null) return ["auth_required"];

  const checkSubjectIDResult = checkSubjectID({
    subjectID: await fetchSubjectID(repo, bangumiClient, opts),
    claimedSubjectID: opts.claimedSubjectID,
    episodeID: opts.episodeID,
  });
  if (checkSubjectIDResult[0] !== "ok") return checkSubjectIDResult;
  const subjectID = checkSubjectIDResult[1];

  let scoreDelta = opts.score ?? 0;

  let isOk: boolean;

  let oldRating!: UserSubjectEpisodeRatingData | null;
  isOk = false;
  while (!isOk) {
    const oldRatingResult = await repo
      .getUserEpisodeRatingResult(userID, subjectID, opts.episodeID);
    oldRating = oldRatingResult.value;

    if (oldRating && oldRating.score === opts.score) {
      return ["ok", {
        score: opts.score,
        visibility: opts.score !== null
          ? { is_visible: !!oldRating.isVisible }
          : null,
      }];
    }

    const nowMs = Date.now();

    const userRatingData: UserSubjectEpisodeRatingData = {
      score: opts.score,
      isVisible: oldRating?.isVisible ?? false,
      submittedAtMs: nowMs,
    };
    if (oldRating) {
      scoreDelta -= oldRating.score ?? 0;
    }

    const result = await repo.tx((tx) => {
      if (oldRating && oldRating.isVisible) {
        if (
          userRatingData.score === null &&
          oldRating.score !== null
        ) {
          tx.deleteSubjectEpisodeScorePublicVoter //
          (subjectID, opts.episodeID, oldRating.score, userID);
        } else if (userRatingData.score !== null) {
          tx.setSubjectEpisodeScorePublicVoter //
          (subjectID, opts.episodeID, userRatingData.score, userID);
        }
      }

      tx.setUserEpisodeRating //
      (userID, subjectID, opts.episodeID, userRatingData, oldRatingResult);
      tx.insertUserTimelineItem(userID, nowMs, ["rate-episode", {
        episodeID: opts.episodeID,
        score: userRatingData.score,
      }]);
    });
    isOk = result.ok;
  }

  isOk = false;
  while (!isOk) {
    const result = await repo.tx((tx) => {
      if (opts.score !== null) {
        tx.increaseSubjectEpisodeScoreVotes //
        (subjectID, opts.episodeID, opts.score);
      }
      if (oldRating && oldRating.score !== null) {
        tx.decreaseSubjectEpisodeScoreVotes //
        (subjectID, opts.episodeID, oldRating.score);
      }
    });
    isOk = result.ok;
  }

  return ["ok", {
    score: opts.score,
    visibility: oldRating ? { is_visible: oldRating.isVisible ?? false } : null,
  }];
}

export async function changeUserEpisodeRatingVisibility(
  repo: Repo,
  bangumiClient: BangumiClient,
  userID: UserID | null,
  opts: {
    claimedSubjectID: SubjectID;
    episodeID: EpisodeID;
    isVisible: boolean;
  },
): Promise<APIResponse<ChangeUserEpisodeRatingVisibilityResponseData>> {
  if (userID === null) return ["auth_required"];

  const checkSubjectIDResult = checkSubjectID({
    subjectID: await fetchSubjectID(repo, bangumiClient, opts),
    claimedSubjectID: opts.claimedSubjectID,
    episodeID: opts.episodeID,
  });
  if (checkSubjectIDResult[0] !== "ok") return checkSubjectIDResult;
  const subjectID = checkSubjectIDResult[1];

  let isOk: boolean;

  isOk = false;
  while (!isOk) {
    const userRatingResult = await repo
      .getUserEpisodeRatingResult(userID, subjectID, opts.episodeID);
    const userRatingData = userRatingResult.value;
    if (userRatingData === null) {
      return [
        "error",
        "NOT_RATED_YET",
        "既然还没有评分，那就应该不会涉及到其可见性，为什么会执行到这里…？",
      ];
    }
    if (!!userRatingData.isVisible === opts.isVisible) break;

    userRatingData.isVisible = opts.isVisible;

    const result = await repo.tx((tx) => {
      if (userRatingData.score !== null) {
        if (opts.isVisible) {
          tx.setSubjectEpisodeScorePublicVoter //
          (subjectID, opts.episodeID, userRatingData.score, userID);
        } else {
          tx.deleteSubjectEpisodeScorePublicVoter //
          (subjectID, opts.episodeID, userRatingData.score, userID);
        }
      }

      tx.setUserEpisodeRating //
      (userID, subjectID, opts.episodeID, userRatingData, userRatingResult);
    });
    isOk = result.ok;
  }

  return ["ok", { is_visible: opts.isVisible }];
}

async function fetchSubjectID(
  repo: Repo,
  bangumiClient: BangumiClient,
  opts: { episodeID: EpisodeID },
): Promise<SubjectID | null> {
  const episodeInfo = await repo.getEpisodeInfo(opts.episodeID);
  if (episodeInfo) return episodeInfo.subjectID;

  const episodeData = await bangumiClient.getEpisode(opts.episodeID);
  if (!episodeData) return null;

  const subjectID = episodeData.subject_id as SubjectID;
  await repo.setEpisodeInfo(opts.episodeID, { subjectID });

  return subjectID;
}

function checkSubjectID(opts: {
  subjectID: SubjectID | null;
  claimedSubjectID: SubjectID;

  episodeID: EpisodeID;
}): ["ok", SubjectID] | APIErrorResponse {
  if (opts.subjectID === null) {
    return [
      "error",
      "UNABLE_TO_VERIFY_THAT_EPISODE_IS_IN_SUBJECT",
      "服务器无法验证当前剧集是否属于当前条目…（可能是因为当前条目属于受限内容）",
    ];
  } else if (opts.subjectID !== opts.claimedSubjectID) {
    return [
      "error",
      "EPISODE_NOT_IN_SUBJECT",
      `剧集 ${opts.episodeID} 并不属于 ${opts.claimedSubjectID}，而是属于 ${opts.subjectID}。为啥会出现这种情况…？`,
    ];
  }

  return ["ok", opts.subjectID];
}
