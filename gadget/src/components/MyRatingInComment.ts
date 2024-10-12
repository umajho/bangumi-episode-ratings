import { Watched } from "../utils/watched";
import { renderSmallStars } from "./SmallStars";
import { renderVisibilityButton } from "./VisibilityButton";

export function renderMyRatingInComment(
  el: JQuery<HTMLElement>,
  opts: {
    ratedScore: Watched<number>;
    currentVisibility: Watched<{ isVisible: boolean } | null>;
  },
) {
  el = $(/*html*/ ` 
    <span>
      <div data-sel="small-stars"></div>
      <span data-sel="visibility-control">
        <span data-sel="description" style="font-size: 12px;"></span>
        <div data-sel="visibility-button"></div>
      </span>
    </span>
  `).replaceAll(el);

  const smallStarsEl = el.find('[data-sel="small-stars"]');
  const visibilityControlEl = el.find('[data-sel="visibility-control"]');
  const visibilityDescriptionEl = $(visibilityControlEl)
    .find('[data-sel="description"]');
  const visibilityButtonEl = $(visibilityControlEl)
    .find('[data-sel="visibility-button"]');

  renderSmallStars(smallStarsEl, {
    score: opts.ratedScore,
    shouldShowNumber: false,
  });

  opts.currentVisibility.watch((currentVisibility) => {
    if (currentVisibility === null) {
      visibilityControlEl.css("display", "none");
      return;
    }
    visibilityControlEl.css("display", "");

    if (currentVisibility.isVisible) {
      visibilityDescriptionEl.text("已公开评分");
      visibilityButtonEl.text("不再公开");
    } else {
      visibilityDescriptionEl.text("未公开评分");
      visibilityButtonEl.text("公开");
    }
  });

  renderVisibilityButton(visibilityButtonEl, opts);
}
