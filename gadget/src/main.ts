import env from "./env";
import Global, { initializeGlobal } from "./global";
import { renderScoreboard } from "./components/Scoreboard";
import { VotesData } from "./models/VotesData";
import { renderScoreChart } from "./components/ScoreChart";
import { renderMyRating } from "./components/MyRating";
import { Watched } from "./utils";
import { Score } from "./definitions";

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

  if (location.pathname.startsWith("/ep/")) {
    const scoreboardEl = $(/*html*/ `
      <div class="grey" style="float: right;">
        单集评分组件加载中…
      </div>
    `);
    $("#columnEpA").prepend(scoreboardEl);

    const ratingsData = await Global.client.mustGetEpisodeRatings();
    const votesData = new VotesData(
      ratingsData.votes as { [_ in Score]?: number },
    );

    renderScoreboard(scoreboardEl, { score: votesData.averageScore });

    const scoreChartEl = $("<div />").insertBefore("#columnEpA > .epDesc");
    renderScoreChart(scoreChartEl, { votesData });
    $(/*html*/ `<div class="clear" />`).insertAfter("#columnEpA > .epDesc");

    const myRatingEl = $("<div />").insertAfter(".singleCommentList > .board");
    const myScore = new Watched<Score | null>(
      (ratingsData.userScore ?? null) as Score | null,
    );
    renderMyRating(myRatingEl, { score: myScore });
  }
}

migrate();
initializeGlobal();
main();
