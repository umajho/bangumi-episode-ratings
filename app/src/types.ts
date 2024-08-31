import env from "./env.ts";

// see: https://kubyshkin.name/posts/newtype-in-typescript/
export type UserID = number & { readonly __tag: unique symbol };
export type SubjectID = number & { readonly __tag: unique symbol };
export type EpisodeID = number & { readonly __tag: unique symbol };

export interface State {
  referrerHostname:
    | `https://${(typeof env.VALID_BGM_HOSTNAMES)[number]}`
    | null;

  gadgetVersion: number | null;
  token: string | null;
  claimedUserID: UserID | null;
}

export type StateForAuth = State & {
  referrerHostname: NonNullable<State["referrerHostname"]>;
};
export type StateForAPI = Omit<State, "">;

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
  history: {
    score: number | null;
    submittedAtMs: number;
  }[];
}
