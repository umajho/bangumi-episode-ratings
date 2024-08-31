import { Repo } from "../repo/mod.ts";
import { GetEpisodeRatingsResponseData__Until_0_3_0 } from "../shared/dto.ts";
import {
  APIResponse,
  GetEpisodePublicRatingsResponseData,
  GetEpisodeRatingsResponseData,
  GetMyEpisodeRatingResponseData,
  GetSubjectEpisodesResponseData,
} from "../shared/dto.ts";
import { EpisodeID, SubjectID, UserID } from "../types.ts";

export async function querySubjectEpisodesRatings(
  repo: Repo,
  tokenOrUserID: ["token", string | null] | ["userID", UserID],
  opts: { claimedUserID: UserID | null; subjectID: SubjectID },
): Promise<APIResponse<GetSubjectEpisodesResponseData>> {
  const { votesByScoreBySubject, isCertainThatEpisodesVotesAreIntegral } = //
    await repo.getAllEpisodesVotesByScoreBySubjectEx(opts.subjectID);

  const userID = await repo.getUserIDEx(tokenOrUserID, opts);

  const data: GetSubjectEpisodesResponseData = {
    episodes_votes: votesByScoreBySubject,
    is_certain_that_episodes_votes_are_integral:
      isCertainThatEpisodesVotesAreIntegral,
  };

  if (userID !== null && opts.claimedUserID === userID) {
    data.my_ratings = await repo.getAllUserSubjectEpisodesRatings(
      userID,
      opts.subjectID,
    );
  }

  return ["ok", data];
}

export async function queryEpisodeRatings(
  repo: Repo,
  tokenOrUserID: ["token", string | null] | ["userID", UserID],
  opts: {
    claimedUserID: UserID | null;
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
    .getAllEpisodeVotesByScore(opts.subjectID, opts.episodeID);

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

  const userID = await repo.getUserIDEx(tokenOrUserID, opts);
  if (userID !== null && opts.claimedUserID === userID) {
    const myRatingResult = //
      await queryEpisodeMyRating(repo, ["userID", userID], opts);
    if (myRatingResult[0] !== "ok") return myRatingResult;
    data.my_rating = myRatingResult[1];
  }

  return ["ok", data];
}

export async function queryEpisodeMyRating(
  repo: Repo,
  tokenOrUserID: ["token", string | null] | ["userID", UserID],
  opts: {
    claimedUserID: UserID | null;
    subjectID: SubjectID;
    episodeID: EpisodeID;
  },
): Promise<APIResponse<GetMyEpisodeRatingResponseData>> {
  const userID = await repo.getUserIDEx(tokenOrUserID, opts);

  if (!userID || opts.claimedUserID !== userID) {
    return ["auth_required"];
  }

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
  const votersByScore = await repo.getAllEpisodePublicVotersByScore //
  (opts.subjectID, opts.episodeID);

  return ["ok", { public_voters_by_score: votersByScore }];
}
