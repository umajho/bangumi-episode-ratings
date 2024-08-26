import { VotesData } from "../models/VotesData";

export function renderRateInfo(
  el: JQuery<HTMLElement>,
  props: {
    votesData: VotesData;
    requiresClickToReveal: boolean;
  },
) {
  el = $(/*html*/ `
    <p class="rateInfo" style="display: none;">
      <span class="starstop-s">
        <span class="starlight"></span>
        </span> <small class="fade"></small> <span class="tip_j">
      </span> 
    </p>
    <button type="button" style="display: none;">显示评分</button>
  `).replaceAll(el);

  const rateInfoEl = el.filter((_, el) => el.tagName === "P");
  const buttonEl = el.filter((_, el) => el.tagName === "BUTTON");

  const score = props.votesData.averageScore;
  if (Number.isNaN(score)) {
    $(rateInfoEl).find(".starlight").removeClass("starlight");
    $(rateInfoEl).find("small.fade").text("--");
  } else {
    $(rateInfoEl).find(".starlight").addClass(`stars${Math.round(score)}`);
    $(rateInfoEl).find("small.fade").text(score.toFixed(4));
  }
  $(rateInfoEl).find(".tip_j").text(`(${props.votesData.totalVotes}人评分)`);

  if (props.requiresClickToReveal) {
    buttonEl.css("display", "block");
    buttonEl.on("click", () => {
      rateInfoEl.css("display", "");
      buttonEl.css("display", "none");
    });
  } else {
    rateInfoEl.css("display", "");
  }
}
