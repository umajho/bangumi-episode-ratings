import { processCluetip } from "../element-processors/cluetip";

export async function processRootPage() {
  const { update: updateCluetip } = processCluetip();

  let isMouseOver = false;
  $("ul.prg_list > li").each((_, liEl) => {
    $(liEl).on("mouseover", () => {
      if (isMouseOver) return;
      isMouseOver = true;
      const aEl = $(liEl).find("a");

      const subjectID = Number($(aEl).attr("subject_id"));
      const episodeID = (() => {
        const href = $(aEl).attr("href")!;
        const match = href.match(/^\/ep\/(\d+)/);
        return Number(match![1]);
      })();

      updateCluetip({
        subjectID,
        episodeID,
        hasUserWatched: aEl.hasClass("epBtnWatched"),
      });
    })
      .on("mouseout", () => {
        isMouseOver = false;
      });
  });
}
