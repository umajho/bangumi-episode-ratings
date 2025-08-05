const env = {
  get APP_AUTH_ENTRYPOINT(): string {
    return import.meta.env.APP_AUTH_ENTRYPOINT_URL!;
  },
  get APP_API_ENTRYPOINT(): string {
    const debugURL = localStorage
      .getItem(this.LOCAL_STORAGE_KEY_DEBUG_API_ENTRYPOINT_URL);
    if (debugURL) return debugURL;

    return import.meta.env.APP_API_ENTRYPOINT_URL!;
  },

  LOCAL_STORAGE_KEY_DEBUG_API_ENTRYPOINT_URL:
    "bgm_ep_ratings_debug_api_entrypoint_url",
  LOCAL_STORAGE_KEY_TOKEN: "bgm_ep_ratings_token",
  LOCAL_STORAGE_KEY_JWT: "bgm_ep_ratings_jwt",
  SEARCH_PARAMS_KEY_TOKEN_COUPON: "bgm_ep_ratings_token_coupon",
};

export default env;
