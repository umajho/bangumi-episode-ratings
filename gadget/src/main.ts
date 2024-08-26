import env from "./env";
import Global, { initializeGlobal } from "./global";
import { processEpPage } from "./page-processors/ep";
import { processSubjectEpListPage } from "./page-processors/subject-ep-list";

function migrate() {
  const tokenInWrongPlace = localStorage.getItem("bgm_test_app_token");
  if (tokenInWrongPlace) {
    localStorage.setItem(env.LOCAL_STORAGE_KEY_TOKEN, tokenInWrongPlace);
    localStorage.removeItem("bgm_test_app_token");
  }

  const searchParams = new URLSearchParams(window.location.search);
  const tokenCouponInWrongPlace = searchParams.get("bgm_test_app_token_coupon");
  if (tokenCouponInWrongPlace) {
    searchParams.set(
      env.SEARCH_PARAMS_KEY_TOKEN_COUPON,
      tokenCouponInWrongPlace,
    );
    searchParams.delete("bgm_test_app_token_coupon");

    let newURL = `${window.location.pathname}?${searchParams.toString()}`;
    window.history.replaceState(null, "", newURL);
  }
}

async function main() {
  // @ts-ignore
  const isInUserScriptRuntime = typeof GM_info !== "undefined";

  if ($('meta[name="__bgm_ep_ratings__initialized"]').length) {
    console.warn(
      "检测到本脚本/超合金组件（单集评分 by Umajho A.K.A. um）先前已经初始化过，本实例将不会继续运行。",
      { version: Global.version, isInUserScriptRuntime },
    );
    return;
  }
  $('<meta name="__bgm_ep_ratings__initialized" content="true">')
    .appendTo("head");

  const searchParams = new URLSearchParams(window.location.search);
  const tokenCoupon = searchParams.get(env.SEARCH_PARAMS_KEY_TOKEN_COUPON);
  if (tokenCoupon) {
    searchParams.delete(env.SEARCH_PARAMS_KEY_TOKEN_COUPON);
    let newURL = `${window.location.pathname}`;
    if (searchParams.size) {
      newURL += `?${searchParams.toString()}`;
    }
    window.history.replaceState(null, "", newURL);

    Global.token.setValue(
      await Global.client.mustRedeemTokenCoupon(tokenCoupon),
    );

    window.close();
  }

  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (
    pathParts.length === 3 &&
    pathParts[0] === "subject" && pathParts[2] === "ep"
  ) {
    await processSubjectEpListPage();
  } else if (pathParts.length === 2 && pathParts[0] === "ep") {
    await processEpPage();
  }
}

migrate();
initializeGlobal();
main();
