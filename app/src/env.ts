const env = {
  get ENTRYPOINT(): string {
    return Deno.env.get("ENTRYPOINT_URL")!;
  },

  PATH_GO_AUTHORIZE: "/go_authorize",

  PATH_AUTHORIZATION_CALLBACK: "/authorization_callback",

  get URL_AUTHORIZATION_CALLBACK(): string {
    return join(env.ENTRYPOINT, this.PATH_AUTHORIZATION_CALLBACK);
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

  get BGM_HOMEPAGE(): string {
    return Deno.env.get("BGM_HOMEPAGE_URL")!;
  },

  build_bgm_oauth_authorize_url(bgmBaseURL: string): string {
    return join(bgmBaseURL, "/oauth/authorize");
  },

  build_bgm_access_token_url(bgmBaseURL: string): string {
    return join(bgmBaseURL, "/oauth/access_token");
  },
};

function join(base: string, url: string): string {
  return (new URL(url, base)).href;
}

export default env;
