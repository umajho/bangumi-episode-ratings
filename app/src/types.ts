import env from "./env.ts";

export interface State {
  referrerHostname:
    | `https://${(typeof env.VALID_BGM_HOSTNAMES)[number]}`
    | null;

  gadgetVersion: number | null;
  token: string | null;
  claimedUserID: number | null;
}

export type StateForAuth = State & {
  referrerHostname: NonNullable<State["referrerHostname"]>;
};
export type StateForAPI = Omit<State, "">;

export interface UserData {
  tokens: string[];
}

export interface TokenData {
  userID: number;
}

export interface TokenCouponData {
  token: string;
  expiry: number;
}

export interface EpisodeInfoData {
  subjectID: number;
}

export interface UserSubjectEpisodeRatingData {
  score: number | null;
  submittedAtMs: number;
  history: {
    score: number | null;
    submittedAtMs: number;
  }[];
}
