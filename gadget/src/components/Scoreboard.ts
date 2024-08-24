import { describeScore } from "../definitions";

export function renderScoreboard(
  el: JQuery<HTMLElement>,
  props: { score: number },
) {
  el = $(/*html*/ `
    <div class="global_score" style="float: right;">
      <span class="description"></span>
      <span class="number"></span>
      <div>
        <small class="grey" style="float: right;">单集评分</small>
      </div>
    </div>
  `).replaceAll(el);

  function updateNumber(score: number) {
    if (Number.isNaN(score)) {
      $(el).find(".number").text((0).toFixed(1));
      $(el).find(".description").text("--");
    } else {
      $(el).find(".number").text(score.toFixed(4));
      $(el).find(".description").text(describeScore(score));
    }
  }
  updateNumber(props.score);

  return el;
}