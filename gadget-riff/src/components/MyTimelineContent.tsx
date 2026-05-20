import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  Show,
  Switch,
} from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import {
  EPRT_ID_HTML_SAFE,
  makeCustomElementTagName,
  type Score,
} from "../definitions";
import type { AuthStore } from "../stores/persistent-stores/auth-store";
import { PleaseDoAuth, PleaseDoRefetch } from "./PleaseDoAuth";
import type { GetUserTimeLineItemsResponseData } from "../shared/dto";
import { ErrorMessageWithRetry } from "./errors";
import type { AppClient } from "../clients/app-client";
import { readonlyPageData } from "../stores/readonly-page-data";
import { SmallStars } from "./SmallStars";
import { L } from "./utils";

const TAG_NAME = makeCustomElementTagName("my-timeline-content");

export function createMyTimelineContentInstance(
  opts: { appClient: AppClient; authStore: AuthStore },
) {
  registerMyTimelineContent(opts);
  const el = document.createElement(TAG_NAME);
  return { element: el };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerMyTimelineContent(
  opts: { appClient: AppClient; authStore: AuthStore },
) {
  elementConstructor ??= customElement(TAG_NAME, {}, () => {
    noShadowDOM();

    return (
      <MyTimelineContent
        appClient={opts.appClient}
        authStore={opts.authStore}
      />
    );
  });
}

const MyTimelineContent: Component<{
  appClient: AppClient;
  authStore: AuthStore;
}> = (props) => {
  type State =
    | ["idle"]
    | ["loading"]
    | ["error", string]
    | ["loaded", GetUserTimeLineItemsResponseData, { isFilled: boolean }];
  type StateUnion = {
    idle?: true;
    loading?: true;
    error?: string;
    loaded?: GetUserTimeLineItemsResponseData;
  };
  const [state, setState] = createSignal<State>(["idle"]);
  const statusUnion = createMemo((): StateUnion => {
    const s = state();
    switch (s[0]) {
      case "idle":
        return { idle: true };
      case "loading":
        return { loading: true };
      case "error":
        return { error: s[1] };
      case "loaded":
        return { loaded: s[1] };
    }
  });

  const [currentPageNumber, setCurrentPageNumber] = createSignal(1);

  createEffect(on(currentPageNumber, (currentPageNumber) => {
    if (props.authStore.statusUnion().withSessionToken) {
      loadPage(currentPageNumber);
    }
  }));

  async function loadPage(pageNumber: number) {
    setState(["loading"]);

    const resp = await props.appClient.getMyTimelineItems({ pageNumber });

    switch (resp[0]) {
      case "ok": {
        setState(["loaded", resp[1], {
          isFilled:
            resp[1].items.length === props.appClient.TIMELINE_ITEMS_PER_PAGE,
        }]);
        break;
      }
      case "error": {
        setState(["error", resp[2]]);
        break;
      }
      case "auth_required": {
        props.authStore.clear();
        setState(["idle"]);
        break;
      }
    }
  }

  const hasPreviousPage = () => currentPageNumber() > 1;
  const hasNextPage = createMemo(() => {
    if (currentPageNumber() >= 10) return false;
    const s = state();
    if (s[0] !== "loaded") return false;
    return s[2].isFilled;
  });

  function removeTimelineItem(timestampMs: number) {
    const s = state();
    if (s[0] !== "loaded") return;
    setState([
      "loaded",
      {
        ...s[1],
        items: s[1].items.filter((item) => item[0] !== timestampMs),
      },
      s[2],
    ]);
  }

  return (
    <div>
      <button
        onClick={() =>
          chiiLib.ukagaka.showCustomizePanelWithTab(EPRT_ID_HTML_SAFE)}
      >
        打开设置
      </button>
      <Show
        when={props.authStore.statusUnion().withSessionToken}
        fallback={<PleaseDoAuth authStore={props.authStore} />}
      >
        <Switch>
          <Match when={statusUnion().idle}>
            <PleaseDoRefetch onRequestRefetch={() => loadPage(1)} />
          </Match>
          <Match when={statusUnion().loading}>
            <Loading />
          </Match>
          <Match when={statusUnion().error}>
            {(message) => (
              <ErrorMessageWithRetry
                message={message()}
                onRetry={() => loadPage(currentPageNumber())}
              />
            )}
          </Match>
          <Match when={statusUnion().loaded}>
            {(data) => (
              <div id="timeline" style="position: relative;">
                <TimelineItems
                  appClient={props.appClient}
                  data={data()}
                  removeTimelineItem={removeTimelineItem}
                />
                <Pager
                  currentPageNumber={currentPageNumber()}
                  setCurrentPageNumber={setCurrentPageNumber}
                  hasPreviousPage={hasPreviousPage()}
                  hasNextPage={hasNextPage()}
                />
              </div>
            )}
          </Match>
        </Switch>
      </Show>
    </div>
  );
};

const TimelineItems: Component<{
  appClient: AppClient;
  data: GetUserTimeLineItemsResponseData;
  removeTimelineItem: (timestampMs: number) => void;
}> = (props) => {
  type ItemUser = {
    textId: string;
    name: string;
    smallAvatarUrl: string;
    shouldShowAvatar: boolean;
  };
  type ItemUnion = {
    timestampMs: number;
    rate_episode?: {
      episodeId: number;
      score: Score | null;
    };
  };

  const itemsByDateHeader = createMemo(() => {
    const groups: {
      header: string;
      items: (ItemUnion & { user: ItemUser })[];
    }[] = [];

    const userSelf_ = readonlyPageData.getClaimedUserTextIdAndName();
    if (!userSelf_) throw new Error("unreachable!");
    const userSelf = {
      ...userSelf_,
      smallAvatarUrl: `https://api.bgm.tv/v0/users/${
        encodeURIComponent(userSelf_.textId)
      }/avatar?type=small`,
    };

    for (const item of props.data.items) {
      const date = new Date(item[0]);
      const dateStr = date.toLocaleDateString();
      if (groups.at(-1)?.header !== dateStr) {
        groups.push({ header: dateStr, items: [] });
      }
      const isFirst = !groups.at(-1)!.items.length;

      const itemUnion = ((): ItemUnion | null => {
        switch (item[1]) {
          case "rate-episode": {
            return {
              timestampMs: item[0],
              rate_episode: {
                episodeId: item[2].episode_id,
                score: item[2].score as Score | null,
              },
            };
          }
          default:
            return null;
        }
      })();
      if (!itemUnion) continue;

      groups.at(-1)!.items.push({
        ...itemUnion,
        user: { ...userSelf, shouldShowAvatar: isFirst },
      });
    }

    return groups;
  });

  const [hoveringItem, setHoveringItem] = createSignal<number | null>(null);

  async function deleteTimelineItem(timestampMs: number) {
    const result = await props.appClient.deleteMyTimelineItem({ timestampMs });
    switch (result[0]) {
      case "ok":
        props.removeTimelineItem(timestampMs);
        break;
      case "error":
        // TODO: 也许应该以更好的方式呈现错误？
        alert("删除单集评分时间线项目失败：" + result[2]);
        break;
      case "auth_required":
        // TODO: 同上。
        alert("认证失败。");
        props.appClient.authStore.clear();
        break;
      default:
        result satisfies never;
    }
  }

  return (
    <div id="timeline" style="position: relative;">
      <For each={itemsByDateHeader()}>
        {(group) => (
          <>
            <h4 class="Header">{group.header}</h4>
            <ul>
              <For each={group.items}>
                {(item) => (
                  <li
                    class="clearit tml_item"
                    onMouseEnter={() => setHoveringItem(item.timestampMs)}
                    onMouseLeave={() => setHoveringItem(null)}
                  >
                    <Show when={item.user.shouldShowAvatar}>
                      <Avatar user={item.user} />
                    </Show>
                    <Switch>
                      <Match when={item.rate_episode}>
                        {(data) => (
                          <span class="info clearit">
                            <L href={`/user/${item.user.textId}`}>
                              {item.user.name}
                            </L>
                            为剧集
                            <L href={`/ep/${data().episodeId}`}>
                              {data().episodeId}
                            </L>
                            <Show
                              when={data().score !== null}
                              fallback={"取消评分"}
                            >
                              评分{" "}
                              <SmallStars
                                score={data().score!}
                                shouldShowNumber={false}
                              />
                            </Show>
                          </span>
                        )}
                      </Match>
                    </Switch>
                    <a
                      title="删除这条时间线"
                      class="tml_del"
                      style={{
                        display: hoveringItem() === item.timestampMs
                          ? "block"
                          : "none",
                        cursor: "pointer",
                      }}
                      onClick={() => deleteTimelineItem(item.timestampMs)}
                    >
                      del
                    </a>
                  </li>
                )}
              </For>
            </ul>
          </>
        )}
      </For>
    </div>
  );
};

const Avatar: Component<
  { user: { textId: string; name: string; smallAvatarUrl: string } }
> = (props) => {
  return (
    <span class="avatar">
      <a href={`/user/${props.user.textId}`} class="avatar">
        <span
          class="avatarNeue avatarReSize40 ll"
          style={{ "background-image": `url(${props.user.smallAvatarUrl})` }}
        />
      </a>
    </span>
  );
};

const Loading: Component<{}> = () => {
  return (
    <div class="loading">
      <img src="/img/loadingAnimation.gif" />
    </div>
  );
};

const Pager: Component<{
  currentPageNumber: number;
  setCurrentPageNumber: (pageNumber: number) => void;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}> = (props) => {
  return (
    <div id="tmlPager">
      <div class="page_inner">
        <Show when={props.hasPreviousPage}>
          <a
            class="p"
            style={{
              cursor: "pointer", // 不知为何，不指定光标就是 `I`。
            }}
            onClick={() =>
              props.setCurrentPageNumber(props.currentPageNumber - 1)}
          >
            ‹‹上一页
          </a>
        </Show>
        <Show
          when={props.hasNextPage}
          fallback={<span>没有下一页了…</span>}
        >
          <a
            class="p"
            style={{
              cursor: "pointer", // 不知为何，不指定光标就是 `I`。
            }}
            onClick={() =>
              props.setCurrentPageNumber(props.currentPageNumber + 1)}
          >
            下一页››
          </a>
        </Show>
      </div>
    </div>
  );
};
