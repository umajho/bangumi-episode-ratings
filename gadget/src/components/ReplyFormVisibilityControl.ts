import Global from "../global";
import { Watched } from "../utils/watched";
import { renderVisibilityButton } from "./VisibilityButton";

export function renderReplyFormVisibilityControl(
  el: JQuery<HTMLElement>,
  opts: {
    currentVisibility: Watched<{ isVisible: boolean } | null>;
  },
) {
  el = $(/*html*/ `
    <div style="height: 30.5px; float: right; display: flex; align-items: center;">
        我对本集的评分<span data-sel="negative-word">不</span>会公开
        <div data-sel="button"></div>
    </div>
  `).replaceAll(el);

  const unwatchFn1 = opts.currentVisibility.watch(update);
  const unwatchFn2 = Global.token.watch(update);

  function update() {
    const currentVisibility = opts.currentVisibility.getValueOnce();
    const token = Global.token.getValueOnce();

    if (currentVisibility === null || token === null) {
      $(el).css("display", "none");
      return;
    }

    $(el).css("display", "");
    if (currentVisibility.isVisible) {
      $(el).find('[data-sel="negative-word"]').css("display", "none");
    } else {
      $(el).find('[data-sel="negative-word"]').css("display", "");
    }
  }

  const buttonEl = $(el).find('[data-sel="button"]');
  renderVisibilityButton(buttonEl, opts);

  return {
    unmount: () => {
      unwatchFn1();
      unwatchFn2();
    },
  };
}
