import { customElement, noShadowDOM } from "solid-element";
import {
  type Component,
  createEffect,
  createMemo,
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
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";

const TAG_NAME = makeCustomElementTagName("rate-info");

export function createRateInfoInstance(opts: {
  appClient: AppClient;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
  isPrimary?: boolean;
  revealAllButton?: boolean;
}) {
  registerRateInfo({
    appClient: opts.appClient,
    scoreStore: opts.scoreStore,
    revealedEpisodesStore: opts.revealedEpisodesStore,
  });
  const el = document.createElement(TAG_NAME);
  el.setAttribute("subject-id", String(opts.subjectId));
  el.setAttribute("episode-id", String(opts.episodeId));
  if (opts.isPrimary) {
    el.setAttribute("is-primary", "1");
  }
  if (opts.revealAllButton) {
    el.setAttribute("reveal-all-button", "1");
  }

  return { element: el };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerRateInfo(opts: {
  appClient: AppClient;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;
}) {
  elementConstructor ??= customElement(TAG_NAME, {
    episodeId: null,
    subjectId: null,
    isPrimary: null,
    revealAllButton: null,
  }, (props) => {
    noShadowDOM();

    return (
      <Show
        when={Number.isInteger(props.subjectId) &&
          Number.isInteger(props.episodeId)}
      >
        <RateInfo
          appClient={opts.appClient}
          scoreStore={opts.scoreStore}
          revealedEpisodesStore={opts.revealedEpisodesStore}
          subjectId={props.subjectId!}
          episodeId={props.episodeId!}
          isPrimary={!!props.isPrimary}
          revealAllButton={!!props.revealAllButton}
        />
      </Show>
    );
  });
}

const RateInfo: Component<{
  appClient: AppClient;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
  isPrimary: boolean;
  revealAllButton: boolean;
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
  const isRevealedSignal = props.revealedEpisodesStore
    .getIsRevealedSignal(props.episodeId);

  return ( // `div` 用于确保换行。
    <div>
      <Switch>
        <Match when={votesOk()}>
          {(votes) => (
            <RateInfoInner
              revealAllButton={props.revealAllButton}
              votes={votes()}
              isRevealed={isRevealedSignal()}
              reveal={() => props.revealedEpisodesStore.reveal(props.episodeId)}
              revealAll={() => props.revealedEpisodesStore.revealAll()}
            />
          )}
        </Match>
        <Match when={votesResp()[0] === "loading"}>
          <Show when={props.isPrimary}>
            <div style="color: grey">
              单集评分加载中…
            </div>
          </Show>
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
    </div>
  );
};

const RateInfoInner: Component<{
  revealAllButton: boolean;
  votes: EpisodeVotes;
  isRevealed: boolean;
  reveal: () => void;
  revealAll: () => void;
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

  createEffect(() => {
    if (totalVotes() === 0) {
      props.reveal();
    }
  });

  return (
    <Show
      when={props.isRevealed}
      fallback={
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" onClick={() => props.reveal()}>
            揭开评分
          </button>
          <Show when={props.revealAllButton}>
            <button type="button" onClick={() => props.revealAll()}>
              揭开全部评分
            </button>
          </Show>
        </div>
      }
    >
      <div class="rateInfo">
        <SmallStars score={averageScore()} shouldShowNumber={true} />{" "}
        <span class="tip_j">({totalVotes()}人评分)</span>
      </div>
    </Show>
  );
};
