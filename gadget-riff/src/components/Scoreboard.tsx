import { type Component, Show } from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import {
  describeScore,
  type EpisodeData,
  type EpisodeId,
  makeCustomElementTagName,
  type SubjectId,
} from "../definitions";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";
import * as epDataHelpers from "../utils/episode-data-helpers";

const TAG_NAME = makeCustomElementTagName("scoreboard");

export function createScoreboardInstance(opts: {
  scoreStore: ScoreStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
}) {
  registerScoreboard({ scoreStore: opts.scoreStore });
  const el = document.createElement(TAG_NAME);
  el.setAttribute("subject-id", String(opts.subjectId));
  el.setAttribute("episode-id", String(opts.episodeId));

  return { element: el };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerScoreboard(opts: { scoreStore: ScoreStore }) {
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
        <Scoreboard
          scoreStore={opts.scoreStore}
          subjectId={props.subjectId!}
          episodeId={props.episodeId!}
        />
      </Show>
    );
  });
}

const Scoreboard: Component<{
  scoreStore: ScoreStore;
  subjectId: SubjectId;
  episodeId: EpisodeId;
}> = (props) => {
  const dataResp = props.scoreStore.queryEpisodeDataTracked(
    props.subjectId,
    props.episodeId,
    { prefersFetchingCompleteSubjectVotes: false },
  );

  const isLoading = epDataHelpers.createIsLoading(dataResp);
  const data = epDataHelpers.createData(dataResp);

  return (
    <div style="float: right;">
      <Show
        when={!isLoading()}
        fallback={<div style="color: grey">单集评分加载中…</div>}
      >
        <Show when={data()}>
          {(data) => <ScoreboardInner data={data()} />}
        </Show>
      </Show>
    </div>
  );
};

const ScoreboardInner: Component<{ data: EpisodeData }> = (props) => {
  const { averageScore } = epDataHelpers
    .createComputedFromData(() => props.data);

  return (
    <div class="global_score">
      <span class="description">
        {Number.isNaN(averageScore()) ? "--" : describeScore(averageScore())}
      </span>
      <span class="number">
        {Number.isNaN(averageScore())
          ? 0..toFixed(1)
          : averageScore().toFixed(4)}
      </span>
      <div>
        <small class="grey" style="float: right;">单集评分</small>
      </div>
    </div>
  );
};
