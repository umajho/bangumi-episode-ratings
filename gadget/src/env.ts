const env = {
  get APP_ENTRYPOINT(): string {
    return import.meta.env.VITE_APP_ENTRYPOINT_URL;
  },

  LOCAL_STORAGE_KEY_TOKEN: "bgm_ep_ratings_token",
  LOCAL_STORAGE_KEY_JWT: "bgm_ep_ratings_jwt",
  SEARCH_PARAMS_KEY_TOKEN_COUPON: "bgm_ep_ratings_token_coupon",
};

export default env;
