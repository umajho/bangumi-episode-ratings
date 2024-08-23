const env = {
  get APP_ENTRYPOINT(): string {
    return import.meta.env.VITE_APP_ENTRYPOINT_URL;
  },
  get APP_API_ENTRYPOINT(): string {
    return join(this.APP_ENTRYPOINT, "api/");
  },

  get APP_URL_GO_AUTHORIZE(): string {
    return join(this.APP_ENTRYPOINT, "go_authorize");
  },

  get APP_URL_API_REDEEM_TOKEN_COUPON(): string {
    return join(this.APP_API_ENTRYPOINT, "redeem_token_coupon");
  },

  get APP_URL_API_WHOAMI(): string {
    return join(this.APP_API_ENTRYPOINT, "whoami");
  },

  LOCAL_STORAGE_KEY_TOKEN: "bgm_test_app_token",
  SEARCH_PARAMS_KEY_TOKEN_COUPON: "bgm_test_app_token_coupon",
};

function join(base: string, url: string): string {
  return (new URL(url, base)).href;
}

export default env;
