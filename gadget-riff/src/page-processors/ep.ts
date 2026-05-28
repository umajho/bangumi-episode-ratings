import { type Accessor, createEffect, createRoot, on } from "solid-js";

import type { AppClient } from "../clients/app-client";
import { createEpisodeOverviewInstance } from "../components/EpisodeOverview";
import {
  type EpisodeId,
  type Score,
  scores,
  type SubjectId,
  type UserId,
} from "../definitions";
import type { AuthStore } from "../stores/persistent-stores/auth-store";
import type { SettingsStore } from "../stores/persistent-stores/settings-store";
import { readonlyPageData } from "../stores/readonly-page-data";
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";
import type {
  EpisodeDataResponse,
  ScoreStore,
} from "../stores/temporary-global-stores/score-store";
import { createClearDivElement } from "../utils/elements";
import { createSmallStarsInstance } from "../components/SmallStars";

export async function processEpPage(opts: {
  settingsStore: SettingsStore;
  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
}) {
  const columnEpAEl = document.querySelector("#columnEpA");
  const epDescEl = columnEpAEl?.querySelector(":scope > .epDesc");
  if (!columnEpAEl || !epDescEl) return;

  {
    const episodeOverviewInstance = createEpisodeOverviewInstance({
      settingsStore: opts.settingsStore,
      appClient: opts.appClient,
      authStore: opts.authStore,
      scoreStore: opts.scoreStore,
      revealedEpisodesStore: opts.revealedEpisodesStore,
      subjectId: opts.subjectId,
      episodeId: opts.episodeId,
    });
    columnEpAEl.prepend(episodeOverviewInstance.element);

    epDescEl.insertAdjacentElement("afterend", createClearDivElement());
  }

  {
    const userIdToTextIdMap = buildUserIdToTextIdMap();

    const dataResp = opts.scoreStore.queryEpisodeDataTracked(
      opts.subjectId,
      opts.episodeId,
      { prefersFetchingCompleteSubjectVotes: false },
    );

    processOtherPeoplesRatingsInCommentsOnce({
      dataResp,
      myUserId: readonlyPageData.claimedUserId,
      userIdToTextIdMap,
    });
  }
}

function processOtherPeoplesRatingsInCommentsOnce(opts: {
  dataResp: Accessor<EpisodeDataResponse>;
  myUserId: UserId | null;
  userIdToTextIdMap: Record<UserId, string>;
}) {
  createRoot((dispose) =>
    createEffect(on(opts.dataResp, (dataResp) => {
      if (dataResp[0] !== "ok") return;
      const publicVotersByScore = dataResp[1].publicVotersByScore;
      dispose();
      if (!publicVotersByScore) return;
      for (const score of scores) {
        const publicVoters = publicVotersByScore[score];
        if (!publicVoters) continue;
        for (const userId of publicVoters as UserId[]) {
          if (userId === opts.myUserId) continue;
          const userTextId = opts.userIdToTextIdMap[userId];
          if (!userTextId) continue;
          installSmallStars({ userTextId, score });
        }
      }
    }))
  );

  function installSmallStars(opts: {
    userTextId: string;
    score: Score;
  }) {
    for (
      const el of document.querySelectorAll<HTMLDivElement>(
        `[id^="post_"][data-item-user="${opts.userTextId}"]`,
      )
    ) {
      const contentEl = el
        .querySelector(".inner > .reply_content,.cmt_sub_content");
      if (!contentEl) continue;

      const instance = createSmallStarsInstance({ score: opts.score });
      contentEl.insertAdjacentElement("beforebegin", instance.element);
    }
  }
}

function buildUserIdToTextIdMap(): Record<UserId, string> {
  const userIdToTextIdMap: Record<UserId, string> = {};
  const seenUserTextIds = new Set<string>();
  const claimedTextId = readonlyPageData.getClaimedUserTextIdAndName()
    ?.textId;
  if (claimedTextId && readonlyPageData.claimedUserId) {
    userIdToTextIdMap[readonlyPageData.claimedUserId] = claimedTextId;
  }

  for (
    const el of document.querySelectorAll<HTMLDivElement>('[id^="post_"]')
  ) {
    const textId = el.dataset.itemUser;
    if (!textId || (seenUserTextIds.has(textId))) continue;
    seenUserTextIds.add(textId);

    const isSubReply = isElementSubReply(el);

    const replyOnClickText = //
      el.querySelector("a:has(> span.ico_reply)")?.getAttribute("onclick");
    if (!replyOnClickText) { // 删除了的吐槽，暂时没有确保能获取到用户数字 ID 的途径。
      continue;
    }

    // type, topic_id, post_id, sub_reply_id, sub_reply_uid, post_uid, sub_post_type
    const args = /\((.*)\)/.exec(replyOnClickText)?.[1]
      ?.split(",")
      ?.map((arg) => arg.trim());
    if (!args) continue;

    const userID = Number(isSubReply ? args.at(-3) : args.at(-2));
    if (Number.isNaN(userID)) continue;

    userIdToTextIdMap[userID as UserId] = textId;
  }

  return userIdToTextIdMap;
}

function isElementSubReply(el: Element): boolean {
  return !!el.closest(".topic_sub_reply");
}
