// see: https://kubyshkin.name/posts/newtype-in-typescript/
export type UserID = number & { readonly __tag: unique symbol };
export type SubjectID = number & { readonly __tag: unique symbol };
export type EpisodeID = number & { readonly __tag: unique symbol };

export type AuthRouteMode =
  | ["normal"]
  | ["off"];

export type APIRouteMode =
  | ["normal"]
  | [type: "maintenance", message: string]
  | [type: "forward", newEntrypoint: URL];

export interface UserData {
  tokens: string[];
}

export interface TokenEntryData {
  userID: UserID;
}

export interface TokenCouponEntryData {
  token: string;
  expiry: number;
}

export interface EpisodeInfoData {
  subjectID: SubjectID;
}

export interface UserSubjectEpisodeRatingData {
  score: number | null;
  isVisible?: boolean;
  submittedAtMs: number;
}

export type UserTimelineItem =
  | ["rate-episode", { episodeID: EpisodeID; score: number | null }]
  | never; // 此项只是确保让 formatter 将 `|` 放在一行开头用的占位符。
