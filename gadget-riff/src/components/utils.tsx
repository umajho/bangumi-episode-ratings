import type { Component, JSX } from "solid-js";

export const L: Component<{
  children: JSX.Element;
  _blank?: boolean;
  href: string;
}> = (props) => {
  return (
    <a
      class="l"
      target={props._blank ? "_blank" : undefined}
      href={props.href}
    >
      {props.children}
    </a>
  );
};
