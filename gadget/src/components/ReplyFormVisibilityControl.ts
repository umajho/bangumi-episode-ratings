import Global from "../global";
import { Watched } from "../utils";

export function renderReplyFormVisibilityControl(
  el: JQuery<HTMLElement>,
  opts: {
    hasUserVoted: Watched<boolean>;
    currentVisibility: Watched<{ isVisible: boolean } | null>;
  },
) {
  const isCheckboxRelevant = new Watched(true);
  function updateIsCheckboxRelevant() {
    isCheckboxRelevant.setValue(
      opts.hasUserVoted.getValueOnce() &&
        opts.currentVisibility.getValueOnce() === null,
    );
  }
  opts.hasUserVoted.watchDeferred(updateIsCheckboxRelevant);
  opts.currentVisibility.watch(updateIsCheckboxRelevant);

  el = $(/*html*/ `
    <div style="height: 30.5px; float: right; display: flex; align-items: center;">
      <label>
        <input type="checkbox" />不要在我的吐槽旁公开我对本集的评分
      </label>
      <p>
        我的吐槽旁<span data-sel="negative-word">不</span>会公开我对本集的评分。
        <button>改为<span data-sel="negative-word-flipped">不</span>公开</button>
        <span class="message"></span>
      </p>
    </div>
  `).replaceAll(el);

  isCheckboxRelevant.watch((isRelevant) => {
    $(el).find("label").css("display", isRelevant ? "flex" : "none");
  });
  opts.currentVisibility.watch((currentVisibility) => {
    if (currentVisibility === null) {
      $(el).find("p").css("display", "none");
    } else {
      $(el).find("p").css("display", "");
      if (currentVisibility.isVisible) {
        $(el).find('[data-sel="negative-word"]').css("display", "none");
        $(el).find('[data-sel="negative-word-flipped"]').css("display", "");
      } else {
        $(el).find('[data-sel="negative-word"]').css("display", "");
        $(el).find('[data-sel="negative-word-flipped"]').css("display", "none");
      }
    }
  });

  const buttonEl = $(el).find("button");
  const isButtonDisabled = new Watched(false);
  isButtonDisabled.watch((isDisabled) => {
    if (isDisabled) {
      $(buttonEl).attr("disabled", "disabled");
    } else {
      $(buttonEl).removeAttr("disabled");
    }
  });

  $(buttonEl).on("click", async () => {
    const currentVisibility = opts.currentVisibility.getValueOnce()!.isVisible;
    isButtonDisabled.setValue(true);
    updateMessage(["processing"]);

    const result = await Global.client.changeUserEpisodeRatingVisibility({
      isVisible: !currentVisibility,
    });

    if (result[0] === "auth_required") {
      Global.token.setValue(null);
      updateMessage(["auth_link"]);
    } else if (result[0] === "error") {
      updateMessage(["error", result[1]]);
    } else if (result[0] === "ok") {
      isButtonDisabled.setValue(false);
      updateMessage(["none"]);
      opts.currentVisibility.setValue({ isVisible: result[1].is_visible });
    } else {
      result satisfies never;
    }
  });

  const messageEl = el.find(".message");
  function updateMessage(
    value:
      | ["none"]
      | ["processing"]
      | ["error", string]
      | ["auth_link"]
      | ["requiring_reload"],
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
          请先<a class="l" target="_blank">授权此应用</a>。
        `);
        $(messageEl).find("a").attr(
          "href",
          Global.client.URL_AUTH_BANGUMI_PAGE,
        );
        break;
      }
      case "requiring_reload": {
        messageEl.text("请刷新本页以操作。");

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
        isButtonDisabled.setValue(true);
        updateMessage(["requiring_reload"]);
      } else {
        updateMessage(["none"]);
      }
    } else {
      isButtonDisabled.setValue(true);
      updateMessage(["auth_link"]);
    }
  });

  function getChangedVisibility(): { isVisible: boolean } | null {
    if (isCheckboxRelevant.getValueOnce()) {
      return {
        isVisible: !$(el).find('input[type="checkbox"]').is(":checked"),
      };
    }
    return null;
  }

  return { getChangedVisibility };
}
