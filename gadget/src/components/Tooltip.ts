export function renderTooltip(el: JQuery<HTMLElement>, props: {
  initialStyle: string;
}) {
  el = $(/*html*/ `
    <div class="tooltip fade top in" role="tooltip">
      <div class="tooltip-arrow" style="left: 50%;"></div>
      <div class="tooltip-inner"></div>
    </div>
  `).replaceAll(el);

  el.attr("style", props.initialStyle);

  const updateVisibility = (isVisible: boolean) => {
    el.css("display", isVisible ? "block" : "none");
  };

  const updateLeft = (leftPx: number) => {
    el.css("left", `${leftPx}px`);
  };
  const updateTop = (topPx: number) => {
    el.css("top", `${topPx}px`);
  };

  const updateContent = (text: string) => {
    el.find(".tooltip-inner").text(text);
    [];
  };

  return { updateVisibility, updateLeft, updateTop, updateContent };
}
