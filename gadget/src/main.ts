import env from "./env";
import { client, token } from "./global";
import { renderDebug } from "./components/Debug";

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

    token.setValue(await client.redeemTokenCoupon(tokenCoupon));
  }

  const debugEl = $("<div />");
  $("body").prepend(debugEl);
  renderDebug(debugEl);
}

main();
