import type { Component } from "solid-js";

export const ErrorWithRetry: Component<{
  message: string;
  onRetry: () => void;
}> = (props) => {
  return (
    <div style={{ color: "red" }}>
      <span>{`错误：${props.message}`}</span>
      {/* TODO: */}
      {
        /* <button type="button" onClick={props.onRetry}>
        重试
      </button> */
      }
    </div>
  );
};
