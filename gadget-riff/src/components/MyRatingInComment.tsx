import { type Component, createMemo, Show } from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import {
  type EpisodeData,
  type EpisodeId,
  makeCustomElementTagName,
  type Score,
  type SubjectId,
} from "../definitions";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";
import * as epDataHelpers from "../utils/episode-data-helpers";
import { readonlyPageData } from "../stores/readonly-page-data";
import { SmallStars } from "./SmallStars";

const TAG_NAME = makeCustomElementTagName("my-rating-in-comment");

export function createMyRatingInCommentInstance(opts: {
  scoreStore: ScoreStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
}) {
  registerMyRatingInComment({ scoreStore: opts.scoreStore });
  const el = document.createElement(TAG_NAME);
  el.setAttribute("subject-id", String(opts.subjectId));
  el.setAttribute("episode-id", String(opts.episodeId));

  return { element: el };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerMyRatingInComment(opts: { scoreStore: ScoreStore }) {
  elementConstructor ??= customElement(TAG_NAME, {
    subjectId: null,
    episodeId: null,
  }, (props) => {
    noShadowDOM();

    return (
      <Show
        when={Number.isInteger(props.subjectId) &&
          Number.isInteger(props.episodeId)}
      >
        <MyRatingInCommentWrapped
          scoreStore={opts.scoreStore}
          subjectId={props.subjectId!}
          episodeId={props.episodeId!}
        />
      </Show>
    );
  });
}

const MyRatingInCommentWrapped: Component<{
  scoreStore: ScoreStore;
  subjectId: SubjectId;
  episodeId: EpisodeId;
}> = (props) => {
  const dataResp = props.scoreStore.queryEpisodeDataTracked(
    props.subjectId,
    props.episodeId,
    { prefersFetchingCompleteSubjectVotes: false },
  );

  const data = epDataHelpers.createData(dataResp);

  return (
    <Show when={data()}>
      {(episodeData) => <MyRatingInComment data={episodeData()} />}
    </Show>
  );
};

const MyRatingInComment: Component<{
  data: EpisodeData;
}> = (props) => {
  const scoreAndHint = createMemo(
    (): { score: Score | null; hint: string | null } | null => {
      if (props.data.myRating) {
        if (props.data.myRating.score === null) {
          return { score: null, hint: null };
        }
        return {
          score: props.data.myRating.score,
          hint: ((v) => {
            if (v === "unknown") return "评分可见性未知";
            return v.isVisible ? "评分公开" : "评分非公开";
          })(props.data.myRating.visibility),
        };
      }
      if (!readonlyPageData.claimedUserId) return null;
      if (!props.data.publicVotersByScore) return null;
      for (
        const [scoreStr, voters] of Object.entries(
          props.data.publicVotersByScore,
        )
      ) {
        if (
          voters.some((voter) => voter === readonlyPageData.claimedUserId)
        ) {
          return { score: Number(scoreStr) as Score, hint: "评分公开" };
        }
      }
      return null;
    },
  );

  return (
    <Show when={scoreAndHint()}>
      {(scoreAndHint) => (
        <>
          <SmallStars
            score={scoreAndHint().score}
            shouldShowNumber={false}
          />
          <Show when={scoreAndHint().hint}>
            <span class="tip_j">({scoreAndHint().hint})</span>
          </Show>
        </>
      )}
    </Show>
  );
};
