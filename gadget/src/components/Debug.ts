import * as Global from "../global";

export function renderDebug(el: JQuery<HTMLElement>) {
  $(el).html(/*html*/ `
    <div style="display: flex; flex-direction: column">
      <a data-sel="auth-link" class="l">
          将我的 Bangumi 账号关联至 Test 应用。
        </a>
      <p data-sel="whoami">whoami: {me()}</p>
    </div>
  `);

  $(el).find("[data-sel=auth-link]").attr(
    "href",
    Global.client.URL_AUTH_BANGUMI_PAGE,
  );

  function updateWhoami(me: string) {
    $(el).find("[data-sel=whoami]").text(`whoami: ${me}`);
  }
  updateWhoami("…");

  Global.token.watch(async () => {
    const userID = await Global.client.mustGetWhoami();
    updateWhoami(userID ? `${userID}` : "未登录");
  });
}
