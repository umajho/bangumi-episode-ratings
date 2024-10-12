import Global from "../global";
import { GetUserTimeLineItemsResponseData } from "../shared/dto";
import { Watched } from "../utils/watched";
import {
  formatDate,
  formatDatesDifferences,
  formatDateToTime,
} from "../utils/date-formatting";
import { observeInteractionWithViewportOnce } from "../utils/simple-intersection-observer";
import { renderSmallStars } from "./SmallStars";
import { renderTooltip } from "./Tooltip";

export function renderTimelineContent(el: JQuery<HTMLElement>, props: {
  data: GetUserTimeLineItemsResponseData;
  dataAttributeName: string;
  onClickPreviousPageButton: (() => void) | null;
  onClickNextPageButton: (() => void) | null;
}) {
  const now = new Date();

  const episodeToSubjectMap = makeEpisodeToSubjectMap(props.data.subjects);

  el = $(/*html*/ `
    <div id="timeline" style="position: relative;">
    </div>
  `).replaceAll(el);

  el.attr(props.dataAttributeName, "true");

  let lastDateStr: string | null = null;
  let ulEl!: JQuery<HTMLElement>;
  let tooltip!: ReturnType<typeof renderTooltip>;

  let lastUserTextID: string | null = null;
  for (const [timestampMs, type, payload] of props.data.items) {
    const date = new Date(timestampMs);
    const dateStr = formatDate(date, { now });
    if (lastDateStr !== dateStr) {
      lastDateStr = dateStr;
      el.append(/*html*/ `<h4 class="Header">${dateStr}</h4>`);
      ulEl = $("<ul>").appendTo(el);
      lastUserTextID = null;
    }

    let userTextID: string | null = null;
    let episodeID: number | null = null;
    let subjectID: number | null = null;
    let itemEl: JQuery<HTMLElement> | null = null;
    if (type === "rate-episode") {
      userTextID = Global.claimedUserTextID;
      const userName = Global.claimedUserName;
      episodeID = payload.episode_id;
      itemEl = $(/*html*/ `
        <li class="clearit tml_item">
          <span class="info clearit">
            <span>
              <a href="/user/${userTextID}" class="l">${userName}</a>
              为剧集
              <a data-sel="ep-title-link" href="/ep/${episodeID}" class="l">${episodeID}</a>
              <span data-sel="action"></span>
            </span>
          </span>
        </li>
      `).appendTo(ulEl);

      const actionEl = itemEl.find("[data-sel='action']");
      if (payload.score !== null) {
        actionEl.html('评分 <span data-sel="stars"></span>');
        renderSmallStars(actionEl.find("[data-sel='stars']"), {
          score: new Watched(payload.score),
          shouldShowNumber: false,
        });
      } else {
        actionEl.html("取消评分");
      }

      subjectID = episodeToSubjectMap[episodeID];
    }

    const epTitleLinkEl = itemEl?.find("[data-sel='ep-title-link']");
    epTitleLinkEl?.each((_, el) => {
      observeInteractionWithViewportOnce(el, async () => {
        $(el).text($(el).text() + "（加载中…）");
        const title = await Global.bangumiClient.getEpisodeTitle(episodeID!);
        $(el).text(title);
      });
    });

    const infoEl = itemEl?.find(".info");
    if (infoEl?.length) {
      if (subjectID) {
        const cardEl = $(/*html*/ `
          <div class="card card_tiny">
            <div class="container">
              <a href="/subject/${subjectID}">
                <span class="cover">
                  <img loading="lazy">
                </span>
              </a>
            </div>
          </div>
        `).appendTo(infoEl);

        const url =
          `https://api.bgm.tv/v0/subjects/${subjectID}/image?type=grid`;
        cardEl.find("img").attr("src", url);
      }

      {
        const extraEl = $(/*html*/ `
          <div class="post_actions date">
            <span class="titleTip"></span>
            · <small class="grey"><a target="_blank">单集评分</a></small>
          </div>
        `).appendTo(infoEl);
        if (process.env.GADGET_PAGE_PATH) {
          extraEl.find("a").attr("href", process.env.GADGET_PAGE_PATH);
        }

        const titleTipEl = extraEl.find(".titleTip");
        titleTipEl.text(formatDatesDifferences(date, now));

        titleTipEl
          .on("mouseover", () => {
            tooltip.updateVisibility(true);
            const relativeLeft = titleTipEl.offset()!.left - el.offset()!.left;
            const relativeTop = titleTipEl.offset()!.top - el.offset()!.top;
            tooltip.updateLeft(relativeLeft + titleTipEl.width()! / 2);
            tooltip.updateTop(relativeTop);
            tooltip.updateContent(formatDateToTime(date));
          })
          .on("mouseout", () => tooltip.updateVisibility(false));
      }
    }

    if (itemEl && lastUserTextID !== userTextID) {
      const avatarEl = $(/*html*/ `
        <span class="avatar">
          <a href="/user/${userTextID}" class="avatar">
            <span class="avatarNeue avatarReSize40 ll"></span>
          </a>
        </span>
      `)
        .prependTo(ulEl.find("> li:last"));

      if (userTextID) {
        const safeUserTextID = encodeURIComponent(userTextID);
        const url =
          `https://api.bgm.tv/v0/users/${safeUserTextID}/avatar?type=small`;
        avatarEl.find(".avatarNeue").css("background-image", `url('${url}')`);
      }

      lastUserTextID = userTextID;
    }
  }

  {
    const pagerEl = $(/*html*/ `
      <div id="tmlPager">
        <div class="page_inner"></div>
      </div>
    `).appendTo(el);

    const innerEl = pagerEl.find(".page_inner");
    if (props.onClickPreviousPageButton) {
      const prevEl = $(/*html*/ `<a class="p">‹‹上一页</a>`)
        .appendTo(innerEl);
      prevEl.on("click", (ev) => {
        ev.preventDefault();
        props.onClickPreviousPageButton!();
      });
    }
    if (props.onClickNextPageButton) {
      const nextEl = $(/*html*/ `<a class="p">下一页››</a>`)
        .appendTo(innerEl);
      nextEl.on("click", (ev) => {
        ev.preventDefault();
        props.onClickNextPageButton!();
      });
    } else {
      $(/*html*/ `<span>没有下一页了…</span>`)
        .appendTo(innerEl);
    }
  }

  tooltip = renderTooltip($("<div />").appendTo(el), {
    initialStyle: "transform: translate(-50%, -100%);",
  });
}

function makeEpisodeToSubjectMap(
  subjectsData: GetUserTimeLineItemsResponseData["subjects"],
): Record<number, number> {
  const map: Record<number, number> = {};

  for (const [subjectID_, subjectData] of Object.entries(subjectsData)) {
    const subjectID = Number(subjectID_);
    for (const episodeID of subjectData.episode_ids) {
      map[episodeID] = subjectID;
    }
  }

  return map;
}
