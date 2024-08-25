export interface State {
  bgmBaseURL: string;

  gadgetVersion: string | null;
  token: string | null;
}

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
