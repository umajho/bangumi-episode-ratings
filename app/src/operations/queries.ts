import env from "../env.ts";
import { GetEpisodeRatingsResponseData__Until_0_3_0 } from "../shared/dto.ts";
import {
  APIResponse,
  GetEpisodePublicRatingsResponseData,
  GetEpisodeRatingsResponseData,
  GetMyEpisodeRatingResponseData,
  GetSubjectEpisodesResponseData,
} from "../shared/dto.ts";
import { UserSubjectEpisodeRatingData } from "../types.ts";
import { matchTokenOrUserID } from "./utils.ts";

export async function querySubjectEpisodesRatings(
  kv: Deno.Kv,
  tokenOrUserID: ["token", string | null] | ["userID", number],
  opts: { claimedUserID: number | null; subjectID: number },
): Promise<APIResponse<GetSubjectEpisodesResponseData>> {
  const { episodesVotes, isCertainThatEpisodesVotesAreIntegral } =
    await (async () => {
      const LIMIT = 1000;
      const episodesVotes: {
        [episodeID: number]: { [score: number]: number } | null;
      } = {};
      let lastEpisodeID: number | null = null;
      let count = 0;
      for await (
        const result of kv.list({
          prefix: env.buildKVPrefixSubjectEpisodeScoreVotes([opts.subjectID]),
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
        // `list` 返回的结果可能被截取了，靠最后的那一集的评分投票数据可能因此而不
        // 完整，故而删去。
        delete episodesVotes[lastEpisodeID!];
      }

      return { episodesVotes, isCertainThatEpisodesVotesAreIntegral };
    })();

  const userID = await matchTokenOrUserID(kv, tokenOrUserID, opts);

  const data: GetSubjectEpisodesResponseData = {
    episodes_votes: episodesVotes,
    is_certain_that_episodes_votes_are_integral:
      isCertainThatEpisodesVotesAreIntegral,
  };

  if (userID !== null && opts.claimedUserID === userID) {
    data.my_ratings = {};

    const prefix = env
      .buildKVPrefixUserSubjectEpisodeRating([userID, opts.subjectID]);

    for await (
      const result of kv.list<UserSubjectEpisodeRatingData>({ prefix })
    ) {
      const episodeID = result.key.at(-1) as number;
      if (result.value.score !== null) {
        data.my_ratings[episodeID] = result.value.score;
      }
    }
  }

  return ["ok", data];
}

export async function queryEpisodeRatings(
  kv: Deno.Kv,
  tokenOrUserID: ["token", string | null] | ["userID", number],
  opts: {
    claimedUserID: number | null;
    subjectID: number;
    episodeID: number;

    compatibility: {
      noPublicRatings: boolean;
    };
  },
): Promise<
  APIResponse<
    GetEpisodeRatingsResponseData | GetEpisodeRatingsResponseData__Until_0_3_0
  >
> {
  const votes: { [score: number]: number } = {};
  for await (
    const result of kv.list({
      prefix: env.buildKVPrefixSubjectEpisodeScoreVotes //
      ([opts.subjectID, opts.episodeID]),
    })
  ) {
    const score = result.key.at(-1) as number;

    const scoreVotes = result.value as Deno.KvU64;
    if (scoreVotes.value) {
      votes[score] = Number(scoreVotes.value);
    }
  }

  const publicRatingsResult: APIResponse<
    GetEpisodePublicRatingsResponseData | null
  > = opts.compatibility.noPublicRatings
    ? ["ok", null]
    : await queryEpisodePublicRatings(kv, opts);
  if (publicRatingsResult[0] !== "ok") return publicRatingsResult;

  const data:
    | GetEpisodeRatingsResponseData
    | GetEpisodeRatingsResponseData__Until_0_3_0 = { votes };

  if (publicRatingsResult[1] !== null) {
    (data as GetEpisodeRatingsResponseData).public_ratings =
      publicRatingsResult[1];
  }

  const userID = await matchTokenOrUserID(kv, tokenOrUserID, opts);
  if (userID !== null && opts.claimedUserID === userID) {
    const myRatingResult = //
      await queryEpisodeMyRating(kv, ["userID", userID], opts);
    if (myRatingResult[0] !== "ok") return myRatingResult;
    data.my_rating = myRatingResult[1];
  }

  return ["ok", data];
}

export async function queryEpisodeMyRating(
  kv: Deno.Kv,
  tokenOrUserID: ["token", string | null] | ["userID", number],
  opts: { claimedUserID: number | null; subjectID: number; episodeID: number },
): Promise<APIResponse<GetMyEpisodeRatingResponseData>> {
  const userID = await matchTokenOrUserID(kv, tokenOrUserID, opts);

  if (!userID || opts.claimedUserID !== userID) {
    return ["auth_required"];
  }

  const userSubjectEpisodeRatingKey = env.buildKVKeyUserSubjectEpisodeRating(
    userID,
    opts.subjectID,
    opts.episodeID,
  );

  const ratingResult = await kv.get<UserSubjectEpisodeRatingData>(
    userSubjectEpisodeRatingKey,
  );

  return ["ok", {
    score: ratingResult.value?.score ?? null,
    visibility: ratingResult.value
      ? { is_visible: ratingResult.value.isVisible ?? false }
      : null,
  }];
}

export async function queryEpisodePublicRatings(
  kv: Deno.Kv,
  opts: { subjectID: number; episodeID: number },
): Promise<APIResponse<GetEpisodePublicRatingsResponseData>> {
  const votersByScore: { [score: number]: number[] } = {};
  for await (
    const result of kv.list({
      prefix: env.buildKVPrefixSubjectEpisodeScorePublicVoters(
        [opts.subjectID, opts.episodeID],
      ),
    })
  ) {
    const score = result.key.at(-2) as number;
    const voterUserID = result.key.at(-1) as number;

    const voters = votersByScore[score] ?? (votersByScore[score] = []);
    voters.push(voterUserID);
  }

  return ["ok", { public_voters_by_score: votersByScore }];
}
