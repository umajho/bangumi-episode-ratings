import { createHelloElement } from "../components/Hello";

export function processCluetip() {
  function initializeCluetip() {
    const el = document.querySelector("#cluetip");
    if (!el) return;
    const popupEl = el.querySelector(".prg_popup");
    if (!popupEl) return;

    if (popupEl.getAttribute("data-bgm-ep-ratings-initialized")) return;
    popupEl.setAttribute("data-bgm-ep-ratings-initialized", "true");

    const firstBoardEl = popupEl.querySelector(".tip .board");
    if (!firstBoardEl) return;

    const helloEl = createHelloElement();
    firstBoardEl.insertAdjacentElement("beforebegin", helloEl);
  }

  return { initializeCluetip };
}
