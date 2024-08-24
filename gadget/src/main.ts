import env from "./env";
import * as Global from "./global";
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

    Global.token.setValue(
      await Global.client.mustRedeemTokenCoupon(tokenCoupon),
    );
  }

  const debugEl = $("<div />");
  $("body").prepend(debugEl);
  renderDebug(debugEl);

  if (location.pathname.startsWith("/ep/")) {
    const ratingsData = await Global.client.mustGetEpisodeRatings();
    const votesData = new VotesData(
      ratingsData.votes as { [_ in Score]?: number },
    );

    const scoreboardEl = $("<div />");
    $("#columnEpA").prepend(scoreboardEl);
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

main();
