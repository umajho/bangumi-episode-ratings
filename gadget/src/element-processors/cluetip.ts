import Global from "../global";
import { renderRateInfo } from "../components/RateInfo";
import { VotesData } from "../models/VotesData";
import { Watched } from "../utils";
import { Score } from "../definitions";

export function processCluetip() {
  const el = $("#cluetip");

  let counter = 0;

  const revealed: { [key: string]: boolean } = {};

  async function update(
    opts: { subjectID: number; episodeID: number; hasUserWatched: boolean },
  ) {
    const popupEl = $(el).find(".prg_popup");
    if (popupEl.attr("data-bgm-ep-ratings-initialized")) return;
    popupEl.attr("data-bgm-ep-ratings-initialized", "true");

    counter++;
    const currentCounter = counter;

    const loadingEl = $(/*html*/ `
      <div class="grey">
        单集评分加载中…
      </div>
    `).insertBefore($(popupEl).find(".tip .board"));

    const epsRatings = await Global.client.mustGetSubjectEpisodesRatings({
      subjectID: opts.subjectID,
    });

    loadingEl.remove();

    if (currentCounter !== counter) return;

    const votesData = new Watched<VotesData | null>(
      new VotesData(
        epsRatings.episodes_votes[opts.episodeID] ??
          {} as { [_ in Score]?: number },
      ),
    );
    const requiresClickToReveal = new Watched(false);

    requiresClickToReveal.setValue(
      !(opts.hasUserWatched ||
        revealed[`${opts.subjectID}:${opts.episodeID}`] ||
        !votesData.getValueOnce()!.totalVotes),
    );

    function revealScore() {
      revealed[`${opts.subjectID}:${opts.episodeID}`] = true;
      requiresClickToReveal.setValue(false);
    }

    const rateInfoEl = $("<div />")
      .insertBefore($(popupEl).find(".tip .board"));
    renderRateInfo(rateInfoEl, {
      votesData,
      requiresClickToReveal,
      onReveal: () => {
        revealed[`${opts.subjectID}:${opts.episodeID}`] = true;
      },
    });

    $(popupEl).find(".epStatusTool > a.ep_status").each((_, epStatusEl) => {
      if (epStatusEl.id.startsWith("Watched")) {
        $(epStatusEl).on("click", () => revealScore());
      }
    });
  }

  return { update };
}
