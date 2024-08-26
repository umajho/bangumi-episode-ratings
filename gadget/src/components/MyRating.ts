import { describeScore, Score, scores } from "../definitions";
import { Watched } from "../utils";
import Global from "../global";

export function renderMyRating(
  el: JQuery<HTMLElement>,
  props: { ratedScore: Score | null },
) {
  const ratedScore = new Watched<Score | null>(props.ratedScore);
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

  ratedScore.watchDeferred((ratedScore) =>
    updateStarsContainer(["normal", {
      ratedScore,
      hoveredScore: hoveredScore.getValueOnce(),
    }])
  );
  hoveredScore.watch((hoveredScore) =>
    updateStarsContainer(["normal", {
      ratedScore: ratedScore.getValueOnce(),
      hoveredScore,
    }])
  );

  function updateStarsContainer(
    params:
      | ["normal", {
        ratedScore: Score | null;
        hoveredScore: Score | null | "cancel";
      }]
      | ["invisible"],
  ) {
    if (params[0] === "invisible") {
      starsContainerEl.css("display", "none");
      return;
    }
    starsContainerEl.css("display", "");
    const [_, { ratedScore, hoveredScore }] = params;

    const isHovering = hoveredScore !== null;
    const maxScoreToHighlight = hoveredScore ?? ratedScore ?? null;

    {
      // 与 bangumi 自身的行为保持一致，即：悬浮在取消图标上时，显示原先打的分。
      let alarmScore = maxScoreToHighlight;
      if (alarmScore === "cancel") {
        alarmScore = ratedScore;
      }
      if (alarmScore !== null) {
        $(el).find(".alarm").text(describeScoreEx(alarmScore));
      } else {
        $(el).find(".alarm").text("");
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
    value:
      | ["none"]
      | ["processing"]
      | ["loading"]
      | ["error", string]
      | ["auth_link"]
      | ["requiring_fetch"],
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
      case "loading": {
        messageEl.text("加载中…");
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
          若要为单集评分，或查看自己先前的单集评分，
          <br >
          请先<a class="l" target="_blank">授权此应用</a>。
          <br >
          单集评分应用需要以此来确认登录者。
        `);
        $(messageEl).find("a").attr(
          "href",
          Global.client.URL_AUTH_BANGUMI_PAGE,
        );
        break;
      }
      case "requiring_fetch": {
        messageEl.html(/*html*/ `
          点击<button class="l">此处</button>或刷新本页以获取。 
        `);
        $(messageEl).find("button").on("click", async () => {
          updateMessage(["loading"]);
          const resp = await Global.client.getMyEpisodeRating();
          if (resp[0] === "auth_required") {
            Global.token.setValue(null);
          } else if (resp[0] === "error") {
            const [_, _name, message] = resp;
            updateMessage(["error", message]);
          } else if (resp[0] === "ok") {
            const [_, data] = resp;
            updateMessage(["none"]);
            ratedScore.setValue(data.score as Score | null);
          } else {
            resp satisfies never;
          }
        });
        break;
      }
      default:
        value satisfies never;
    }
  }
  updateMessage(["none"]);

  Global.token.watch((newToken, oldToken) => {
    if (newToken) {
      if (oldToken !== undefined) {
        updateMessage(["requiring_fetch"]);
        updateStarsContainer(["invisible"]);
      } else {
        updateMessage(["none"]);
      }
    } else {
      updateMessage(["auth_link"]);
      updateStarsContainer(["invisible"]);
    }
  });

  async function rateEpisode(scoreToRate: Score | null) {
    if (!Global.token.getValueOnce()) return;

    updateMessage(["processing"]);

    const resp = await Global.client.rateEpisode({
      userID: Global.claimedUserID!,
      subjectID: Global.subjectID!,
      episodeID: Global.episodeID!,
      score: scoreToRate,
    });

    if (resp[0] === "auth_required") {
      updateMessage(["auth_link"]);
    } else if (resp[0] === "error") {
      const [_, _name, message] = resp;
      updateMessage(["error", message]);
    } else if (resp[0] === "ok") {
      const [_, data] = resp;
      updateMessage(["none"]);
      ratedScore.setValue(data.score as Score | null);
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
