import { type Component, Show } from "solid-js";
import { customElement, noShadowDOM } from "solid-element";

import { cls } from "../utils/cls";
import { makeCustomElementTagName } from "../definitions";

const TAG_NAME = makeCustomElementTagName("small-stars");

export function createSmallStarsInstance(opts: {
  score: number;
}) {
  registerSmallStars();
  const el = document.createElement(TAG_NAME);
  el.setAttribute("score", String(opts.score));

  return { element: el };
}

let elementConstructor: CustomElementConstructor | null = null;

function registerSmallStars() {
  elementConstructor ??= customElement(TAG_NAME, {
    score: null,
    shouldShowNumber: null,
  }, (props) => {
    noShadowDOM();

    return (
      <SmallStars
        score={props.score!}
        shouldShowNumber={false}
      />
    );
  });
}

export const SmallStars: Component<
  { score: number | null; shouldShowNumber: boolean }
> = (props) => {
  return (
    <span>
      <span class="starstop-s">
        <Show when={props.score !== null}>
          <span
            class={Number.isNaN(props.score) ? undefined : cls(
              "starlight",
              `stars${Math.round(props.score!)}`,
            )}
          >
          </span>
        </Show>
      </span>{" "}
      {props.shouldShowNumber
        ? (
          <small class="fade">
            {(props.score === null || Number.isNaN(props.score))
              ? "--"
              : props.score.toFixed(4)}
          </small>
        )
        : null}
    </span>
  );
};
