import { describeScoreEx, Score, scores } from "../definitions";
import { Watched } from "../utils";

export function renderStars(
  el: JQuery<HTMLElement>,
  props: {
    hoveredScore: Watched<Score | null | "cancel">;
    onRateEpisode: (score: Score) => void;
    onUpdateScoreToAlarm: (score: Score | null) => void;
  },
) {
  el = $(/*html*/ `
    <div class="stars-container">
      <div class="rating-cancel"><a title="Cancel Rating"></a></div>
    </div>
  `).replaceAll(el);

  for (const score of scores) {
    const starEl = $(/*html*/ `
      <div class="star-rating">
        <a></a>
      </div>
    `);
    el.append(starEl);

    const aEl = starEl.find("a");
    aEl.text(score);
    aEl.attr("title", describeScoreEx(score));

    starEl
      .on("mouseover", () => props.hoveredScore.setValue(score))
      .on("mouseout", () => props.hoveredScore.setValue(null))
      .on("click", () => props.onRateEpisode(score));
  }

  function updateStarsContainer(
    params:
      | ["normal", {
        ratedScore: Score | null;
        hoveredScore: Score | null | "cancel";
      }]
      | ["invisible"],
  ) {
    if (params[0] === "invisible") {
      el.css("display", "none");
      return;
    }
    el.css("display", "");
    const [_, { ratedScore, hoveredScore }] = params;

    const isHovering = hoveredScore !== null;
    const maxScoreToHighlight = hoveredScore ?? ratedScore ?? null;

    {
      // 与 bangumi 自身的行为保持一致，即：悬浮在取消图标上时，显示原先打的分。
      let alarmScore = maxScoreToHighlight;
      if (alarmScore === "cancel") {
        alarmScore = ratedScore;
      }
      props.onUpdateScoreToAlarm(alarmScore);
    }

    const starEls = el.find(".star-rating");
    for (const score of scores) {
      const starEl = starEls.eq(score - 1);
      starEl.removeClass("star-rating-on").removeClass("star-rating-hover");
      if (
        typeof maxScoreToHighlight === "number" &&
        score <= maxScoreToHighlight
      ) {
        starEl.addClass(isHovering ? "star-rating-hover" : "star-rating-on");
      }
    }

    $(el).find(".rating-cancel").removeClass("star-rating-hover");
    if (hoveredScore === "cancel") {
      $(el).find(".rating-cancel").addClass("star-rating-hover");
    }
  }

  return { updateStarsContainer };
}
