import { VotesData } from "../models/VotesData";

export function renderSmallGreyScore(
  el: JQuery<HTMLElement>,
  props: {
    votesData: VotesData;
    requiresClickToReveal: boolean;
  },
) {
  el = $(/*html*/ `
    <small class="grey" style="display: none;"></small>
    <button type="button" style="display: none;">显示评分</button>
  `).replaceAll(el);

  const small = el.filter((_, el) => el.tagName === "SMALL");
  const button = el.filter((_, el) => el.tagName === "BUTTON");

  const text = (() => {
    const score = props.votesData.averageScore;
    const scoreText = Number.isNaN(score) ? "--" : score.toFixed(4);
    const votes = props.votesData.totalVotes;
    return `/ 评分:${scoreText} (人数:+${votes})`;
  })();
  small.text(text);

  if (props.requiresClickToReveal) {
    button.css("display", "");
    button.on("click", () => {
      small.css("display", "");
      button.css("display", "none");
    });
  } else {
    small.css("display", "");
  }
}
