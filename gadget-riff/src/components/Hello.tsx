import { customElement, noShadowDOM } from "solid-element";
import { type Component } from "solid-js";
import { makeCustomElementTagName } from "../definitions";

const TAG_NAME = makeCustomElementTagName("hello");

let elementConstructor: CustomElementConstructor | null = null;

export function registerHello() {
  elementConstructor ??= customElement(TAG_NAME, {}, Hello);
}

export function createHelloElement() {
  registerHello();
  return document.createElement(TAG_NAME);
}

export const Hello: Component<{}> = (_props) => {
  noShadowDOM();

  return <div>Hello world!</div>;
};
