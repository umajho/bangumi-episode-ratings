import type { Component, JSX } from "solid-js";
import { cls } from "../utils/cls";

export const Tooltip: Component<{
  pos?: "top" | "bottom" | "left" | "right";
  style?: JSX.CSSProperties;
  left?: number;
  top?: number;
  children: JSX.Element;
}> = (props) => {
  return (
    <div
      class={cls("tooltip fade in", props.pos ?? "top")}
      role="tooltip"
      style={{
        width: "max-content",
        ...props.style,
        ...(props.left !== undefined ? { left: `${props.left}px` } : {}),
        ...(props.top !== undefined ? { top: `${props.top}px` } : {}),
      }}
    >
      <div class="tooltip-arrow" style="left: 50%;"></div>
      <div class="tooltip-inner">{props.children}</div>
    </div>
  );
};
