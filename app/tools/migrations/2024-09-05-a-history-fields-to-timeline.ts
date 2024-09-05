#!/usr/bin/env deno run --unstable-kv --allow-read --allow-write

import kvPrefixes from "@/repo/kv-prefixes.ts";
import {
  EpisodeID,
  UserID,
  UserSubjectEpisodeRatingData,
  UserTimelineItem,
} from "@/types.ts";

const KvPath = Deno.args[0];

const kv = await Deno.openKv(KvPath);
let tx = kv.atomic();

interface UserSubjectEpisodeRatingData_Before {
  score: number | null;
  isVisible?: boolean;
  submittedAtMs: number;
  history: {
    score: number | null;
    submittedAtMs: number;
  }[];
}

for await (
  const entry of kv.list({
    prefix: kvPrefixes.buildPrefixUserSubjectEpisodeRating([]),
  })
) {
  const value = entry.value as UserSubjectEpisodeRatingData_Before;

  const userID = entry.key.at(-3) as UserID;
  const episodeID = entry.key.at(-1) as EpisodeID;

  const newValue: UserSubjectEpisodeRatingData = {
    score: value.score,
    ...("isVisible" in value && { isVisible: value.isVisible }),
    submittedAtMs: value.submittedAtMs,
  };

  // tx = tx.check(entry);
  tx = tx.set(entry.key, newValue);

  for (const { score, submittedAtMs } of [value, ...value.history]) {
    const timelineItemKey = //
      kvPrefixes.buildKeyUserTimelineItem(userID, submittedAtMs);

    const timelineItem: UserTimelineItem = //
      ["rate-episode", { episodeID, score }];

    tx = tx.set(timelineItemKey, timelineItem);
  }
}

console.log(await tx.commit());
