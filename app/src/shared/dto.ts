export type ErrorName =
  | "UNKNOWN"
  | "MISSING_REFERRER"
  | "UNSUPPORTED_REFERRER"
  | "BAD_REQUEST"
  | "BAD_USER_ID"
  | "UNSUPPORTED_AUTHORIZATION_HEADER_SCHEME"
  | "AUTH_REQUIRED"
  | "BAD_SCORE"
  | "UNABLE_TO_VERIFY_THAT_EPISODE_IS_IN_SUBJECT"
  | "EPISODE_NOT_IN_SUBJECT";

export type APIOkResponse<T> = [tag: "ok", data: T];
export type APIErrorResponse = [tag: "error", name: ErrorName, msg: string];
export type APIResponse<T> =
  | APIOkResponse<T>
  | APIErrorResponse
  | [tag: "auth_required"];

export interface RateEpisodeRequestData__V0 {
  claimed_user_id: number;

  subject_id: number;
  episode_id: number;

  score: number | null;
}

export interface RateEpisodeRequestData__V1 {
  score: number;
}

export interface RateEpisodeResponseData {
  score: number | null;
}

export interface GetEpisodeRatingsResponseData__Until_0_1_13 {
  votes: { [score: number]: number };
  userScore?: number | null;
}

export interface GetEpisodeRatingsResponseData {
  votes: { [score: number]: number };
  my_rating?: GetMyEpisodeRatingResponseData;
}

export interface GetMyEpisodeRatingResponseData {
  score: number | null;
}

export interface GetSubjectEpisodesResponseData {
  episodes_votes: { [episode_id: number]: { [score: number]: number } | null };
  /** 是否确定所有剧集的评分得票数据都在 `episodes_votes` 中。 */
  is_certain_that_episodes_votes_are_integral: boolean;
  my_ratings?: { [episode_id: number]: number };
}
