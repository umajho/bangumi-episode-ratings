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
  describeScoreEx,
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

const TAG_NAME = makeCustomElementTagName("my-rating");

export function createMyRatingInstance(opts: {
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

const MyRating: Component<{
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
  const [alarmText, setAlarmText] = createSignal<string | null>(null);

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
      style={{ float: "right", display: "flex", "flex-direction": "column" }}
    >
      <Switch>
        <Match when={status().normal}>
          {(data) => (
            <>
              <Header alarmText={alarmText()} />
              <Stars
                ratedScore={data().ratedScore}
                onRateEpisode={(score) =>
                  props.scoreStore.updateMyRating(
                    props.subjectId,
                    props.episodeId,
                    { score },
                  )}
                setAlarmScore={(s) => {
                  setAlarmText(s && describeScoreEx(s!));
                }}
              />
            </>
          )}
        </Match>
        <Match when={status().processing}>
          {(data) => (
            <>
              <Header />
              <div
                style={{ filter: "grayscale(100%)", "pointer-events": "none" }}
              >
                <Stars ratedScore={data().ratedScore} />
              </div>
              <div style={{ color: "gray" }}>处理中…</div>
            </>
          )}
        </Match>
        <Match when={status().loading}>
          <Header />
          <div style={{ color: "gray" }}>加载中…</div>
        </Match>
        <Match when={status().error}>
          <Header />
          <div style={{ color: "red" }}>{status().error}</div>
        </Match>
        <Match when={status().requiring_auth}>
          <Show when={props.isPrimary}>
            <Header />
            <PleaseDoAuth authStore={props.authStore} shorter />
          </Show>
        </Match>
        <Match when={status().requiring_fetch}>
          <Show when={props.isPrimary}>
            <Header />
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

const Header: Component<{ alarmText?: string | null }> = (props) => {
  return (
    <p style="font-size: 12px;">
      我的评价:{" "}
      <Show when={props.alarmText}>
        <span class="alarm">{props.alarmText}</span>
      </Show>
    </p>
  );
};

const Stars: Component<{
  ratedScore: Score | null;
  onRateEpisode?: (score: Score | null) => void;
  setAlarmScore?: (score: Score | null) => void;
}> = (props) => {
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

  return (
    <div>
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
            onMouseOver={() => setHoveredScore(score())}
            onMouseOut={() => setHoveredScore(null)}
            onClick={() => props.onRateEpisode?.(score())}
          >
            <a title={describeScoreEx(score())}>{score()}</a>
          </div>
        )}
      </Index>
    </div>
  );
};
