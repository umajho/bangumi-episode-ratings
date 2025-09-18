export type ErrorName =
  | "UNKNOWN"
  | "MAINTAINING"
  | "VERSION_TOO_OLD"
  | "MISSING_REFERRER"
  | "UNSUPPORTED_REFERRER"
  | "BAD_REQUEST"
  | "BAD_USER_ID"
  | "UNSUPPORTED_AUTHORIZATION_HEADER_SCHEME"
  | "AUTH_REQUIRED"
  | "NOT_SUPPORTED_TO_CREATE_JWT"
  | "BAD_SCORE"
  | "UNABLE_TO_VERIFY_THAT_EPISODE_IS_IN_SUBJECT"
  | "EPISODE_NOT_IN_SUBJECT"
  | "NOT_RATED_YET";

export type APIOkResponse<T> = [tag: "ok", data: T];
export type APIErrorResponse = [tag: "error", name: ErrorName, msg: string];
export type APIResponse<T> = APIOkResponse<T> | APIErrorResponse;

export interface RateEpisodeRequestData {
  score?: number;
  visibility?: {
    is_visible: boolean;
  };
}

export interface RateEpisodeResponseData {
  score: number | null;
  visibility: {
    is_visible: boolean;
  };
}

export interface GetEpisodeRatingsResponseData__Until_0_1_13 {
  votes: { [score: number]: number };
  userScore?: number | null;
}

export interface GetEpisodeRatingsResponseData__Until_0_3_0 {
  votes: { [score: number]: number };
  my_rating?: GetMyEpisodeRatingResponseData;
}

export interface GetEpisodeRatingsResponseData {
  votes: { [score: number]: number };
  public_ratings: GetEpisodePublicRatingsResponseData;
  my_rating?: GetMyEpisodeRatingResponseData;
}

export interface GetMyEpisodeRatingResponseData {
  score: number | null;
  visibility: {
    is_visible: boolean;
  } | null;
}

export type GetSubjectEpisodesResponseData_Until_0_5_0 =
  & GetSubjectEpisodesResponseData
  & {
    /** 是否确定所有剧集的评分得票数据都在 `episodes_votes` 中。 */
    is_certain_that_episodes_votes_are_integral: true;
  };

export interface GetSubjectEpisodesResponseData {
  episodes_votes: { [episode_id: number]: { [score: number]: number } | null };
  my_ratings?: { [episode_id: number]: number };
}

export interface ChangeUserEpisodeRatingVisibilityResponseData {
  is_visible: boolean;
}

export interface GetEpisodePublicRatingsResponseData {
  /**
   * 数组由投了那个分数的用户的用户 ID 组成。
   */
  public_voters_by_score: { [score: number]: number[] };
}

export interface GetUserTimeLineItemsResponseData {
  items: UserTimelineItemResponseData[];
  subjects: Record<number, { episode_ids: number[] }>;
}

export type UserTimelineItemResponseData =
  | [
    timestamp_ms: number,
    type: "rate-episode",
    payload: { episode_id: number; score: number | null },
  ]
  | never;

export interface GetUserEpisodeRatingsResponseData {
  episode_to_score_map: Record<number, number>;
}
