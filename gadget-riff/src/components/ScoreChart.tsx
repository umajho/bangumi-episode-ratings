import {
  type Component,
  createMemo,
  createSignal,
  Index,
  type Setter,
  Show,
} from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import {
  type EpisodeData,
  type EpisodeId,
  makeCustomElementTagName,
  type Score,
  scoresReversed,
  type SubjectId,
} from "../definitions";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";
import * as epDataHelpers from "../utils/episode-data-helpers";
import { Tooltip } from "./Tooltip";

const TAG_NAME = makeCustomElementTagName("score-chart");

export function createScoreChartInstance(opts: {
  scoreStore: ScoreStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
}) {
  registerScoreChart({ scoreStore: opts.scoreStore });
  const el = document.createElement(TAG_NAME);
  el.setAttribute("subject-id", String(opts.subjectId));
  el.setAttribute("episode-id", String(opts.episodeId));

  return { element: el };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerScoreChart(opts: { scoreStore: ScoreStore }) {
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
        <ScoreChart
          scoreStore={opts.scoreStore}
          subjectId={props.subjectId!}
          episodeId={props.episodeId!}
        />
      </Show>
    );
  });
}

const ScoreChart: Component<{
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
    <div style="float: right; width: 218px;">
      <Show when={data()}>{(data) => <ScoreChartInner data={data()} />}</Show>
    </div>
  );
};

const ScoreChartInner: Component<{ data: EpisodeData }> = (props) => {
  // oxlint-disable-next-line no-unassigned-vars
  let ref!: HTMLDivElement;

  const epData = epDataHelpers.createComputedFromData(() => props.data);

  const [tooltipStuff, setTooltipStuff] = //
    createSignal<TooltipStuff | null>(null);

  return (
    <div ref={ref} id="ChartWarpper" class="chartWrapper">
      <div class="chart_desc">
        <small class="grey">
          <span property="v:votes">{epData.totalVotes()}</span> votes
        </small>
      </div>
      <ul class="horizontalChart">
        <Index each={scoresReversed}>
          {(score) => (
            <Bar
              score={score()}
              episodeData={epData}
              setTooltipStuff={setTooltipStuff}
            />
          )}
        </Index>
        <Show when={tooltipStuff()}>
          {(tooltipStuff) => (
            <Tooltip
              style={{ transform: "translateX(-50%)" }}
              left={tooltipStuff().left - ref.getBoundingClientRect().left}
              top={-34}
            >
              {tooltipStuff().text}
            </Tooltip>
          )}
        </Show>
      </ul>
    </div>
  );
};

interface TooltipStuff {
  left: number;
  text: string;
}

const Bar: Component<{
  score: Score;
  episodeData: ReturnType<typeof epDataHelpers.createComputedFromData>;
  setTooltipStuff: Setter<TooltipStuff | null>;
}> = (props) => {
  const votes = createMemo(() => props.episodeData.votes()[props.score] ?? 0);
  const tip = createMemo(() => {
    const totalVotes = props.episodeData.totalVotes();
    const percentage = ((votes() / totalVotes * 100) || 0).toFixed(2);
    return `${percentage}% (${votes()}人)`;
  });

  const height = createMemo(() => {
    const votesOfMostVotedScore = props.episodeData.votesOfMostVotedScore();
    return (votes() / votesOfMostVotedScore * 100 || 0) + "%";
  });

  return (
    <li
      onMouseEnter={(ev) => {
        const rect = ev.currentTarget.getBoundingClientRect();

        return props.setTooltipStuff({
          left: rect.left + rect.width / 2,
          text: tip(),
        });
      }}
      onMouseLeave={() => props.setTooltipStuff(null)}
    >
      <a class="textTip" data-original-title={tip()}>
        <span class="label">{props.score}</span>
        <span class="count" style={{ height: height() }}>{votes()}</span>
      </a>
    </li>
  );
};
