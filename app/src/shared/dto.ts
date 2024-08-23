export type ErrorName =
  | "MISSING_REFERRER"
  | "UNSUPPORTED_REFERRER"
  | "BAD_USER_ID"
  | "UNSUPPORTED_AUTHORIZATION_HEADER_SCHEME";

export type APIOkResponse<T> = [tag: "ok", data: T];
export type APIErrorResponse = [tag: "error", name: ErrorName, msg: string];
