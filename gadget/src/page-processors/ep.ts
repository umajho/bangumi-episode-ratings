import Global from "../global";
import { renderMyRating } from "../components/MyRating";
import { renderScoreboard } from "../components/Scoreboard";
import { renderScoreChart } from "../components/ScoreChart";
import { VotesData } from "../models/VotesData";
import { Score } from "../definitions";
import { Watched } from "../utils";
import { renderSmallStars } from "../components/SmallStars";
import { renderReplyFormVisibilityControl } from "../components/ReplyFormVisibilityControl";

export async function processEpPage() {
  const scoreboardEl = $(/*html*/ `
    <div class="grey" style="float: right;">
      单集评分加载中…
    </div>
  `);
  $("#columnEpA").prepend(scoreboardEl);

  const ratingsData = await Global.client.mustGetEpisodeRatings();
  const votesData = new Watched(
    new VotesData(
      ratingsData.votes as { [_ in Score]?: number },
    ),
  );
  const currentVisibility = new Watched<{ isVisible: boolean } | null>(
    ratingsData.my_rating?.visibility
      ? { isVisible: ratingsData.my_rating.visibility?.is_visible }
      : null,
    {
      broadcastID:
        `bgm_ep_ratings::broadcasts::${Global.episodeID}::visibility`,
    },
  );
  function onVisibilityChange(visibility: { isVisible: boolean } | null) {
    currentVisibility.setValue(visibility);
  }

  renderScoreboard(scoreboardEl, { votesData });

  const scoreChartEl = $("<div />").insertBefore("#columnEpA > .epDesc");
  renderScoreChart(scoreChartEl, { votesData });
  $(/*html*/ `<div class="clear" />`).insertAfter("#columnEpA > .epDesc");

  const myRatingEl = $("<div />").insertAfter(".singleCommentList > .board");
  if (!ratingsData.my_rating) {
    Global.token.setValue(null);
  }
  const ratedScore = new Watched<Score | null>(
    (ratingsData.my_rating?.score ?? null) as Score | null,
  );
  renderMyRating(myRatingEl, {
    episodeID: Global.episodeID!,
    ratedScore,
    isPrimary: true,
    canRefetchAfterAuth: true,
    votesData,
    onVisibilityChange,
  });

  const userReplyMap = await collectUserReplyMap();

  const myReplies = new Watched(collectMyReplies());

  {
    // @ts-ignore
    const oldInsertFn = chiiLib.ajax_reply.insertJsonComments;
    // @ts-ignore
    chiiLib.ajax_reply.insertJsonComments = function (...args: any[]) {
      oldInsertFn.apply(this, args);
      myReplies.setValue(collectMyReplies());
    };
  }

  const ratedScoreGeneric = ratedScore.createComputed((score) => score ?? NaN);
  myReplies.watch((myReplies) => {
    processMyUnprocessedComments({
      ratedScore: ratedScoreGeneric,
      replies: myReplies,
    });
  });

  const votersToScore = convertVotersByScoreToVotersToScore(
    ratingsData.public_ratings.public_voters_by_score as {
      [score in Score]: number[];
    },
  );
  processOtherPeoplesComments({
    votersToScore,
    userReplyMap,
    myUserID: Global.claimedUserID!,
  });

  processReplyForm({
    ratedScore,
    currentVisibility,
  });
}

function processReplyForm(opts: {
  ratedScore: Watched<Score | null>;
  currentVisibility: Watched<{ isVisible: boolean } | null>;
}) {
  const el = $("#ReplyForm");

  const submitButtonEl = $(el).find("#submitBtnO");

  const controlEl = $("<div />").insertBefore(submitButtonEl);
  const { getChangedVisibility } = renderReplyFormVisibilityControl(controlEl, {
    hasUserVoted: opts.ratedScore.createComputed((s) => s !== null),
    currentVisibility: opts.currentVisibility,
  });

  $(el.on("submit", async () => {
    const changedVisibility = getChangedVisibility();
    if (changedVisibility !== null) {
      const result = await Global.client.changeUserEpisodeRatingVisibility({
        isVisible: changedVisibility.isVisible,
      });
      if (result[0] === "auth_required") {
        Global.token.setValue(null);
      } else if (result[0] !== "ok") {
        console.warn(
          "单集评分组件",
          "`changeUserEpisodeRatingVisibility`",
          result,
        );
      }
    }
  }));
}

function processMyUnprocessedComments(opts: {
  ratedScore: Watched<number>;
  replies: ReplyLite[];
}) {
  for (const reply of opts.replies) {
    const el = $(reply.el);
    if (el.hasClass("__bgm_ep_ratings__processed")) continue;
    el.addClass("__bgm_ep_ratings__processed");

    const smallStarsEl = $("<div />").insertBefore(
      $(el).find(".inner > .reply_content,.cmt_sub_content").eq(0),
    );
    renderSmallStars(smallStarsEl, {
      score: opts.ratedScore,
      shouldShowNumber: false,
    });
  }
}

function processOtherPeoplesComments(opts: {
  votersToScore: { [userID: number]: Score };
  userReplyMap: { [userID: number]: ReplyLite[] };
  myUserID: number;
}) {
  for (const [voterUserID_, score] of Object.entries(opts.votersToScore)) {
    const voterUserID = Number(voterUserID_);
    if (voterUserID === opts.myUserID) continue;

    for (const reply of opts.userReplyMap[voterUserID] ?? []) {
      const el = $(reply.el);
      const smallStarsEl = $("<div />").insertBefore(
        $(el).find(".inner > .reply_content,.cmt_sub_content").eq(0),
      );
      renderSmallStars(smallStarsEl, {
        score: new Watched<number>(score),
        shouldShowNumber: false,
      });
    }
  }
}

interface Reply {
  el: HTMLElement;
  isSubReply: boolean;
  userID: number;
}
type ReplyLite = Omit<Reply, "userID">;

async function collectUserReplyMap(): Promise<
  { [userID: number]: ReplyLite[] }
> {
  const replies = await collectReplies();

  const output: { [userID: number]: ReplyLite[] } = {};
  for (const reply of replies) {
    (output[reply.userID] ??= []).push(reply);
  }

  return output;
}

/**
 * 由于可能比较费时（在基于 Firefox 129 的一款浏览器上，一次返回 340+ 条吐槽的执
 * 行耗时 70+ ms），选择 async 化。（不过在 Chrome 和 Safari 上，即使这个 async 化
 * 的版本也只要 20 ms 左右，Firefox 则要 100+ ms 了，只能说 SpiderMonkey 比较
 * 菜。）
 */
async function collectReplies(): Promise<Reply[]> {
  let output: Reply[] = [];

  let timeStart = performance.now();

  for (const el of document.querySelectorAll('[id^="post_"]')) {
    const isSubReply = isElementSubReply(el);

    const replyOnClickText = //
      $(el).find("a:has(> span.ico_reply)").eq(0).attr("onclick");
    if (!replyOnClickText) { // 删除了的吐槽，暂时没有确保能获取到用户数字 ID 的途径。
      continue;
    }

    // type, topic_id, post_id, sub_reply_id, sub_reply_uid, post_uid, sub_post_type
    const args = /\((.*)\)/.exec(replyOnClickText)![1]
      .split(",")
      .map((arg) => arg.trim());

    const userID = Number(isSubReply ? args.at(-3) : args.at(-2));

    output.push({ el: el as HTMLElement, isSubReply, userID });

    if (performance.now() - timeStart >= 10) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      timeStart = performance.now();
    }
  }

  return output;
}

function collectMyReplies(): ReplyLite[] {
  if (!Global.token.getValueOnce()) return [];

  const myTextUserID =
    (new URL($("#headerNeue2 .idBadgerNeue > .avatar").attr("href")!)).pathname
      .split("/").filter(Boolean).at(-1)!;

  return $(`[id^="post_"]:has(> a.avatar[href$="/${myTextUserID}"])`)
    .map((_, el): ReplyLite => ({ el, isSubReply: isElementSubReply(el) }))
    .toArray();
}

function isElementSubReply(el: Element): boolean {
  return !!$(el).closest(".topic_sub_reply").length;
}

function convertVotersByScoreToVotersToScore(
  votersByScore: { [score in Score]: number[] },
): { [userID: number]: Score } {
  const output: { [userID: number]: Score } = {};

  for (const [score, voters] of Object.entries(votersByScore)) {
    for (const voter of voters) {
      output[voter] = Number(score) as Score;
    }
  }

  return output;
}
