import { VotesData } from "../models/VotesData";
import { Watched } from "../utils";

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
      <p class="rateInfo" style="display: none;">
        <span class="starstop-s">
          <span data-sel="starlight" class="starlight"></span>
          </span> <small class="fade"></small> <span class="tip_j">
        </span> 
      </p>
      <button type="button" style="display: none;">显示评分</button>
    </div>
  `).replaceAll(el);

  const rateInfoEl = el.find(".rateInfo");
  const starlightEl = $(rateInfoEl).find('[data-sel="starlight"]');
  const buttonEl = el.find("button");

  props.votesData.watch((votesData) => {
    if (!votesData) {
      el.css("display", "none");
      return;
    }
    el.css("display", "");

    const score = votesData.averageScore;
    if (Number.isNaN(score)) {
      $(starlightEl).removeClass();
      $(rateInfoEl).find("small.fade").text("--");
    } else {
      $(starlightEl).removeClass()
        .addClass("starlight")
        .addClass(`stars${Math.round(score)}`);
      $(rateInfoEl).find("small.fade").text(score.toFixed(4));
    }
    $(rateInfoEl).find(".tip_j").text(`(${votesData.totalVotes}人评分)`);
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
