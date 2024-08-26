import { renderSmallGreyScore } from "../components/SmallGreyScore";
import { Score } from "../definitions";
import Global from "../global";
import { VotesData } from "../models/VotesData";

export async function processSubjectEpListPage() {
  const epsRatings = await Global.client.mustGetSubjectEpisodesRatings();

  $('[name="edit_ep_batch"] li').each((_, li) => {
    if (!$(li).find(".listEpPrgManager").length) return;

    const episodeID = (() => {
      const href = $(li).find("> h6 > a").attr("href")!;
      const match = /\/ep\/(\d+)/.exec(href);
      return Number(match![1]);
    })();

    const ratings = epsRatings.episodes_votes[episodeID];
    if (
      !epsRatings.is_certain_that_episodes_votes_are_integral &&
      ratings === undefined
    ) {
      // TODO: 在此种情况时，允许用户主动获取。
      return;
    }
    const votesData = new VotesData(ratings ?? {} as { [_ in Score]?: number });

    const smallEl = $("<div />");
    smallEl.insertBefore($(li).find("small.grey").eq(-1));
    renderSmallGreyScore(smallEl, {
      votesData,
      requiresClickToReveal: !$(li).find(".statusWatched").length &&
        !!votesData.totalVotes,
    });
  });
}
