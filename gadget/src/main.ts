import env from "./env";
import { client, token } from "./global";
import { renderDebug } from "./components/Debug";
import { renderScoreboard } from "./components/Scoreboard";
import { VotesData } from "./models/VotesData";
import { renderScoreChart } from "./components/ScoreChart";
import { renderMyRating } from "./components/MyRating";
import { Watched } from "./utils";
import { Score } from "./definitions";

async function main() {
  const searchParams = new URLSearchParams(window.location.search);
  const tokenCoupon = searchParams.get(env.SEARCH_PARAMS_KEY_TOKEN_COUPON);
  if (tokenCoupon) {
    searchParams.delete(env.SEARCH_PARAMS_KEY_TOKEN_COUPON);
    let newURL = `${window.location.pathname}`;
    if (searchParams.size) {
      newURL += `?${searchParams.toString()}`;
    }
    window.history.replaceState(null, "", newURL);

    token.setValue(await client.mustRedeemTokenCoupon(tokenCoupon));
  }

  const votesData = new VotesData({ // TODO
    1: Math.floor(Math.random() * 1000) + 1,
    2: Math.floor(Math.random() * 1000) + 1,
    3: Math.floor(Math.random() * 1000) + 1,
    4: Math.floor(Math.random() * 1000) + 1,
    5: Math.floor(Math.random() * 1000) + 1,
    6: Math.floor(Math.random() * 1000) + 1,
    7: Math.floor(Math.random() * 1000) + 1,
    8: Math.floor(Math.random() * 1000) + 1,
    9: Math.floor(Math.random() * 1000) + 1,
    10: Math.floor(Math.random() * 1000) + 1,
  });

  const debugEl = $("<div />");
  $("body").prepend(debugEl);
  renderDebug(debugEl);

  if (location.pathname.startsWith("/ep/")) {
    const scoreboardEl = $("<div />");
    $("#columnEpA").prepend(scoreboardEl);
    renderScoreboard(scoreboardEl, { score: votesData.averageScore });

    const scoreChartEl = $("<div />").insertBefore("#columnEpA > .epDesc");
    renderScoreChart(scoreChartEl, { votesData });
    $(/*html*/ `<div class="clear" />`).insertAfter("#columnEpA > .epDesc");

    const myRatingEl = $("<div />").insertAfter(".singleCommentList > .board");
    const myScore = new Watched<Score | null>(
      // TODO
      Math.floor(Math.random() * 10) + 1 as Score,
    );
    renderMyRating(myRatingEl, {
      score: myScore,
      // TODO
      submitScore: (score) => myScore.setValue(score),
    });
  }
}

main();
