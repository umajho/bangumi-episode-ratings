import { render } from "solid-js/web";

import env from "./env";
import { client, setToken } from "./global";
import Debug from "./components/Debug";

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

    const token = await client.redeemTokenCoupon(tokenCoupon);
    setToken(token);
  }

  const goAuthorizeEl = document.createElement("div");
  document.body.prepend(goAuthorizeEl);

  render(Debug, goAuthorizeEl);
}

main();
