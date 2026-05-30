import { type Component, Match, Show, Switch } from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import {
  type EpisodeData,
  type EpisodeId,
  makeCustomElementTagName,
  type SubjectId,
} from "../definitions";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";
import * as epDataHelpers from "../utils/episode-data-helpers";
import { cls } from "../utils/cls";
import { Scoreboard } from "./Scoreboard";
import { ScoreChart } from "./ScoreChart";
import type { SettingsStore } from "../stores/persistent-stores/settings-store";
import { MyRating } from "./MyRating";
import type { AppClient } from "../clients/app-client";
import type { AuthStore } from "../stores/persistent-stores/auth-store";
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";
import { ErrorMessageWithRetry } from "./errors";

const TAG_NAME = makeCustomElementTagName("episode-overview");

export function createEpisodeOverviewInstance(opts: {
  settingsStore: SettingsStore;
  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
}) {
  registerEpisodeOverview({
    settingsStore: opts.settingsStore,
    appClient: opts.appClient,
    authStore: opts.authStore,
    scoreStore: opts.scoreStore,
    revealedEpisodesStore: opts.revealedEpisodesStore,
  });
  const el = document.createElement(TAG_NAME);
  el.setAttribute("subject-id", String(opts.subjectId));
  el.setAttribute("episode-id", String(opts.episodeId));

  return { element: el };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerEpisodeOverview(opts: {
  settingsStore: SettingsStore;
  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;
}) {
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
        <EpisodeOverviewWrapped
          settingsStore={opts.settingsStore}
          appClient={opts.appClient}
          authStore={opts.authStore}
          scoreStore={opts.scoreStore}
          revealedEpisodesStore={opts.revealedEpisodesStore}
          subjectId={props.subjectId!}
          episodeId={props.episodeId!}
        />
      </Show>
    );
  });
}

const EpisodeOverviewWrapped: Component<{
  settingsStore: SettingsStore;
  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
}> = (props) => {
  function queryEpisodeDataTracked(opts: { shouldRefetch: boolean }) {
    return props.scoreStore.queryEpisodeDataTracked(
      props.subjectId,
      props.episodeId,
      {
        prefersFetchingCompleteSubjectVotes: false,
        shouldRefetch: opts.shouldRefetch,
      },
    );
  }
  function refetchEpisodeData() {
    queryEpisodeDataTracked({ shouldRefetch: true });
  }

  const dataResp = queryEpisodeDataTracked({ shouldRefetch: false });

  const isLoading = epDataHelpers.createIsLoading(dataResp);
  const error = epDataHelpers.createError(dataResp);
  const data = epDataHelpers.createData(dataResp);

  return (
    <div style="float: right;">
      <Switch>
        <Match when={isLoading()}>
          <div style="color: grey">单集评分加载中…</div>
        </Match>
        <Match when={error()}>
          {(error) => (
            <ErrorMessageWithRetry
              message={error().message}
              onRetry={refetchEpisodeData}
            />
          )}
        </Match>
        <Match when={data()}>
          {(data) => (
            <EpisodeOverview
              settingsStore={props.settingsStore}
              appClient={props.appClient}
              authStore={props.authStore}
              scoreStore={props.scoreStore}
              revealedEpisodesStore={props.revealedEpisodesStore}
              subjectId={props.subjectId}
              episodeId={props.episodeId}
              data={data()}
            />
          )}
        </Match>
      </Switch>
    </div>
  );
};

const EpisodeOverview: Component<{
  settingsStore: SettingsStore;
  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;

  data: EpisodeData;
}> = (props) => {
  const styleSetting = props.settingsStore.getEpisodePageOverviewStyleSignal();

  return (
    <Switch>
      <Match when={styleSetting() === "boxed"}>
        <div id="panelInterestWrapper" style={{ width: "fit-content" }}>
          <div class="SidePanel png_bg">
            <h2>单集评分</h2>
            <EpisodeOverviewInner
              appClient={props.appClient}
              authStore={props.authStore}
              scoreStore={props.scoreStore}
              revealedEpisodesStore={props.revealedEpisodesStore}
              subjectId={props.subjectId}
              episodeId={props.episodeId}
              data={props.data}
            />
          </div>
        </div>
      </Match>
      <Match when={styleSetting() === "compact"}>
        <EpisodeOverviewInner
          appClient={props.appClient}
          authStore={props.authStore}
          scoreStore={props.scoreStore}
          revealedEpisodesStore={props.revealedEpisodesStore}
          subjectId={props.subjectId}
          episodeId={props.episodeId}
          data={props.data}
        />
      </Match>
    </Switch>
  );
};

const EpisodeOverviewInner: Component<{
  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;

  data: EpisodeData;
}> = (props) => {
  const epComputed = epDataHelpers.createComputedFromData(() => props.data);

  return (
    <>
      <MyRating
        displayMode="normal"
        noFloat={true}
        shouldEnableVisibilityControl={true}
        prefersFetchingCompleteSubjectVotes={false}
        appClient={props.appClient}
        authStore={props.authStore}
        scoreStore={props.scoreStore}
        revealedEpisodesStore={props.revealedEpisodesStore}
        subjectId={props.subjectId}
        episodeId={props.episodeId}
        isPrimary={true}
      />
      {/* <br class="board" /> */}
      <hr class="board" />
      <div {...{ rel: "v:rating" }}>
        <div
          class={cls(
            "global_rating",
            `score${Math.round(epComputed.averageScore())}`,
          )}
        >
          <div class="rateEmo" />
          <Scoreboard episodeComputed={epComputed} />
        </div>
        <div class="clear" />
        <ScoreChart episodeComputed={epComputed} />
      </div>
    </>
  );
};
