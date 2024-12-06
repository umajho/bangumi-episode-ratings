import Global from "../global";
import { processCluetip } from "../element-processors/cluetip";
import { renderErrorWithRetry } from "../components/ErrorWithRetry";
import { renderTimelineContent } from "../components/TimelineContent";

const TIMELINE_CONTENT_DATA_ATTRIBUTE_NAME =
  "data-bgm-ep-ratings-timeline-content";

const TIMELINE_TOP_BAR_ID = "__bgm_ep_ratings__tl_top_bar";

export async function processRootPage() {
  $(".load-epinfo").each((_, el) => {
    const href = $(el).attr("href");
    const title = $(el).attr("title");
    if (!href || !title) return;

    const episodeID = Number(href.split("/").at(-1));
    const m = /^ep\.(.+?) (.+)$/.exec(title);
    if (isNaN(episodeID) || !m) return;

    const sort = Number(m[1]);
    const name = m[2];
    if (isNaN(sort)) return;

    Global.bangumiClient.putEntryIntoEpisodeCache(episodeID, { name, sort });
  });

  const { update: updateCluetip } = processCluetip();

  let isMouseOver = false;
  $("ul.prg_list > li").each((_, liEl) => {
    if (!$(liEl).find(".load-epinfo").length) return;

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

  const tlButtonID = "__bgm_ep_ratings__tl_button";
  Global.token.watch((token) => {
    if (!token) {
      $(`#${tlButtonID}`).remove();
      if ($(`#tmlContent [${TIMELINE_CONTENT_DATA_ATTRIBUTE_NAME}]`).length) {
        backToMainTimelineTab();
      }
      return;
    }

    $(/*html*/ `
      <li id="${tlButtonID}">
        <a style="cursor: pointer;">
          <span>我的单集评分</span>
        </a>
      </li>`)
      .appendTo("ul#timelineTabs > li:has(a.top) > ul")
      .on("click", async () => {
        $("#timelineTabs > li > a.focus").removeClass("focus");

        const containerEl = $("#tmlContent");

        if (!containerEl.find(`#${TIMELINE_TOP_BAR_ID}`).length) {
          $(/*html*/ `
            <div id="${TIMELINE_TOP_BAR_ID}">
              <button>导出我的单集评分数据</button>
            </div>
          `)
            .prependTo(containerEl)
            .on("click", () => {
              Global.client.downloadMyEpisodeRatingsData();
            });
        }

        await processMyTimelineContent(containerEl, { pageNumber: 1 });
      });
  });
}

async function processMyTimelineContent(
  containerEl: JQuery<HTMLElement>,
  opts: { pageNumber: number },
) {
  renderLoading(clearContainerAndGetNewChildElement(containerEl), {
    attributeName: TIMELINE_CONTENT_DATA_ATTRIBUTE_NAME,
  });

  const resp = await Global.client.getMyTimelineItems(opts);

  if (resp[0] === "auth_required") {
    Global.token.setValue(null);
    backToMainTimelineTab();
  } else if (resp[0] === "error") {
    const [_, _name, message] = resp;
    renderErrorWithRetry(clearContainerAndGetNewChildElement(containerEl), {
      message,
      onRetry: () => processMyTimelineContent(containerEl, opts),
    });
  } else {
    resp[0] satisfies "ok";
    const [_, data] = resp;

    const onClickPreviousPageButton = opts.pageNumber > 1
      ? () =>
        processMyTimelineContent(containerEl, {
          pageNumber: opts.pageNumber - 1,
        })
      : null;
    const isPageFull =
      data.items.length === Global.client.TIMELINE_ITEMS_PER_PAGE;
    const onClickNextPageButton = (opts.pageNumber < 10 && isPageFull)
      ? () =>
        processMyTimelineContent(containerEl, {
          pageNumber: opts.pageNumber + 1,
        })
      : null;

    renderTimelineContent(clearContainerAndGetNewChildElement(containerEl), {
      data,
      dataAttributeName: TIMELINE_CONTENT_DATA_ATTRIBUTE_NAME,
      onClickPreviousPageButton,
      onClickNextPageButton,
    });
  }
}

function renderLoading(
  el: JQuery<HTMLElement>,
  opts: { attributeName: string },
) {
  $(/*html*/ `
  <div class="loading">
    <img src="/img/loadingAnimation.gif">
  </div>`)
    .replaceAll(el)
    .attr(opts.attributeName, "true");
}

function backToMainTimelineTab() {
  $("#tab_all").trigger("click");
}

function clearContainerAndGetNewChildElement(containerEl: JQuery<HTMLElement>) {
  containerEl.children()
    .filter((_, el) => el.id !== TIMELINE_TOP_BAR_ID)
    .remove();
  return $("<div />").appendTo(containerEl);
}
