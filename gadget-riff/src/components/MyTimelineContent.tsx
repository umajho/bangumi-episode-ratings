import type { Component } from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import { EPRT_ID_HTML_SAFE, makeCustomElementTagName } from "../definitions";

const TAG_NAME = makeCustomElementTagName("my-timeline-content");

export function createMyTimelineContentInstance(_opts: {}) {
  registerMyTimelineContent();
  const el = document.createElement(TAG_NAME);
  return { element: el };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerMyTimelineContent() {
  elementConstructor ??= customElement(TAG_NAME, {}, () => {
    noShadowDOM();

    return <MyTimelineContent />;
  });
}

const MyTimelineContent: Component<{}> = () => {
  return (
    <div>
      <button
        onClick={() =>
          chiiLib.ukagaka.showCustomizePanelWithTab(EPRT_ID_HTML_SAFE)}
      >
        打开设置
      </button>
      <Loading />
    </div>
  );
};

const Loading: Component<{}> = () => {
  return (
    <div class="loading">
      <img src="/img/loadingAnimation.gif" />
    </div>
  );
};
