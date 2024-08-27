import { renderMyRating } from "../components/MyRating";
import { renderRateInfo } from "../components/RateInfo";
import { Score } from "../definitions";
import Global from "../global";
import { VotesData } from "../models/VotesData";
import { Watched } from "../utils";

export async function processSubjectEpListPage() {
  const editEpBatchEl = $('[name="edit_ep_batch"]');

  let loadingEl: JQuery<HTMLElement> | undefined;
  $(editEpBatchEl).find("li").each((_, li) => {
    if (!$(li).find('[name="ep_mod[]"]').length) return;

    $(/*html*/ `<div class="clear"></div>`).insertAfter($(li).find("h6"));

    loadingEl = $(/*html*/ `
      <div class="__bgm-ep-ratings-loading grey" style="float: right;">
        单集评分加载中…
      </div>
    `);
    $(li).append(loadingEl);

    return false;
  });

  const epsRatings = await Global.client.mustGetSubjectEpisodesRatings({
    subjectID: Global.subjectID!,
  });
  if (loadingEl) {
    loadingEl.remove();
  }

  if (!epsRatings.my_ratings) {
    Global.token.setValue(null);
  }

  let isFirst_ = true;
  $(editEpBatchEl).find("li").each((_, li) => {
    if (!$(li).find('[name="ep_mod[]"]').length) return;

    const isFirst = isFirst_;
    isFirst_ = false;

    if (!isFirst) {
      $(/*html*/ `<div class="clear"></div>`).insertAfter($(li).find("h6"));
    }

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

    const myRating = epsRatings.my_ratings?.[episodeID];
    const hasUserWatched = $(li).find(".statusWatched").length ||
      // 在 “看过” 之类不能修改章节观看状态的情况下，没法确认用户是否看过，但至
      // 少可以假设用户在给了某集评分的时候是看过那一集的。
      myRating !== undefined;

    const myRatingEl = $("<div />");
    $(li).append(myRatingEl);
    renderMyRating(myRatingEl, {
      episodeID,
      ratedScore: (myRating ?? null) as Score | null,
      isPrimary: isFirst,
      canRefetchAfterAuth: false,
    });

    const rateInfoEl = $("<div />");
    $(li).append(rateInfoEl);
    renderRateInfo(rateInfoEl, {
      votesData: new Watched<VotesData | null>(votesData),
      requiresClickToReveal: //
        new Watched(!hasUserWatched && !!votesData.totalVotes),
    });

    $(li).append($(/*html*/ `<div class="clear"></div>`));
  });
}
