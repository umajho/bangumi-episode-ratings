import Global from "../global";
import { renderMyRating } from "../components/MyRating";
import { renderScoreboard } from "../components/Scoreboard";
import { renderScoreChart } from "../components/ScoreChart";
import { VotesData } from "../models/VotesData";
import { Score } from "../definitions";

export async function processEpPage() {
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
  if (!ratingsData.my_rating) {
    Global.token.setValue(null);
  }
  renderMyRating(myRatingEl, {
    ratedScore: (ratingsData.my_rating?.score ?? null) as Score | null,
  });
}
