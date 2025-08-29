import { Repo } from "@/repo/mod.ts";
import {
  APIResponse,
  GetEpisodePublicRatingsResponseData,
  GetEpisodeRatingsResponseData,
  GetEpisodeRatingsResponseData__Until_0_3_0,
  GetMyEpisodeRatingResponseData,
  GetSubjectEpisodesResponseData,
  GetSubjectEpisodesResponseData_Until_0_5_0,
  GetUserEpisodeRatingsResponseData,
  GetUserTimeLineItemsResponseData,
  UserTimelineItemResponseData,
} from "@/shared/dto.ts";
import { EpisodeID, SubjectID, UserID } from "@/types.ts";
import { makeErrorAuthRequiredResponse } from "@/responding.tsx";

export async function querySubjectEpisodesRatings(
  repo: Repo,
  userID: UserID | null,
  opts: {
    subjectID: SubjectID;

    compatibility: {
      withIntegralityBoolean: boolean;
    };
  },
): Promise<
  APIResponse<
    GetSubjectEpisodesResponseData | GetSubjectEpisodesResponseData_Until_0_5_0
  >
> {
  const { votesByScoreBySubject } = //
    await repo.getAllEpisodesVotesInSubjectGroupedByScoreAndEpisodeEx(
      opts.subjectID,
    );

  const data: GetSubjectEpisodesResponseData = {
    episodes_votes: votesByScoreBySubject,
  };
  if (opts.compatibility.withIntegralityBoolean) {
    (data as GetSubjectEpisodesResponseData_Until_0_5_0)
      .is_certain_that_episodes_votes_are_integral = true;
  }

  if (userID !== null) {
    data.my_ratings = await repo.getUserEpisodesRatingsUnderSubject(
      userID,
      opts.subjectID,
    );
  }

  return ["ok", data];
}

export async function queryEpisodeRatings(
  repo: Repo,
  userID: UserID | null,
  opts: {
    subjectID: SubjectID;
    episodeID: EpisodeID;

    compatibility: {
      noPublicRatings: boolean;
    };
  },
): Promise<
  APIResponse<
    GetEpisodeRatingsResponseData | GetEpisodeRatingsResponseData__Until_0_3_0
  >
> {
  const votes = await repo
    .getAllEpisodeVotesGroupedByScore(opts.subjectID, opts.episodeID);

  const publicRatingsResult: APIResponse<
    GetEpisodePublicRatingsResponseData | null
  > = opts.compatibility.noPublicRatings
    ? ["ok", null]
    : await queryEpisodePublicRatings(repo, opts);
  if (publicRatingsResult[0] !== "ok") return publicRatingsResult;

  const data:
    | GetEpisodeRatingsResponseData
    | GetEpisodeRatingsResponseData__Until_0_3_0 = { votes };

  if (publicRatingsResult[1] !== null) {
    (data as GetEpisodeRatingsResponseData).public_ratings =
      publicRatingsResult[1];
  }

  if (userID !== null) {
    const myRatingResult = await queryEpisodeMyRating(repo, userID, opts);
    if (myRatingResult[0] !== "ok") return myRatingResult;
    data.my_rating = myRatingResult[1];
  }

  return ["ok", data];
}

/**
 * @deprecated since gadget 0.7.0.
 */
export async function queryEpisodeMyRating(
  repo: Repo,
  userID: UserID | null,
  opts: {
    subjectID: SubjectID;
    episodeID: EpisodeID;
  },
): Promise<APIResponse<GetMyEpisodeRatingResponseData>> {
  if (userID === null) return makeErrorAuthRequiredResponse();

  const ratingResult = await repo.getUserEpisodeRatingResult //
  (userID, opts.subjectID, opts.episodeID);

  return ["ok", {
    score: ratingResult.value?.score ?? null,
    visibility: ratingResult.value
      ? { is_visible: ratingResult.value.isVisible ?? false }
      : null,
  }];
}

export async function queryEpisodePublicRatings(
  repo: Repo,
  opts: { subjectID: SubjectID; episodeID: EpisodeID },
): Promise<APIResponse<GetEpisodePublicRatingsResponseData>> {
  const votersByScore = await repo.getAllEpisodePublicVotersGroupedByScore //
  (opts.subjectID, opts.episodeID);

  return ["ok", { public_voters_by_score: votersByScore }];
}

/**
 * XXX: `offset` 的效率很差。
 * XXX: 由于 Deno KV 的限制，`limit` 不应大于 10。
 */
export async function queryUserTimeLineItems(
  repo: Repo,
  userID: UserID | null,
  opts: { offset: number; limit: number },
): Promise<APIResponse<GetUserTimeLineItemsResponseData>> {
  if (userID === null) return makeErrorAuthRequiredResponse();

  const items = await repo.getUserTimelineItems(userID, {
    offset: opts.offset,
    limit: opts.limit,
  });

  const itemDataList: UserTimelineItemResponseData[] = [];
  const episodeIDs: Set<EpisodeID> = new Set();
  for (const item of items) {
    switch (item[1]) {
      case "rate-episode":
        episodeIDs.add(item[2].episodeID);
        itemDataList.push([item[0], "rate-episode", {
          episode_id: item[2].episodeID,
          score: item[2].score,
        }]);
        break;
      default:
        item[1] satisfies never;
    }
  }

  const infos = await repo.getManyEpisodeInfos(episodeIDs);

  const subjectsData: GetUserTimeLineItemsResponseData["subjects"] = {};
  for (const [episodeID_, info] of Object.entries(infos)) {
    const episodeID = Number(episodeID_);
    const subjectID = info.subjectID;

    const subjectData = (subjectsData[subjectID] ??= { episode_ids: [] });
    subjectData.episode_ids.push(episodeID);
  }

  const data: GetUserTimeLineItemsResponseData = {
    items: itemDataList,
    subjects: subjectsData,
  };

  return ["ok", data];
}

export async function queryUserEpisodeRatings(
  repo: Repo,
  userID: UserID | null,
): Promise<APIResponse<GetUserEpisodeRatingsResponseData>> {
  if (userID === null) return makeErrorAuthRequiredResponse();

  const ratings = await repo.getUserAllEpisodesRatings(userID);
  return ["ok", { episode_to_score_map: ratings }];
}
