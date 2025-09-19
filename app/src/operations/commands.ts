import { APIResponse, RateEpisodeResponseData } from "@/shared/dto.ts";
import {
  EpisodeID,
  SubjectID,
  UserID,
  UserSubjectEpisodeRatingData,
} from "@/types.ts";
import { APIErrorResponse } from "@/shared/dto.ts";
import { Repo } from "@/repo/mod.ts";
import { BangumiClient } from "@/bangumi-client.ts";
import { makeErrorAuthRequiredResponse } from "@/responding.tsx";

export async function patchEpisodeRating(
  repo: Repo,
  bangumiClient: BangumiClient,
  userID: UserID | null,
  opts: {
    claimedSubjectID: SubjectID;
    episodeID: EpisodeID;
    score?: number | null;
    isVisible?: boolean;
  },
): Promise<APIResponse<RateEpisodeResponseData>> {
  if (opts.score != null) { // NOTE: `==` for both `null` and `undefined`.
    if (!Number.isInteger(opts.score) || opts.score < 1 || opts.score > 10) {
      return [
        "error",
        "BAD_SCORE",
        "评分在可接受范围（null 或 0.9 至 10.1 之间的整数）之外。How？",
      ];
    }
  }

  if (userID === null) return makeErrorAuthRequiredResponse();

  const checkSubjectIDResult = checkSubjectID({
    subjectIDResult: await fetchSubjectID(repo, bangumiClient, opts),
    claimedSubjectID: opts.claimedSubjectID,
    episodeID: opts.episodeID,
  });
  if (checkSubjectIDResult[0] !== "ok") return checkSubjectIDResult;
  const subjectID = checkSubjectIDResult[1];

  let isOk: boolean;

  let oldRatingScore!: number | null;
  let newRatingScore!: number | null;
  let newRatingIsVisible!: boolean;

  isOk = false;
  while (!isOk) {
    const oldRatingResult = await repo
      .getUserEpisodeRatingResult(userID, subjectID, opts.episodeID);
    const oldRating = oldRatingResult.value;

    oldRatingScore = oldRating?.score ?? null;
    newRatingScore = opts.score === undefined ? oldRatingScore : opts.score;
    const oldRatingIsVisible = oldRating?.isVisible ?? true;
    newRatingIsVisible = opts.isVisible === undefined
      ? oldRatingIsVisible
      : opts.isVisible;

    if (
      oldRatingScore === newRatingScore &&
      oldRatingIsVisible === newRatingIsVisible
    ) {
      return ["ok", {
        score: oldRatingScore,
        visibility: { is_visible: oldRatingIsVisible },
      }];
    }

    const nowMs = Date.now();

    const userRatingData: UserSubjectEpisodeRatingData = {
      score: newRatingScore,
      isVisible: newRatingIsVisible,
      submittedAtMs: nowMs,
    };

    const result = await repo.tx((tx) => {
      if (!oldRatingIsVisible && !newRatingIsVisible) {
        // noop
      } else if (oldRatingIsVisible && !newRatingIsVisible) {
        if (oldRatingScore) {
          tx.deleteSubjectEpisodeScorePublicVoter //
          (subjectID, opts.episodeID, oldRatingScore, userID);
        }
      } else if (!oldRatingIsVisible && newRatingIsVisible) {
        if (newRatingScore) {
          tx.setSubjectEpisodeScorePublicVoter //
          (subjectID, opts.episodeID, newRatingScore, userID);
        }
      } else { // oldRatingIsVisible && newRatingIsVisible
        if (oldRatingScore !== newRatingScore) {
          if (oldRatingScore) {
            tx.deleteSubjectEpisodeScorePublicVoter //
            (subjectID, opts.episodeID, oldRatingScore, userID);
          }
          if (newRatingScore) {
            tx.setSubjectEpisodeScorePublicVoter //
            (subjectID, opts.episodeID, newRatingScore, userID);
          }
        }
      }

      tx.setUserEpisodeRating //
      (userID, subjectID, opts.episodeID, userRatingData, oldRatingResult);
      if (opts.score !== undefined) {
        tx.insertUserTimelineItem(userID, nowMs, ["rate-episode", {
          episodeID: opts.episodeID,
          score: userRatingData.score,
        }]);
      }
    });
    isOk = result.ok;
  }

  if (oldRatingScore !== newRatingScore) {
    isOk = false;
    while (!isOk) {
      const result = await repo.tx((tx) => {
        if (newRatingScore !== null) {
          tx.increaseSubjectEpisodeScoreVotes //
          (subjectID, opts.episodeID, newRatingScore);
        }
        if (oldRatingScore !== null) {
          tx.decreaseSubjectEpisodeScoreVotes //
          (subjectID, opts.episodeID, oldRatingScore);
        }
      });
      isOk = result.ok;
    }
  }

  return ["ok", {
    score: newRatingScore,
    visibility: { is_visible: newRatingIsVisible },
  }];
}

/**
 * TODO: 也许原本就不存在时可以返回错误？
 */
export async function deleteUserTimeLineItem(
  repo: Repo,
  userID: UserID | null,
  opts: {
    timestampMs: number;
  },
): Promise<APIResponse<null>> {
  if (userID === null) return makeErrorAuthRequiredResponse();

  await repo.deleteUserTimelineItem(userID, opts.timestampMs);

  return ["ok", null];
}

async function fetchSubjectID(
  repo: Repo,
  bangumiClient: BangumiClient,
  opts: { episodeID: EpisodeID },
): Promise<["ok", SubjectID] | ["error", { userFacingMessage?: string }]> {
  const episodeInfo = await repo.getEpisodeInfo(opts.episodeID);
  if (episodeInfo) return ["ok", episodeInfo.subjectID];

  const episodeResp = await bangumiClient.getEpisode(opts.episodeID);
  if (episodeResp[0] === "error") return episodeResp;

  episodeResp[0] satisfies "ok";
  const [_, episodeData] = episodeResp;

  const subjectID = episodeData.subject_id as SubjectID;
  await repo.setEpisodeInfo(opts.episodeID, { subjectID });

  return ["ok", subjectID];
}

function checkSubjectID(opts: {
  subjectIDResult:
    | ["ok", SubjectID]
    | ["error", { userFacingMessage?: string }];
  claimedSubjectID: SubjectID;

  episodeID: EpisodeID;
}): ["ok", SubjectID] | APIErrorResponse {
  if (opts.subjectIDResult[0] === "error") {
    const [_, details] = opts.subjectIDResult;

    let message = "服务器无法验证当前剧集是否属于当前条目";
    if (details.userFacingMessage) {
      message += `：${details.userFacingMessage}`;
    } else {
      message += "…（可能是因为当前条目属于受限内容）";
    }
    return ["error", "UNABLE_TO_VERIFY_THAT_EPISODE_IS_IN_SUBJECT", message];
  }

  opts.subjectIDResult[0] satisfies "ok";
  const [_, subjectID] = opts.subjectIDResult;

  if (subjectID !== opts.claimedSubjectID) {
    return [
      "error",
      "EPISODE_NOT_IN_SUBJECT",
      `剧集 ${opts.episodeID} 并不属于 ${opts.claimedSubjectID}，而是属于 ${subjectID}。为啥会出现这种情况…？`,
    ];
  }

  return ["ok", subjectID];
}
