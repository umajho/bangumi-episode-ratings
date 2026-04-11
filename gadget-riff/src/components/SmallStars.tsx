import type { Component } from "solid-js";
import { cls } from "../utils/cls";

export const SmallStars: Component<
  { score: number; shouldShowNumber: boolean }
> = (props) => {
  return (
    <span>
      <span class="starstop-s">
        <span
          class={Number.isNaN(props.score) ? undefined : cls(
            "starlight",
            `stars${Math.round(props.score)}`,
          )}
        >
        </span>
      </span>{" "}
      {props.shouldShowNumber
        ? (
          <small class="fade">
            {Number.isNaN(props.score) ? "--" : props.score.toFixed(4)}
          </small>
        )
        : null}
    </span>
  );
};
