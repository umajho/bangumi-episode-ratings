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
