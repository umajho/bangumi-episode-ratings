const env = {
  get APP_ENTRYPOINT(): string {
    return import.meta.env.VITE_APP_ENTRYPOINT_URL;
  },

  LOCAL_STORAGE_KEY_TOKEN: "bgm_test_app_token",
  SEARCH_PARAMS_KEY_TOKEN_COUPON: "bgm_test_app_token_coupon",
};

export default env;
