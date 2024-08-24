import { Router } from "jsr:@oak/oak@14/router";

import ENDPOINT_PATHS from "../../shared/endpoint-paths.ts";

import { generateToken } from "../../utils.ts";
import { State, TokenCouponData, TokenData, UserData } from "../../types.ts";
import { makeErrorResponse, makeOkResponseForAPI } from "../../responses.tsx";
import env from "../../env.ts";
import { bangumiClient } from "../../global.ts";

export const router = new Router<State>();
export default router;

router.get("/" + ENDPOINT_PATHS.AUTH.BANGUMI_PAGE, (ctx) => {
  const url = new URL(env.buildBGMURLOauthAuthorize(ctx.state.bgmBaseURL));
  url.searchParams.set("client_id", env.BGM_APP_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "redirect_uri",
    env.buildURLAuthorizationCallback(ENDPOINT_PATHS.AUTH.CALLBACK),
  );

  ctx.response.redirect(url);
});

router.get("/" + ENDPOINT_PATHS.AUTH.CALLBACK, async (ctx) => {
  const code = ctx.request.url.searchParams.get("code")!;

  const data = await bangumiClient.postToGetAccessToken({
    clientID: env.BGM_APP_ID,
    clientSecret: env.BGM_APP_SECRET,
    code,
    redirectURI: env.buildURLAuthorizationCallback(
      ENDPOINT_PATHS.AUTH.CALLBACK,
    ),
  });

  const userIDRaw = data["user_id"];
  if (!/^\d+$/.test(userIDRaw)) {
    ctx.response.body = makeErrorResponse(
      "BAD_USER_ID",
      `用户 ID 应该是整数，但从 bangumi 那边得到的却是 “${userIDRaw}”`,
      { isForAPI: false },
    );
    return;
  }
  const userID = Number(userIDRaw);
  const userToken = generateToken(userID);
  const userTokenCoupon = generateToken(userID);

  const kv = await Deno.openKv();

  let isOk = false;
  while (!isOk) {
    const userDataResult = await kv.get<UserData>(["users", userID]);
    const userData = userDataResult.value ?? { tokens: [] };

    let tx = kv.atomic();

    if (userData.tokens.length >= 10) {
      // 用户持有的 tokens 太多了。目前也懒得去实现记录各个 token 的使用频率/最
      // 后使用时间，直接去掉最早的那个对用户而言也有些不可预测（至少我不会记得
      // 自己 tokens 的生成顺序），干脆就一股脑全清掉了。

      for (const token of userData.tokens) {
        tx = tx.delete(env.buildKVKeyToken(token));
      }
      userData.tokens = [];
    }

    userData.tokens.push(userToken);

    const result = await tx.check(userDataResult)
      .set(env.buildKVKeyUser(userID), userData)
      .set(env.buildKVKeyToken(userToken), { userID } satisfies TokenData)
      .set(
        env.buildKVKeyTokenCoupon(userTokenCoupon),
        {
          token: userToken,
          expiry: Date.now() + 1000 * 10,
        } satisfies TokenCouponData,
        { expireIn: 1000 * 10 },
      )
      .commit();
    isOk = result.ok;
  }

  const url = new URL(ctx.state.bgmBaseURL);
  url.searchParams.set("bgm_test_app_token_coupon", userTokenCoupon);

  ctx.response.redirect(url);
});

router.post("/" + ENDPOINT_PATHS.AUTH.REDEEM_TOKEN_COUPON, async (ctx) => {
  const { tokenCoupon } = await ctx.request.body.json();

  const kv = await Deno.openKv();

  const tokenCouponResult = await kv.get<TokenCouponData>(
    env.buildKVKeyTokenCoupon(tokenCoupon),
  );

  if (!tokenCouponResult.value || Date.now() > tokenCouponResult.value.expiry) {
    ctx.response.body = makeOkResponseForAPI(null);
    return;
  }

  const result = await kv.atomic()
    .check(tokenCouponResult)
    .delete(env.buildKVKeyTokenCoupon(tokenCoupon)).commit();
  if (!result.ok) {
    ctx.response.body = makeOkResponseForAPI(null);
    return;
  }

  ctx.response.body = makeOkResponseForAPI(tokenCouponResult.value.token);
});
