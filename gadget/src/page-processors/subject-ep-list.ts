import { renderErrorWithRetry } from "../components/ErrorWithRetry";
import { renderMyRating } from "../components/MyRating";
import { renderRateInfo } from "../components/RateInfo";
import { Score } from "../definitions";
import Global from "../global";
import { VotesData } from "../models/VotesData";
import { Watched } from "../utils";

export async function processSubjectEpListPage() {
  const editEpBatchEl = $('[name="edit_ep_batch"]');

  let loadingEl: JQuery<HTMLElement> | null = null;
  $(editEpBatchEl).find("li").each((_, li) => {
    if (!$(li).find('[name="ep_mod[]"]').length) return;

    $(/*html*/ `<div class="clear"></div>`).insertAfter($(li).find("h6"));

    loadingEl = $(/*html*/ `
      <div style="color: grey; float: right;">
        单集评分加载中…
      </div>
    `).appendTo(li);

    return false;
  });

  if (loadingEl) {
    processSubjectEpListPageInternal({ loadingEl, editEpBatchEl });
  }
}

async function processSubjectEpListPageInternal(
  opts: {
    loadingEl: JQuery<HTMLElement>;
    editEpBatchEl: JQuery<HTMLElement>;
  },
) {
  const resp = await Global.client.getSubjectEpisodesRatings({
    subjectID: Global.subjectID!,
  });
  if (resp[0] === "error") {
    const [_, _name, message] = resp;
    const { el } = renderErrorWithRetry(opts.loadingEl, {
      message,
      onRetry: () => processSubjectEpListPageInternal(opts),
    });
    opts.loadingEl = el;
    return;
  }

  resp[0] satisfies "ok";
  const [_, epsRatings] = resp;

  if (opts.loadingEl) {
    opts.loadingEl.remove();
  }

  if (!epsRatings.my_ratings) {
    Global.token.setValue(null);
  }

  let isFirst_ = true;
  $(opts.editEpBatchEl).find("li").each((_, li) => {
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
    const votesData = new Watched(
      new VotesData(ratings ?? {} as { [_ in Score]?: number }),
    );

    const myRating = epsRatings.my_ratings?.[episodeID];
    const hasUserWatched = $(li).find(".statusWatched").length ||
      // 在 “看过” 之类不能修改章节观看状态的情况下，没法确认用户是否看过，但至
      // 少可以假设用户在给了某集评分的时候是看过那一集的。
      myRating !== undefined;

    const myRatingEl = $("<div />");
    $(li).append(myRatingEl);
    renderMyRating(myRatingEl, {
      episodeID,
      ratedScore: new Watched((myRating ?? null) as Score | null),
      isPrimary: isFirst,
      canRefetchAfterAuth: false,
      votesData,
    });

    const rateInfoEl = $("<div />");
    $(li).append(rateInfoEl);
    renderRateInfo(rateInfoEl, {
      votesData,
      requiresClickToReveal: //
        new Watched(!hasUserWatched && !!votesData.getValueOnce().totalVotes),
    });

    $(li).append($(/*html*/ `<div class="clear"></div>`));
  });
}
