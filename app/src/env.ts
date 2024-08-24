const env = {
  get ENTRYPOINT(): string {
    return Deno.env.get("ENTRYPOINT_URL")!;
  },

  buildAuthorizationCallbackURL(callbackPath: string): string {
    return join(join(env.ENTRYPOINT, "auth/"), callbackPath);
  },

  PATH_API_REDEEM_TOKEN_COUPON: "/api/redeem_token_coupon",
  PATH_API_WHOAMI: "/api/whoami",

  get PORT(): number {
    return Number(Deno.env.get("PORT")!);
  },

  get BGM_APP_ID(): string {
    return Deno.env.get("BGM_APP_ID")!;
  },

  get BGM_APP_SECRET(): string {
    return Deno.env.get("BGM_APP_SECRET")!;
  },

  get USER_AGENT(): string {
    return Deno.env.get("USER_AGENT")!;
  },

  get BGM_HOMEPAGE(): string {
    return Deno.env.get("BGM_HOMEPAGE_URL")!;
  },

  buildBGMOauthAuthorizeUrl(bgmBaseURL: string): string {
    return join(bgmBaseURL, "/oauth/authorize");
  },

  buildBgmAccessTokenUrl(bgmBaseURL: string): string {
    return join(bgmBaseURL, "/oauth/access_token");
  },
};

function join(base: string, url: string): string {
  return (new URL(url, base)).href;
}

export default env;
