import Global from "../global";
import { processCluetip } from "../element-processors/cluetip";

export async function processSubjectPage(): Promise<void> {
  const { update: updateCluetip } = processCluetip();

  let isMouseOver = false;
  $("ul.prg_list > li").each((_, liEl) => {
    $(liEl).on("mouseover", () => {
      if (isMouseOver) return;
      isMouseOver = true;
      const aEl = $(liEl).find("a");

      const episodeID = (() => {
        const href = $(aEl).attr("href")!;
        const match = href.match(/^\/ep\/(\d+)/);
        return Number(match![1]);
      })();

      updateCluetip({
        subjectID: Global.subjectID!,
        episodeID,
        hasUserWatched: aEl.hasClass("epBtnWatched"),
      });
    })
      .on("mouseout", () => {
        isMouseOver = false;
      });
  });
}
