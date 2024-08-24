import { describeScore, Score, scores } from "../definitions";
import { Watched } from "../utils";

export function renderMyRating(
  el: JQuery<HTMLElement>,
  props: {
    score: Watched<Score | null>;
    submitScore: (score: Score | null) => void;
  },
) {
  const hoveredScore = new Watched<Score | null | "cancel">(null);

  el = $(/*html*/ `
    <div style="float: right;">
      <p>我的评价:
        <span class="alarm"></span>
      </p>
      <div class="stars-container">
        <div class="rating-cancel"><a title="Cancel Rating"></a></div>
      </div>
    </div>
  `).replaceAll(el);

  const starsContainerEl = el.find(".stars-container");
  for (const score of scores) {
    const starEl = $(/*html*/ `
      <div class="star-rating">
        <a></a>
      </div>
    `);
    starsContainerEl.append(starEl);

    const aEl = starEl.find("a");
    aEl.text(score);
    aEl.attr("title", describeScoreEx(score));

    starEl
      .on("mouseover", () => hoveredScore.setValue(score))
      .on("mouseout", () => hoveredScore.setValue(null))
      .on("click", () => props.submitScore(score));
  }

  $(".rating-cancel")
    .on("mouseover", () => hoveredScore.setValue("cancel"))
    .on("mouseout", () => hoveredScore.setValue(null))
    .on("click", () => props.submitScore(null));

  props.score.watchDeferred((score) =>
    updateStarsContainer(score, hoveredScore.getValueOnce())
  );
  hoveredScore.watch((hoveredScore) =>
    updateStarsContainer(props.score.getValueOnce(), hoveredScore)
  );

  function updateStarsContainer(
    ratedScore: Score | null,
    hoveredScore: Score | null | "cancel",
  ) {
    const isHovering = hoveredScore !== null;
    const maxScoreToHighlight = hoveredScore ?? ratedScore ?? null;

    {
      // 与 bangumi 自身的行为保持一致，即：悬浮在取消图标上时，显示原先打的分。
      let alarmScore = maxScoreToHighlight;
      if (alarmScore === "cancel") {
        alarmScore = ratedScore;
      }
      if (alarmScore !== null) {
        $(".alarm").text(describeScoreEx(alarmScore));
      } else {
        $(".alarm").text("");
      }
    }

    const starEls = starsContainerEl.find(".star-rating");
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

    $(".rating-cancel").removeClass("star-rating-hover");
    if (hoveredScore === "cancel") {
      $(".rating-cancel").addClass("star-rating-hover");
    }
  }

  return el;
}

function describeScoreEx(score: Score) {
  let description = `${describeScore(score)} ${score}`;
  if (score === 1 || score === 10) {
    description += " (请谨慎评价)";
  }

  return description;
}
