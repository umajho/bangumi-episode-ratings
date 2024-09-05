export function renderErrorWithRetry(
  el: JQuery<HTMLElement>,
  props: {
    message: string;
    onRetry: () => void;
  },
) {
  $(el).css("color", "red");
  $(el).html(/*html*/ `
    <span></span>
    <button type="button">重试</button>
  `);

  $(el).find("span").text(`错误：${props.message}`);
  $(el).find("button").on("click", props.onRetry);

  return { el };
}
