import { customElement, noShadowDOM } from "solid-element";
import {
  type Component,
  createMemo,
  createSignal,
  Match,
  Show,
  Switch,
} from "solid-js";

import {
  type EpisodeId,
  type EpisodeVotes,
  makeCustomElementTagName,
  type SubjectId,
} from "../definitions";
import type { AppClient } from "../clients/app-client";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";
import { SmallStars } from "./SmallStars";
import { ErrorWithRetry } from "./ErrorWithRetry";

const TAG_NAME = makeCustomElementTagName("rate-info");

export function createRateInfoInstance(opts: {
  appClient: AppClient;
  scoreStore: ScoreStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
  hasUserWatched: boolean;
}) {
  registerRateInfo({ appClient: opts.appClient, scroreStore: opts.scoreStore });
  const el = document.createElement(TAG_NAME);
  el.setAttribute("subject-id", String(opts.subjectId));
  el.setAttribute("episode-id", String(opts.episodeId));
  el.setAttribute("has-user-watched", String(opts.hasUserWatched));

  return {
    element: el,
    setHasUserWatched(newValue: boolean) {
      el.setAttribute("has-user-watched", String(newValue));
    },
  };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerRateInfo(opts: {
  appClient: AppClient;
  scroreStore: ScoreStore;
}) {
  elementConstructor ??= customElement(TAG_NAME, {
    episodeId: null,
    subjectId: null,
    hasUserWatched: false,
  }, (props) => {
    noShadowDOM();

    return (
      <Show
        when={Number.isInteger(props.subjectId) &&
          Number.isInteger(props.episodeId)}
      >
        <RateInfo
          appClient={opts.appClient}
          scoreStore={opts.scroreStore}
          subjectId={props.subjectId!}
          episodeId={props.episodeId!}
          hasUserWatched={props.hasUserWatched}
        />
      </Show>
    );
  });
}

const RateInfo: Component<{
  appClient: AppClient;
  scoreStore: ScoreStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
  hasUserWatched: boolean;
}> = (props) => {
  const votesResp = props.scoreStore.queryEpisodeVotesTracked(
    props.subjectId,
    props.episodeId,
    { prefersFetchingCompleteSubjectVotes: true },
  );
  const votesOk = createMemo((): EpisodeVotes | null => {
    const resp = votesResp();
    return resp[0] === "ok" ? resp[1] : null;
  });
  const errorMessage = createMemo(() => {
    const resp = votesResp();
    return resp[0] === "error" ? resp[2] : null;
  });

  return (
    <Switch>
      <Match when={votesOk()}>
        {(votes) => (
          <RateInfoInner
            votes={votes()}
            hasUserWatched={props.hasUserWatched}
          />
        )}
      </Match>
      <Match when={votesResp()[0] === "loading"}>
        <div style="color: grey">
          单集评分加载中…
        </div>
      </Match>
      <Match when={errorMessage()}>
        {(message) => (
          <ErrorWithRetry
            message={message()}
            onRetry={() => {
              throw new Error("TODO");
            }}
          />
        )}
      </Match>
    </Switch>
  );
};

const RateInfoInner: Component<{
  votes: EpisodeVotes;
  hasUserWatched: boolean;
}> = (props) => {
  const totalVotes = createMemo(() => {
    return Object.values(props.votes).reduce(
      (sum, votesForScore) => sum + votesForScore,
      0,
    );
  });
  const scoreSum = createMemo(() => {
    return Object.entries(props.votes).reduce(
      (sum, [score, votesForScore]) => sum + Number(score) * votesForScore,
      0,
    );
  });
  const averageScore = () => scoreSum() / totalVotes();

  const [isRevealed, setIsRevealed] = createSignal(
    props.hasUserWatched || totalVotes() === 0,
  );

  return (
    <Show
      when={isRevealed()}
      fallback={
        <button type="button" onClick={() => setIsRevealed(true)}>
          显示评分
        </button>
      }
    >
      <div class="rateInfo">
        <SmallStars score={averageScore()} shouldShowNumber={true} />{" "}
        <span class="tip_j">({totalVotes()}人评分)</span>
      </div>
    </Show>
  );
};
