import { describeScoreEx, Score } from "../definitions";
import { Watched } from "../utils";
import Global from "../global";
import { renderStars } from "./Stars";
import { VotesData } from "../models/VotesData";

export function renderMyRating(
  el: JQuery<HTMLElement>,
  props: {
    episodeID: number;
    ratedScore: Score | null;
    isPrimary: boolean;
    canRefetchAfterAuth: boolean;
    votesData: Watched<VotesData>;
  },
) {
  const ratedScore = new Watched<Score | null>(props.ratedScore);
  const hoveredScore = new Watched<Score | null | "cancel">(null);

  el = $(/*html*/ `
    <div style="float: right; display: flex; flex-direction: column;">
      <p style="font-size: 12px;">我的评价:
        <span class="alarm"></span>
      </p>
      <div class="stars-container"></div>
      <div class="message"></div>
    </div>
  `).replaceAll(el);

  const starsContainerEl = el.find(".stars-container");
  const { updateStarsContainer } = renderStars(starsContainerEl, {
    hoveredScore,
    onRateEpisode: rateEpisode,
    onUpdateScoreToAlarm: (score) => {
      if (score !== null) {
        $(el).find(".alarm").text(describeScoreEx(score));
      } else {
        $(el).find(".alarm").text("");
      }
    },
  });

  $(el).find(".rating-cancel")
    .on("mouseover", () => hoveredScore.setValue("cancel"))
    .on("mouseout", () => hoveredScore.setValue(null))
    .on("click", () => rateEpisode(null));

  ratedScore.watchDeferred((ratedScore) =>
    updateStarsContainer(["normal", {
      ratedScore,
      hoveredScore: hoveredScore.getValueOnce(),
    }])
  );
  hoveredScore.watch((hoveredScore) => {
    updateStarsContainer(["normal", {
      ratedScore: ratedScore.getValueOnce(),
      hoveredScore,
    }]);
  });

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
          若要查看或提交自己的单集评分，
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
        if (props.canRefetchAfterAuth) {
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
              updateVotesData(props.votesData, {
                oldScore: ratedScore.getValueOnce(),
                newScore: data.score as Score | null,
              });
              ratedScore.setValue(data.score as Score | null);
            } else {
              resp satisfies never;
            }
          });
        } else {
          messageEl.text("请刷新本页以获取。 ");
        }
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
        if (props.isPrimary) {
          updateMessage(["requiring_fetch"]);
        }
        updateStarsContainer(["invisible"]);
      } else {
        updateMessage(["none"]);
      }
    } else {
      if (props.isPrimary) {
        updateMessage(["auth_link"]);
      } else {
        el.css("display", "none");
      }
      updateStarsContainer(["invisible"]);
    }
  });

  async function rateEpisode(scoreToRate: Score | null) {
    if (!Global.token.getValueOnce()) return;

    updateMessage(["processing"]);

    const resp = await Global.client.rateEpisode({
      subjectID: Global.subjectID!,
      episodeID: props.episodeID,
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
      updateVotesData(props.votesData, {
        oldScore: ratedScore.getValueOnce(),
        newScore: data.score as Score | null,
      });
      ratedScore.setValue(data.score as Score | null);
    } else {
      resp satisfies never;
    }
  }
}

function updateVotesData(
  votesData: Watched<VotesData>,
  opts: {
    oldScore: Score | null;
    newScore: Score | null;
  },
) {
  const newVotesData = votesData.getValueOnce().getClonedData();

  if (opts.oldScore !== null) {
    newVotesData[opts.oldScore]!--;
  }
  if (opts.newScore !== null) {
    newVotesData[opts.newScore] ??= 0;
    newVotesData[opts.newScore]!++;
  }

  votesData.setValue(new VotesData(newVotesData));
}
