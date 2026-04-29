import { type Component, Index, Match, Switch } from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import { makeCustomElementTagName } from "../definitions";
import type { SettingsStore } from "../stores/persistent-stores/settings-store";

const TAG_NAME = makeCustomElementTagName("settings-tab");

let elementConstructor: CustomElementConstructor | null = null;

export function registerSettingsTab(opts: {
  settingsStore: SettingsStore;
}): { tagName: typeof TAG_NAME } {
  elementConstructor ??= customElement(TAG_NAME, {}, () => {
    noShadowDOM();

    return <SettingsTab settingsStore={opts.settingsStore} />;
  });

  return { tagName: TAG_NAME };
}

const SettingsTab: Component<{
  settingsStore: SettingsStore;
}> = ({ settingsStore }) => {
  const status = settingsStore.getStatusSignal();
  const optAntiSpoiler = settingsStore.getAntiSpoilerSignal();

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

      <div
        style={status().saving
          ? { filter: "grayscale(100%)", "pointer-events": "none" }
          : undefined}
      >
        <div class="section">
          <div class="title">章节评分防剧透</div>
          <RadioGroup
            currentValue={optAntiSpoiler()}
            options={settingsStore.getAntiSpoilerValues()}
            getLabel={(value) =>
              settingsStore.getAntiSpoilerValueLabelText(value)}
            setValue={(v) => settingsStore.updateAntiSpoiler(v)}
          />
        </div>
      </div>
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
