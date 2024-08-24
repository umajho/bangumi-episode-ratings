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

export interface RateEpisodeRequestData {
  claimed_user_id: number;

  subject_id: number;
  episode_id: number;

  score: number | null;
}

export interface RateEpisodeResponseData {
  score: number | null;
}

export interface GetEpisodeRatingsResponseData {
  votes: { [score: number]: number };
  userScore?: number;
}
