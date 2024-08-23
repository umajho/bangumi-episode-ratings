import { createEffect, createSignal, on } from "solid-js";
import { render } from "solid-js/web";

import env from "./env";

const [token, setToken] = createSignal(
  localStorage.getItem(env.LOCAL_STORAGE_KEY_TOKEN),
);

const GoAuthorize = () => {
  const [me, setMe] = createSignal<string>("…");

  createEffect(on([token], async ([token]) => {
    if (!token) {
      setMe("（未登录）");
      return;
    }

    const headers = new Headers();
    headers.append("Authorization", `Basic ${token}`);
    const resp = await fetch(env.APP_URL_API_WHOAMI, {
      headers,
      credentials: "include",
    });
    const data = await resp.json();

    if (data[0] === "error") {
      setMe(`ERROR!`);
      throw new Error(data[2]);
    } else {
      setMe(data[1]);
    }
  }));

  return (
    <div style="display: flex; flex-direction: column">
      <a class="l" href={env.APP_URL_GO_AUTHORIZE}>
        将我的 Bangumi 账户关联至 Test 应用。
      </a>
      <p>whoami: {me()}</p>
    </div>
  );
};

async function main() {
  const searchParams = new URLSearchParams(window.location.search);
  const tokenCoupon = searchParams.get(env.SEARCH_PARAMS_KEY_TOKEN_COUPON);
  if (tokenCoupon) {
    searchParams.delete(env.SEARCH_PARAMS_KEY_TOKEN_COUPON);
    let newURL = `${window.location.pathname}`;
    if (searchParams.size) {
      newURL += `?${searchParams.toString()}`;
    }
    window.history.replaceState(null, "", newURL);

    const resp = await fetch(env.APP_URL_API_REDEEM_TOKEN_COUPON, {
      method: "POST",
      body: JSON.stringify({ tokenCoupon }),
    });
    const data = await resp.json();

    if (data[0] === "error") {
      throw new Error(data[2]);
    } else {
      localStorage.setItem(env.LOCAL_STORAGE_KEY_TOKEN, data[1]);
      setToken(data[1]);
    }
  }

  const goAuthorizeEl = document.createElement("div");
  document.body.prepend(goAuthorizeEl);

  render(GoAuthorize, goAuthorizeEl);
}

main();
