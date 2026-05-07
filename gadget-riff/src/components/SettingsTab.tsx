import { type Component, Index, type JSX, Match, Show, Switch } from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import { makeCustomElementTagName } from "../definitions";
import type {
  SettingsStatus,
  SettingsStore,
} from "../stores/persistent-stores/settings-store";
import type { AuthStore } from "../stores/persistent-stores/auth-store";

const TAG_NAME = makeCustomElementTagName("settings-tab");
const TAG_NAME_SECTION_AUTH_IN_THE_WILD = //
  makeCustomElementTagName("settings-tab-section-auth-in-the-wild");

let elementConstructor: CustomElementConstructor | null = null;
let elementConstructorSectionAuth: CustomElementConstructor | null = null;

export function registerSettingsTab(opts: {
  authStore: AuthStore;
  settingsStore: SettingsStore;
}): { tagName: typeof TAG_NAME } {
  elementConstructor ??= customElement(TAG_NAME, {}, () => {
    noShadowDOM();

    return (
      <SettingsTab
        authStore={opts.authStore}
        settingsStore={opts.settingsStore}
      />
    );
  });

  return { tagName: TAG_NAME };
}

const SettingsTab: Component<
  { authStore: AuthStore; settingsStore: SettingsStore }
> = (props) => {
  const status = props.settingsStore.getStatusSignal();

  return (
    <div
      style={status().saving ? { cursor: "wait" } : undefined}
    >
      <Switch>
        <Match when={status().saving}>
          正在保存…
        </Match>
        <Match when={status().error}>
          {(error) => (
            <div style={{ color: "red" }}>
              <span>{`错误：${error()}`}</span>
            </div>
          )}
        </Match>
      </Switch>

      <div style={{ "text-align": "center" }}>
        <a class="l" target="_blank" href={`/dev/app/${CHII_APP_ID}`}>组件页</a>
      </div>
      <SectionAuth authStore={props.authStore} />
      <SectionAntiSpoiler
        settingsStore={props.settingsStore}
        status={status()}
      />
    </div>
  );
};

export function createSettingsTabSectionAuthInTheWildInstance(opts: {
  authStore: AuthStore;
}) {
  const r = registerSettingsTabSectionAuthInTheWild(opts);
  const el = document.createElement(r.tagName);
  return { element: el };
}

function registerSettingsTabSectionAuthInTheWild(opts: {
  authStore: AuthStore;
}): { tagName: typeof TAG_NAME_SECTION_AUTH_IN_THE_WILD } {
  elementConstructorSectionAuth ??= customElement(
    TAG_NAME_SECTION_AUTH_IN_THE_WILD,
    {},
    () => {
      noShadowDOM();

      return <SectionAuthInTheWild authStore={opts.authStore} />;
    },
  );

  return { tagName: TAG_NAME_SECTION_AUTH_IN_THE_WILD };
}

const SectionAuthInTheWild: Component<{
  authStore: AuthStore;
}> = (props) => {
  return (
    <div style={{ "border-style": "dotted" }}>
      <SectionAuth authStore={props.authStore} />
    </div>
  );
};

const SectionAuth: Component<{
  authStore: AuthStore;
}> = (props) => {
  return (
    <DisableableSection disabled={false}>
      <div class="title">身份认证（用于单集评分服务器）</div>
      <div style={{ display: "flex", "justify-content": "space-between" }}>
        <div>状态</div>
        <div style={{ display: "flex", "flex-direction": "column" }}>
          <div>
            <Switch>
              <Match when={props.authStore.statusUnion().noSessionToken}>
                尚未取得用于身份认证的令牌。
                <br />
                请<a
                  class="l"
                  target="_blank"
                  href={props.authStore.URL_AUTH_BANGUMI_PAGE}
                >
                  授权此应用。
                </a>以获取该令牌。
                <br />
                此流程用于确认登录者。
              </Match>
              <Match when={props.authStore.statusUnion().withSessionToken}>
                <span style={{ color: "green" }}>已取得身份认证令牌。</span>
                {/* TODO: 允许 deactivate 该令牌。 */}
              </Match>
              <Match when={props.authStore.statusUnion().redeemingSessionToken}>
                <span style={{ color: "orange" }}>正在兑换身份认证令牌…</span>
              </Match>
            </Switch>
          </div>
          <Show when={props.authStore.tabClosureCountdownSeconds()}>
            {(countdown) => (
              <div>
                此标签页将于 <span style={{ color: "red" }}>{countdown()}</span>
                {" "}
                秒后自动关闭。
                <br />
                <button
                  onClick={() => props.authStore.stopTabClosureCountdown()}
                >
                  不要自动关闭！
                </button>
              </div>
            )}
          </Show>
        </div>
      </div>
    </DisableableSection>
  );
};

const SectionAntiSpoiler: Component<{
  settingsStore: SettingsStore;
  status: SettingsStatus;
}> = (props) => {
  const optAntiSpoiler = props.settingsStore.getAntiSpoilerSignal();

  return (
    <DisableableSection disabled={!!props.status.saving}>
      <div class="title">章节评分防剧透</div>
      <RadioGroup
        currentValue={optAntiSpoiler()}
        options={props.settingsStore.getAntiSpoilerValues()}
        getLabel={(value) =>
          props.settingsStore.getAntiSpoilerValueLabelText(value)}
        setValue={(v) => props.settingsStore.updateAntiSpoiler(v)}
      />
    </DisableableSection>
  );
};

const DisableableSection: Component<{
  disabled: boolean;
  children: JSX.Element;
}> = (props) => {
  return (
    <div
      class="section"
      style={props.disabled
        ? { filter: "grayscale(100%)", "pointer-events": "none" }
        : undefined}
    >
      {props.children}
    </div>
  );
};

function RadioGroup<T extends string>(props: {
  currentValue: T;
  options: T[];
  getLabel: (value: T) => string;
  setValue: (newValue: T) => void;
}) {
  return (
    <div class="options-container">
      <Index each={props.options}>
        {(value) => (
          <div class="option-item">
            <input
              type="radio"
              value={value()}
              checked={props.currentValue === value()}
              // 目前并不起作用：
              onInput={() => props.setValue(value())}
            />
            <label
              // 真正起作用的：
              onClick={() => props.setValue(value())}
            >
              <span class="radio-custom" />
              <span class="label-text">{props.getLabel(value())}</span>
            </label>
          </div>
        )}
      </Index>
    </div>
  );
}
