import { ReverseMap } from "@/type-utils.ts";
import { EpisodeID, SubjectID, UserID } from "@/types.ts";

const KV_PREFIXES = (() => {
  /**
   * 含义：
   * - `:u` -> User ID
   * - `:t` -> Token
   * - `:tc` -> Token Coupon
   * - `:s` -> Subject ID
   * - `:e` -> Episode ID
   * - `:sc` -> Score
   * - `:ts` -> Unix Timestamp (ms)
   */
  const reversedKVPrefixes = {
    1: "users/:u", // 用户信息。
    2: "tokens/:t", // token 信息（对应于哪个用户）。
    3: "token-coupons/:tc", // token 兑换券信息（对应于哪个 token）。
    4: "episode-infos/:e", // 剧集信息（其属于哪个条目）。
    5: "ratings/:u/:s/:e", // 用户对剧集的评分信息。
    6: "vote-counts/:s/:e/:sc", // 剧集对应分数的评分数。
    // 剧集对应评分下评分公开者的标记。（若某名用户公开了对某个剧集的评分，其在此
    // 处对应值为 1。）
    7: "public-voter-marks/:s/:e/:sc/:u",
    8: "user-timeline-items/:u/:ts",
  } as const;
  return Object.fromEntries(
    Object.entries(reversedKVPrefixes).map(([k, v]) => [v, Number(k)]),
  ) as ReverseMap<typeof reversedKVPrefixes>;
})();

export function buildKeyUser(userID: UserID) {
  return [KV_PREFIXES["users/:u"], userID] as const;
}
export function buildKeyToken(token: string) {
  return [KV_PREFIXES["tokens/:t"], token] as const;
}
export function buildKeyTokenCoupon(tokenCoupon: string) {
  return [KV_PREFIXES["token-coupons/:tc"], tokenCoupon] as const;
}
export function buildKeyEpisodeInfo(episodeID: EpisodeID) {
  return [KV_PREFIXES["episode-infos/:e"], episodeID] as const;
}
export function extractEpisodeIDFromKeyEpisodeInfo(
  key: ReturnType<typeof buildKeyEpisodeInfo>,
) {
  return key[1] as EpisodeID;
}
export function buildKeyUserSubjectEpisodeRating(
  userID: UserID,
  subjectID: SubjectID,
  episodeID: EpisodeID,
) {
  return [
    KV_PREFIXES["ratings/:u/:s/:e"],
    userID,
    subjectID,
    episodeID,
  ] as const;
}
export function buildPrefixUserSubjectEpisodeRating(
  subKey: [] | [userID: UserID, subjectID: SubjectID],
) {
  return [KV_PREFIXES["ratings/:u/:s/:e"], ...subKey] as const;
}
export function buildKeySubjectEpisodeScoreVotes(
  subjectID: SubjectID,
  episodeID: EpisodeID,
  score: number,
) {
  return [
    KV_PREFIXES["vote-counts/:s/:e/:sc"],
    subjectID,
    episodeID,
    score,
  ] as const;
}
export function buildPrefixSubjectEpisodeScoreVotes(
  subKey:
    | [subjectID: SubjectID]
    | [subjectID: SubjectID, episodeID: EpisodeID],
) {
  return [KV_PREFIXES["vote-counts/:s/:e/:sc"], ...subKey] as const;
}
export function buildKeySubjectEpisodeScorePublicVoters(
  subjectID: SubjectID,
  episodeID: EpisodeID,
  score: number,
  userID: UserID,
) {
  return [
    KV_PREFIXES["public-voter-marks/:s/:e/:sc/:u"],
    subjectID,
    episodeID,
    score,
    userID,
  ] as const;
}
export function buildPrefixSubjectEpisodeScorePublicVoters(
  subKey: [subjectID: SubjectID, episodeID: EpisodeID],
) {
  return [
    KV_PREFIXES["public-voter-marks/:s/:e/:sc/:u"],
    ...subKey,
  ] as const;
}
export function buildKeyUserTimelineItem(userID: UserID, timestampMs: number) {
  return [
    KV_PREFIXES["user-timeline-items/:u/:ts"],
    userID,
    timestampMs,
  ] as const;
}
export function buildPrefixUserTimelineItem(subKey: [userID: UserID]) {
  return [KV_PREFIXES["user-timeline-items/:u/:ts"], ...subKey] as const;
}
