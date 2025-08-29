import { Hono } from "hono";

import * as Djwt from "https://deno.land/x/djwt@v3.0.2/mod.ts";

import ENDPOINT_PATHS from "@/shared/endpoint-paths.ts";

import * as Middlewares from "@/middlewares/mod.ts";
import { generateToken } from "@/utils.ts";
import { UserID } from "@/types.ts";
import {
  makeErrorAuthRequiredResponse,
  respondForAPI,
  respondWithError,
} from "@/responding.tsx";
import config from "@/config.ts";
import * as Global from "@/global.ts";

export const router = new Hono();
export default router;

router.get(
  `/${ENDPOINT_PATHS.AUTH.BANGUMI_PAGE}`,
  Middlewares.referrers({
    shouldUseSearchParameterIfPresent: true,
  }),
  // deno-lint-ignore require-await
  async (ctx) => {
    const referrerHostname = ctx.var.referrerHostname;
    if (!referrerHostname) {
      return respondWithError(
        ctx,
        "MISSING_REFERRER",
        "无法确定来源 bangumi 站点",
        { isForAPI: false },
      );
    }
    const bgmBaseURL = `https://${referrerHostname}`;

    const gadgetVersion = ctx.req.query("gadget_version");

    const url = config.bangumi.buildURLOauthAuthorize(bgmBaseURL);
    url.searchParams.set("client_id", config.app.BGM_APP_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "redirect_uri",
      config.site.buildURLAuthorizationCallback(ENDPOINT_PATHS.AUTH.CALLBACK)
        .toString(),
    );
    url.searchParams.set(
      "state",
      JSON.stringify({ gadgetVersion, referrerHostname }),
    );

    return ctx.redirect(url.toString());
  },
);

router.get(
  `/${ENDPOINT_PATHS.AUTH.CALLBACK}`,
  Middlewares.gadgetVersion(),
  async (ctx) => {
    const state = JSON.parse(ctx.req.query("state")!);
    ctx.set("gadgetVersion", state.gadgetVersion);

    const referrerHostname = state.referrerHostname;
    if (
      !referrerHostname ||
      !(config.bangumi.validateHostname(referrerHostname))
    ) {
      return respondWithError(
        ctx,
        "UNSUPPORTED_REFERRER",
        "CSRF?",
        { isForAPI: false },
      );
    }
    const bgmBaseURL = `https://${referrerHostname}`;

    const code = ctx.req.query("code")!;

    const data = await Global.bangumiClient.postToGetAccessToken({
      clientID: config.app.BGM_APP_ID,
      clientSecret: config.app.BGM_APP_SECRET,
      code,
      redirectURI: config.site
        .buildURLAuthorizationCallback(ENDPOINT_PATHS.AUTH.CALLBACK)
        .toString(),
    });

    const userIDRaw = data["user_id"];
    if (!/^\d+$/.test(userIDRaw)) {
      return respondWithError(
        ctx,
        "BAD_USER_ID",
        `用户 ID 应该是整数，但从 bangumi 那边得到的却是 “${userIDRaw}”`,
        { isForAPI: false },
      );
    }
    const userID = Number(userIDRaw) as UserID;
    const userToken = generateToken(userID);
    const userTokenCoupon = generateToken(userID);

    let isOk = false;
    while (!isOk) {
      const userResult = await Global.repo.getUserResult(userID);
      const user = userResult.value ?? { tokens: [] };

      const result = await Global.repo.tx((tx) => {
        if (user.tokens.length >= 10) {
          // 用户持有的 tokens 太多了。目前也懒得去实现记录各个 token 的使用频率/最
          // 后使用时间，直接去掉最早的那个对用户而言也有些不可预测（至少我不会记得
          // 自己 tokens 的生成顺序），干脆就一股脑全清掉了。

          for (const token of user.tokens) {
            tx.deleteTokenEntry(token);
          }
          user.tokens = [];
        }

        user.tokens.push(userToken);

        tx.setUser(userID, user, userResult);
        tx.setTokenEntry(userToken, { userID });
        tx.setTokenCouponEntry(userTokenCoupon, { token: userToken });
      });
      isOk = result.ok;
    }

    const url = new URL(config.bangumi.PATH_GADGET_CONFIRMATION, bgmBaseURL);
    url.searchParams.set("bgm_ep_ratings_token_coupon", userTokenCoupon);
    if (!ctx.var.gadgetVersion) { // 兼容可能在旧版本组件中存在的错误。
      url.searchParams.set("bgm_test_app_token_coupon", userTokenCoupon);
    }

    return ctx.redirect(url.toString());
  },
);

router.post(
  `/${ENDPOINT_PATHS.AUTH.REDEEM_TOKEN_COUPON}`,
  Middlewares.setIsForAPI(),
  async (ctx) => {
    const { tokenCoupon } = await ctx.req.json();

    const token = await Global.repo.popTokenCouponEntryToken(tokenCoupon);

    return respondForAPI(ctx, ["ok", token]);
  },
);

router.post(
  `/${ENDPOINT_PATHS.AUTH.REFRESH_JWT}`,
  Middlewares.setIsForAPI(),
  Middlewares.auth({ requiresTokenType: "basic" }),
  async (ctx) => {
    const key = await config.app.getJwtSigningKey();
    if (!key) {
      return respondForAPI(ctx, [
        "error",
        "NOT_SUPPORTED_TO_CREATE_JWT",
        "不支持创建 JWT",
      ]);
    }

    const userID = await ctx.var.authenticate(Global.repo);
    if (!userID) return respondForAPI(ctx, makeErrorAuthRequiredResponse());

    const token = await Djwt.create(
      { ...config.app.JWT_KEY_ALGORITHM_FOR_DJWT, typ: "JWT" },
      {
        exp: Djwt.getNumericDate(60 * 60 * 24), // 1 天。
        userID,
      },
      key,
    );

    return respondForAPI(ctx, ["ok", token]);
  },
);
