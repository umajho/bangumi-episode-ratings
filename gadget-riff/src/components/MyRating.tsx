import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Index,
  Match,
  on,
  Show,
  Switch,
} from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import type { AppClient } from "../clients/app-client";
import {
  describeScore,
  type EpisodeId,
  makeCustomElementTagName,
  type Score,
  scores,
  type SubjectId,
} from "../definitions";
import type { RevealedEpisodesStore } from "../stores/temporary-global-stores/revealed-episodes-store";
import type { ScoreStore } from "../stores/temporary-global-stores/score-store";
import type { AuthStore } from "../stores/persistent-stores/auth-store";
import { PleaseDoAuth, PleaseDoRefetch } from "./PleaseDoAuth";
import { cls } from "../utils/cls";
import { ErrorMessageWithRetry } from "./errors";
import { Tooltip } from "./Tooltip";

const TAG_NAME = makeCustomElementTagName("my-rating");

type DisplayMode = "normal" | "inline_compact";

export function createMyRatingInstance(opts: {
  displayMode?: DisplayMode;
  noFloat?: boolean;

  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
  isPrimary?: boolean;
}) {
  registerMyRating({
    appClient: opts.appClient,
    authStore: opts.authStore,
    scoreStore: opts.scoreStore,
    revealedEpisodesStore: opts.revealedEpisodesStore,
  });
  const el = document.createElement(TAG_NAME);
  if (opts.displayMode) {
    el.setAttribute("display-mode", opts.displayMode);
  }
  if (opts.noFloat) {
    el.setAttribute("no-float", "1");
  }
  el.setAttribute("subject-id", String(opts.subjectId));
  el.setAttribute("episode-id", String(opts.episodeId));
  if (opts.isPrimary) {
    el.setAttribute("is-primary", "1");
  }

  return { element: el };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerMyRating(opts: {
  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;
}) {
  elementConstructor ??= customElement(TAG_NAME, {
    displayMode: null,
    noFloat: null,
    episodeId: null,
    subjectId: null,
    isPrimary: null,
  }, (props) => {
    noShadowDOM();

    return (
      <Show
        when={Number.isInteger(props.subjectId) &&
          Number.isInteger(props.episodeId)}
      >
        <MyRating
          displayMode={props.displayMode ?? "normal"}
          noFloat={!!props.noFloat}
          appClient={opts.appClient}
          authStore={opts.authStore}
          scoreStore={opts.scoreStore}
          revealedEpisodesStore={opts.revealedEpisodesStore}
          subjectId={props.subjectId!}
          episodeId={props.episodeId!}
          isPrimary={!!props.isPrimary}
        />
      </Show>
    );
  });
}

type Status = {
  normal?: { ratedScore: Score | null };
  processing?: { ratedScore: Score | null };
  loading?: true;
  error?: string;
  requiring_auth?: true;
  requiring_fetch?: true;
};

export const MyRating: Component<{
  displayMode: DisplayMode;
  noFloat: boolean;

  appClient: AppClient;
  authStore: AuthStore;
  scoreStore: ScoreStore;
  revealedEpisodesStore: RevealedEpisodesStore;

  subjectId: SubjectId;
  episodeId: EpisodeId;
  isPrimary: boolean;
}> = (props) => {
  const [status, setStatus] = createSignal(((): Status => {
    if (props.authStore.statusUnion().withSessionToken) {
      return { loading: true };
    } else {
      return { requiring_auth: true };
    }
  })());
  const [alarmScore, setAlarmScore] = createSignal<Score | null>(null);

  const epDataResp = props.scoreStore.queryEpisodeDataTracked(
    props.subjectId,
    props.episodeId,
    { prefersFetchingCompleteSubjectVotes: true },
  );
  createEffect(() => {
    const resp = epDataResp();
    switch (resp[0]) {
      case "ok": {
        const epData = resp[1];
        if (epData.myRating) {
          setStatus({ normal: { ratedScore: epData.myRating.score ?? null } });
        } else {
          setStatus(
            props.authStore.statusUnion().withSessionToken
              ? { requiring_fetch: true }
              : { requiring_auth: true },
          );
        }
        break;
      }
      case "error": {
        setStatus({ error: resp[2] });
        break;
      }
      case "loading": {
        setStatus({ loading: true });
        break;
      }
      case "processing": {
        setStatus({
          processing: { ratedScore: resp[1].oldData?.myRating?.score ?? null },
        });
        break;
      }
      default:
        resp satisfies never;
    }
  });
  createEffect(on([props.authStore.statusUnion], ([statusUnion]) => {
    if (statusUnion.withSessionToken) {
      setStatus({ requiring_fetch: true });
    } else {
      setStatus({ requiring_auth: true });
    }
  }, { defer: true }));

  return (
    <div
      style={{
        ...(props.displayMode === "normal"
          ? { ...(props.noFloat ? {} : { float: "right" }), display: "flex" }
          : { display: "inline-flex" }),
        "flex-direction": "column",
      }}
    >
      <Switch>
        <Match when={status().normal}>
          {(data) => (
            <>
              <Header
                displayMode={props.displayMode}
                alarmScore={alarmScore()}
              />
              <Stars
                ratedScore={data().ratedScore}
                onRateEpisode={(score) =>
                  props.scoreStore.updateMyRating(
                    props.subjectId,
                    props.episodeId,
                    { score },
                  )}
                setAlarmScore={setAlarmScore}
              />
            </>
          )}
        </Match>
        <Match when={status().processing}>
          {(data) => (
            <>
              <Header displayMode={props.displayMode} />
              <Stars ratedScore={data().ratedScore} />
              <div style={{ color: "gray" }}>处理中…</div>
            </>
          )}
        </Match>
        <Match when={status().loading}>
          <Header displayMode={props.displayMode} />
          <div style={{ color: "gray" }}>加载中…</div>
        </Match>
        <Match when={status().error}>
          <Header displayMode={props.displayMode} />
          <ErrorMessageWithRetry
            message={status().error!}
            onRetry={() => {
              throw new Error("TODO");
            }}
          />
        </Match>
        <Match when={status().requiring_auth}>
          <Show when={props.isPrimary}>
            <Header displayMode={props.displayMode} />
            <PleaseDoAuth authStore={props.authStore} shorter />
          </Show>
        </Match>
        <Match when={status().requiring_fetch}>
          <Show when={props.isPrimary}>
            <Header displayMode={props.displayMode} />
            <PleaseDoRefetch
              onRequestRefetch={() =>
                props.scoreStore.queryCompleteSubjectDataTracked(
                  props.subjectId,
                  { shouldRefetch: true },
                )}
            />
          </Show>
        </Match>
      </Switch>
    </div>
  );
};

const Header: Component<{
  displayMode: DisplayMode;
  alarmScore?: Score | null;
}> = (props) => {
  const alarmText = createMemo(() =>
    props.alarmScore && describeScore(props.alarmScore)
  );

  return (
    <Show when={props.displayMode === "normal"}>
      <p style="font-size: 12px;">
        我的评价:{" "}
        <Show when={alarmText()}>
          {(alarmText) => <span class="alarm">{alarmText()}</span>}
        </Show>
      </p>
    </Show>
  );
};

const Stars: Component<{
  ratedScore: Score | null;
  onRateEpisode?: (score: Score | null) => void;
  setAlarmScore?: (score: Score | null) => void;
}> = (props) => {
  // oxlint-disable-next-line no-unassigned-vars
  let ref!: HTMLDivElement;

  const [hoveredScore, setHoveredScore] = //
    createSignal<Score | null | "cancel">(null);
  createEffect(() => {
    const s = hoveredScore();
    if (s === "cancel") {
      // 与 bangumi 自身的行为保持一致，即：悬浮在取消图标上时，显示原先打的分的
      // 评价文本。
      props.setAlarmScore?.(props.ratedScore);
    } else {
      props.setAlarmScore?.(s ?? props.ratedScore);
    }
  });
  const scoreToHighlight = createMemo((): Score | null => {
    const score = hoveredScore();
    if (score === "cancel") return null;
    return score ?? props.ratedScore;
  });

  const [extremeStarLeft, setExtremeStarLeft] = //
    createSignal<number | null>(null);

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        ...props.onRateEpisode ? undefined : { cursor: "not-allowed" },
      }}
    >
      <div
        style={props.onRateEpisode
          ? undefined
          : { filter: "grayscale(100%)", "pointer-events": "none" }}
      >
        <div
          class="rating-cancel"
          onMouseOver={() => setHoveredScore("cancel")}
          onMouseOut={() => setHoveredScore(null)}
          onClick={() => props.onRateEpisode?.(null)}
        >
          <a title="Cancel Rating" />
        </div>
        <Index each={scores}>
          {(score) => (
            <div
              class={cls(
                "star-rating",
                (() => {
                  const s = scoreToHighlight();
                  if (s === null || score() > s) return;
                  return hoveredScore() === null
                    ? "star-rating-on"
                    : "star-rating-hover";
                })(),
              )}
              onMouseOver={(ev) => {
                setHoveredScore(score());
                if (score() === 1 || score() === 10) {
                  const rect = ev.currentTarget.getBoundingClientRect();
                  setExtremeStarLeft(rect.left + rect.width / 2);
                }
              }}
              onMouseOut={() => {
                setHoveredScore(null);
                setExtremeStarLeft(null);
              }}
              onClick={() => props.onRateEpisode?.(score())}
            >
              <a title={describeScoreEx(score())}>{score()}</a>
            </div>
          )}
        </Index>
      </div>
      <Show when={extremeStarLeft()}>
        {(left) => (
          <Tooltip
            pos="bottom"
            style={{ transform: "translateX(-50%)" }}
            left={left() - ref.getBoundingClientRect().left}
            top={17}
          >
            请谨慎评价
          </Tooltip>
        )}
      </Show>
    </div>
  );
};

function describeScoreEx(score: Score) {
  let description = `${describeScore(score)} ${score}`;
  if (score === 1 || score === 10) {
    description += " (请谨慎评价) ";
  }

  return description;
}
