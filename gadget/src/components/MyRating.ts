import { describeScore, Score, scores } from "../definitions";
import { Watched } from "../utils";
import * as Global from "../global";

export function renderMyRating(
  el: JQuery<HTMLElement>,
  props: { score: Watched<Score | null> },
) {
  const hoveredScore = new Watched<Score | null | "cancel">(null);

  el = $(/*html*/ `
    <div style="float: right; display: flex; flex-direction: column;">
      <p>我的评价:
        <span class="alarm"></span>
      </p>
      <div class="stars-container">
        <div class="rating-cancel"><a title="Cancel Rating"></a></div>
      </div>
      <div class="message"></div>
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
      .on("click", () => rateEpisode(score));
  }

  $(".rating-cancel")
    .on("mouseover", () => hoveredScore.setValue("cancel"))
    .on("mouseout", () => hoveredScore.setValue(null))
    .on("click", () => rateEpisode(null));

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

  const messageEl = el.find(".message");
  function updateMessage(
    value: ["none"] | ["processing"] | ["error", string] | ["auth_link"],
  ) {
    messageEl.attr("style", "");
    switch (value[0]) {
      case "none": {
        messageEl.text("");
        messageEl.css("display", "none");
        break;
      }
      case "processing": {
        messageEl.text("处理中…");
        messageEl.css("color", "gray");
        break;
      }
      case "error": {
        messageEl.text(value[1]);
        messageEl.css("color", "red");
        break;
      }
      case "auth_link": {
        messageEl.html(/*html*/ `
          请先<a class="l">关联至 Test 应用</a>。
        `);
        $(messageEl).find("a").attr(
          "href",
          Global.client.URL_AUTH_BANGUMI_PAGE,
        );
        break;
      }
      default:
        value satisfies never;
    }
  }
  updateMessage(["none"]);

  async function rateEpisode(score: Score | null) {
    if (!Global.userID) {
      updateMessage(["auth_link"]);
      return;
    }

    updateMessage(["processing"]);

    const resp = await Global.client.rateEpisode({
      userID: Global.userID,
      subjectID: Global.subjectID!,
      episodeID: Global.episodeID!,
      score,
    });

    if (resp[0] === "auth_required") {
      updateMessage(["auth_link"]);
    } else if (resp[0] === "error") {
      const [_, _name, message] = resp;
      updateMessage(["error", message]);
    } else if (resp[0] === "ok") {
      const [_, data] = resp;
      updateMessage(["none"]);
      props.score.setValue(data.score as Score | null);
    } else {
      resp satisfies never;
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
