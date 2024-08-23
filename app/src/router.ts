import { Router } from "jsr:@oak/oak@14/router";

import env from "./env.ts";
import { State } from "./state.ts";
import { generateToken } from "./utils.ts";
import { TokenCouponData, TokenData, UserData } from "./types.ts";
import { makeErrorResponse, makeOkResponseForAPI } from "./responses.tsx";

export const router = new Router<State>();

router.get("/", (ctx) => {
  ctx.response.redirect(env.BGM_HOMEPAGE);
});

router.get(env.PATH_GO_AUTHORIZE, (ctx) => {
  const url = new URL(env.build_bgm_oauth_authorize_url(ctx.state.bgmBaseURL));
  url.searchParams.set("client_id", env.BGM_APP_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.URL_AUTHORIZATION_CALLBACK);

  ctx.response.redirect(url);
});

router.get(env.PATH_AUTHORIZATION_CALLBACK, async (ctx) => {
  const code = ctx.request.url.searchParams.get("code")!;

  const data = await (async () => {
    const url = env.build_bgm_access_token_url(ctx.state.bgmBaseURL);
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", env.BGM_APP_ID);
    params.append("client_secret", env.BGM_APP_SECRET);
    params.append("code", code);
    params.append("redirect_uri", env.URL_AUTHORIZATION_CALLBACK);

    const resp = await fetch(url, { method: "POST", body: params });
    return await resp.json();
  })();

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
        tx = tx.delete(["tokens", token]);
      }
      userData.tokens = [];
    }

    userData.tokens.push(userToken);

    const result = await tx.check(userDataResult)
      .set(["users", userID], userData)
      .set(["tokens", userToken], { userID } satisfies TokenData)
      .set(
        ["tokenCoupons", userTokenCoupon],
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

router.post(env.PATH_API_REDEEM_TOKEN_COUPON, async (ctx) => {
  const { tokenCoupon } = await ctx.request.body.json();

  const kv = await Deno.openKv();

  const tokenCouponResult = await kv.get<TokenCouponData>(
    ["tokenCoupons", tokenCoupon],
  );

  if (!tokenCouponResult.value || Date.now() > tokenCouponResult.value.expiry) {
    ctx.response.body = makeOkResponseForAPI(null);
    return;
  }

  const result = await kv.atomic()
    .check(tokenCouponResult)
    .delete(["tokenCoupons", tokenCoupon]).commit();
  if (!result.ok) {
    ctx.response.body = makeOkResponseForAPI(null);
    return;
  }

  ctx.response.body = makeOkResponseForAPI(tokenCouponResult.value.token);
});

router.get(env.PATH_API_WHOAMI, async (ctx) => {
  const kv = await Deno.openKv();

  const userID = await getUserID(kv, ctx.state.token);
  if (!userID) {
    ctx.response.body = makeOkResponseForAPI(null);
    return;
  }

  ctx.response.body = makeOkResponseForAPI(userID);
});

async function getUserID(
  kv: Deno.Kv,
  token: string | null,
): Promise<number | null> {
  if (!token) return null;

  const tokenResult = await kv.get<TokenData>(["tokens", token]);
  if (!tokenResult.value) return null;

  return tokenResult.value.userID;
}
