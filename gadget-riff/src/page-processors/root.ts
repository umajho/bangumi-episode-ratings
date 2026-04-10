import { processCluetip } from "../element-processors/cluetip";

export async function processRootPage() {
  const { initializeCluetip } = processCluetip();

  let isMouseOver = false;
  for (const liEl of document.querySelectorAll("ul.prg_list > li")) {
    if (!liEl.querySelector(".load-epinfo")) continue;

    liEl.addEventListener("mouseover", () => {
      if (isMouseOver) return;
      isMouseOver = true;

      const aEl = liEl.querySelector("a");
      if (!aEl) return;

      initializeCluetip();
    });

    liEl.addEventListener("mouseout", () => {
      isMouseOver = false;
    });
  }
}
