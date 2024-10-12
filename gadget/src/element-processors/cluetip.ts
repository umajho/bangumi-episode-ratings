import Global from "../global";
import { renderRateInfo } from "../components/RateInfo";
import { VotesData } from "../models/VotesData";
import { Watched } from "../utils/watched";
import { Score } from "../definitions";
import { renderErrorWithRetry } from "../components/ErrorWithRetry";

export function processCluetip() {
  let counter = 0;

  const revealed: { [key: string]: boolean } = {};

  async function update(
    opts: { subjectID: number; episodeID: number; hasUserWatched: boolean },
  ) {
    // XXX: 也不知道什么原因，如果把获取 `el` 的地方放到 update 函数外，执行
    // update 函数时 `el` 是有可能已经不在文档的 DOM 上的。估计是在这期间有什么
    // 其他脚本直接动了 `innerHTML`，导致 `el` 不再是表面上的 `#cluetip`。不管怎
    // 样，看起来只要把获取 `el` 的地方放到这里就能解决问题了。
    const el = $("#cluetip");

    const popupEl = $(el).find(".prg_popup");
    if (popupEl.attr("data-bgm-ep-ratings-initialized")) return;
    popupEl.attr("data-bgm-ep-ratings-initialized", "true");

    counter++;
    const currentCounter = counter;

    if (!Global.client.hasCachedSubjectEpisodesRatings(opts.subjectID)) {
      // 确保用户不是只是无意划过。
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (currentCounter !== counter || !popupEl.is(":visible")) return;
    }

    const loadingEl = $(/*html*/ `
      <div style="color: grey">
        单集评分加载中…
      </div>
    `).insertBefore(
      // `:first` 用于兼容 https://bangumi.tv/dev/app/3265。
      $(popupEl).find(".tip .board:first"),
    );

    updateInternal({ ...opts, currentCounter, loadingEl, popupEl });
  }

  async function updateInternal(
    opts: {
      subjectID: number;
      episodeID: number;
      hasUserWatched: boolean;

      currentCounter: number;

      loadingEl: JQuery<HTMLElement>;
      popupEl: JQuery<HTMLElement>;
    },
  ) {
    const resp = await Global.client.getSubjectEpisodesRatings({
      subjectID: opts.subjectID,
    });
    if (resp[0] === "error") {
      const [_, _name, message] = resp;
      const { el } = renderErrorWithRetry(opts.loadingEl, {
        message,
        onRetry: () => updateInternal(opts),
      });
      opts.loadingEl = el;
      return;
    }

    resp[0] satisfies "ok";
    const [_, epsRatings] = resp;

    opts.loadingEl.remove();

    if (opts.currentCounter !== counter) return;

    const votesData = new Watched(
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

    const rateInfoEl = $("<div />").insertBefore(
      // `:first` 用于兼容 https://bangumi.tv/dev/app/3265。
      $(opts.popupEl).find(".tip .board:first"),
    );
    renderRateInfo(rateInfoEl, {
      votesData,
      requiresClickToReveal,
      onReveal: () => {
        revealed[`${opts.subjectID}:${opts.episodeID}`] = true;
      },
    });

    $(opts.popupEl).find(".epStatusTool > a.ep_status").each(
      (_, epStatusEl) => {
        if (epStatusEl.id.startsWith("Watched")) {
          $(epStatusEl).on("click", () => revealScore());
        }
      },
    );
  }

  return { update };
}
