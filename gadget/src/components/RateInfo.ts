import { VotesData } from "../models/VotesData";
import { Watched } from "../utils";
import { renderSmallStars } from "./SmallStars";

export function renderRateInfo(
  el: JQuery<HTMLElement>,
  props: {
    votesData: Watched<VotesData>;
    requiresClickToReveal: Watched<boolean>;
    onReveal?: () => void;
  },
) {
  el = $(/*html*/ `
    <div>
      <div class="rateInfo" style="display: none;">
        <div data-sel="small-stars"></div>
        <span class="tip_j"></span>
      </div>
      <button type="button" style="display: none;">显示评分</button>
    </div>
  `).replaceAll(el);

  const rateInfoEl = el.find(".rateInfo");
  const smallStarsEl = el.find('[data-sel="small-stars"]');
  const buttonEl = el.find("button");

  const score = props.votesData.createComputed(
    (votesData) => votesData.averageScore,
  );
  renderSmallStars(smallStarsEl, { score, shouldShowNumber: true });

  props.votesData.watch((votesData) => {
    $(el).find(".tip_j").text(`(${votesData.totalVotes}人评分)`);
  });

  buttonEl.on("click", () => {
    rateInfoEl.css("display", "");
    buttonEl.css("display", "none");

    props.onReveal?.();
  });

  props.requiresClickToReveal.watch((requiresClickToReveal) => {
    if (requiresClickToReveal) {
      rateInfoEl.css("display", "none");
      buttonEl.css("display", "");
    } else {
      rateInfoEl.css("display", "");
      buttonEl.css("display", "none");
    }
  });
}
