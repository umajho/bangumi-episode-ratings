import { Watched } from "../utils/watched";

export function renderSmallStars(
  el: JQuery<HTMLElement>,
  props: { score: Watched<number>; shouldShowNumber: boolean },
) {
  el = $(/*html*/ `
    <span>
      <span class="starstop-s">
        <span data-sel="starlight" class="starlight"></span>
      </span>
      <small class="fade"></small>
    </span>

  `).replaceAll(el);

  const starlightEl = $(el).find('[data-sel="starlight"]');

  if (!props.shouldShowNumber) {
    $(el).find("small.fade").remove();
  }

  props.score.watch((score) => {
    if (Number.isNaN(score)) {
      $(starlightEl).removeClass();
      if (props.shouldShowNumber) {
        $(el).find("small.fade").text("--");
      }
    } else {
      $(starlightEl).removeClass()
        .addClass("starlight")
        .addClass(`stars${Math.round(score)}`);
      if (props.shouldShowNumber) {
        $(el).find("small.fade").text(score.toFixed(4));
      }
    }
  });
}
