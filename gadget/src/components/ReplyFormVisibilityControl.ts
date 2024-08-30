import { Watched } from "../utils";
import { renderVisibilityButton } from "./VisibilityButton";

export function renderReplyFormVisibilityControl(
  el: JQuery<HTMLElement>,
  opts: {
    isVisibilityCheckboxRelevant: Watched<boolean>;
    visibilityCheckboxValue: Watched<boolean>;
    currentVisibility: Watched<{ isVisible: boolean } | null>;
  },
) {
  el = $(/*html*/ `
    <div style="height: 30.5px; float: right; display: flex; align-items: center;">
      <label>
        <input type="checkbox" />不要在我的吐槽旁公开我对本集的评分
      </label>
      <p>
        我的吐槽旁<span data-sel="negative-word">不</span>会公开我对本集的评分
        <div data-sel="button"></div>
      </p>
    </div>
  `).replaceAll(el);

  const checkBoxEl = $(el).find('input[type="checkbox"]');

  const unwatchFn1 = opts.visibilityCheckboxValue.watch((value) => {
    $(checkBoxEl).prop("checked", value);
  });
  $(checkBoxEl).on("change", () => {
    opts.visibilityCheckboxValue.setValue($(checkBoxEl).is(":checked"));
  });

  const unwatchFn2 = opts.isVisibilityCheckboxRelevant.watch((isRelevant) => {
    $(el).find("label").css("display", isRelevant ? "flex" : "none");
  });
  const unwatchFn3 = opts.currentVisibility.watch((currentVisibility) => {
    if (currentVisibility === null) {
      $(el).find("p").css("display", "none");
    } else {
      $(el).find("p").css("display", "");
      if (currentVisibility.isVisible) {
        $(el).find('[data-sel="negative-word"]').css("display", "none");
      } else {
        $(el).find('[data-sel="negative-word"]').css("display", "");
      }
    }
  });

  const buttonEl = $(el).find('[data-sel="button"]');
  renderVisibilityButton(buttonEl, opts);

  function unmount() {
    [unwatchFn1, unwatchFn2, unwatchFn3].forEach((fn) => fn());
  }

  return { unmount };
}
