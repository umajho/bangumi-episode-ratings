import Global from "../global";
import { Watched } from "../utils/watched";

export function renderVisibilityButton(
  el: JQuery<HTMLElement>,
  opts: {
    /**
     * `null` 现在仅代表数据还没有加载。
     */
    currentVisibility: Watched<{ isVisible: boolean } | null>;
  },
) {
  el = $(/*html*/ `
    <span>
      <button></button>
      <span data-sel="message"></span>
    </span>
  `).replaceAll(el);

  const isDisabled = new Watched(false);

  const buttonEl = $(el).find("button");
  const messageEl = $(el).find("[data-sel='message']");

  opts.currentVisibility.watch((currentVisibility) => {
    if (currentVisibility === null) {
      $(el).css("display", "none");
      return;
    }
    $(el).css("display", "");

    if (currentVisibility.isVisible) {
      $(buttonEl).text("不再公开");
    } else {
      $(buttonEl).text("公开");
    }
  });

  isDisabled.watch((isDisabled) => {
    if (isDisabled) {
      $(buttonEl).attr("disabled", "disabled");
    } else {
      $(buttonEl).removeAttr("disabled");
    }
  });

  $(buttonEl).on("click", async () => {
    const currentVisibility = opts.currentVisibility.getValueOnce()!.isVisible;
    isDisabled.setValue(true);
    updateMessage(["processing"]);

    const result = await Global.client.patchEpisodeRating({
      subjectID: Global.subjectID!,
      episodeID: Global.episodeID!,
      isVisible: !currentVisibility,
    });

    if (result[0] === "auth_required") {
      Global.token.setValue(null);
      updateMessage(["auth_link"]);
    } else if (result[0] === "error") {
      updateMessage(["error", result[1]]);
    } else if (result[0] === "ok") {
      isDisabled.setValue(false);
      updateMessage(["none"]);
      Global.updateCurrentEpisodeVisibilityFromServerRaw(
        result[1].visibility ?? { is_visible: true },
      );
    } else {
      result satisfies never;
    }
  });

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
        messageEl.css("color", "grey");
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
        isDisabled.setValue(true);
        updateMessage(["requiring_reload"]);
      } else {
        updateMessage(["none"]);
      }
    } else {
      isDisabled.setValue(true);
      updateMessage(["auth_link"]);
    }
  });
}
