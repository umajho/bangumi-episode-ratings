import env from "./env";
import Global, { initializeGlobal } from "./global";
import { processEpPage } from "./page-processors/ep";
import { processRootPage } from "./page-processors/root";
import { processSubjectPage } from "./page-processors/subject";
import { processSubjectEpListPage } from "./page-processors/subject-ep-list";

async function main() {
  // 不在超展开页面执行。
  // NOTE: 在超展开页面，即使已经登录，`window.CHOBITS_UID` 也没有被定义。
  if (/^\/rakuen(\/|$)/.test(window.location.pathname)) {
    return;
  }

  migrate();
  initializeGlobal();

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

    const resp = await Global.client.redeemTokenCoupon(tokenCoupon);
    if (resp[0] === "ok") {
      Global.token.setValue(resp[1]);
    } else if (resp[0] === "error") {
      window.alert(`获取 token 失败：${resp[2]} (${resp[1]})`);
    } else {
      resp satisfies never;
    }

    window.close();
  }

  const pathParts = window.location.pathname.split("/").filter(Boolean);
  if (!pathParts.length) {
    await processRootPage();
  } else if (pathParts.length === 2 && pathParts[0] === "subject") {
    await processSubjectPage();
  } else if (
    pathParts.length === 3 &&
    pathParts[0] === "subject" && pathParts[2] === "ep"
  ) {
    await processSubjectEpListPage();
  } else if (pathParts.length === 2 && pathParts[0] === "ep") {
    await processEpPage();
  }
}

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

main();
