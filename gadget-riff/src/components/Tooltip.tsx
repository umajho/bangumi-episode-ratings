import type { Component, JSX } from "solid-js";

export const Tooltip: Component<{
  style: JSX.CSSProperties;
  left?: number;
  top?: number;
  children: JSX.Element;
}> = (props) => {
  return (
    <div
      class="tooltip fade top in"
      role="tooltip"
      style={{
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
