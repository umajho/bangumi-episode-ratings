import { createEffect, createSignal, on } from "solid-js";

import { client, token } from "../global";

export default () => {
  const [me, setMe] = createSignal<string>("…");

  createEffect(on([token], async ([token]) => {
    const userID = await client.whoami();
    if (!token) {
      setMe("（未登录）");
    } else {
      setMe(`${userID}`);
    }
  }));

  return (
    <div style="display: flex; flex-direction: column">
      <a class="l" href={client.URL_AUTH_BANGUMI_PAGE}>
        将我的 Bangumi 账户关联至 Test 应用。
      </a>
      <p>whoami: {me()}</p>
    </div>
  );
};
