import { createMemo, createSignal } from "solid-js";

import type { APIResponseEx, AuthClient } from "../../clients/auth-client";
import {
  LOCAL_STORAGE_KEY_ACCESS_TOKEN,
  LOCAL_STORAGE_KEY_SESSION_TOKEN,
} from "../../definitions";

export type AuthStore = ReturnType<typeof createAuthStore>;

type Status =
  | ["noSessionToken"]
  | ["withSessionToken", string]
  | ["redeemingSessionToken"];

export function createAuthStore(opts: { authClient: AuthClient }) {
  const [status, setStatus] = createSignal<Status>((() => {
    const token = localStorage.getItem(LOCAL_STORAGE_KEY_SESSION_TOKEN);
    if (token) {
      return ["withSessionToken", token];
    } else {
      return ["noSessionToken"];
    }
  })());
  const statusUnion = createMemo(() => statusUnionFromStatus(status()));

  window.addEventListener("storage", (ev) => {
    if (ev.key !== LOCAL_STORAGE_KEY_SESSION_TOKEN) return;
    if (ev.newValue === statusUnion().withSessionToken) return;

    if (ev.newValue) {
      setStatus(["withSessionToken", ev.newValue]);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_KEY_ACCESS_TOKEN);
      setStatus(["noSessionToken"]);
    }
  });

  const [tabClosureCountdownSeconds, setTabClosureCountdownSeconds] = //
    createSignal<number | null>(null);

  function clear() {
    setStatus(["noSessionToken"]);
    localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION_TOKEN);
    localStorage.removeItem(LOCAL_STORAGE_KEY_ACCESS_TOKEN);
  }

  function redeemTokenCoupon(tokenCoupon: string) {
    setStatus(["redeemingSessionToken"]);
    (async () => {
      const resp = await opts.authClient.redeemTokenCoupon(tokenCoupon);
      switch (resp[0]) {
        case "ok": {
          const sessionToken = resp[1];
          if (sessionToken) {
            localStorage.setItem(LOCAL_STORAGE_KEY_SESSION_TOKEN, sessionToken);
            setStatus(["withSessionToken", sessionToken]);
            setTabClosureCountdownSeconds(5);
            const intervalId = setInterval(() => {
              const countdown = tabClosureCountdownSeconds();
              if (countdown === null) {
                clearInterval(intervalId);
                return;
              }
              const nextCountdown = countdown - 1;
              if (nextCountdown <= 0) {
                window.close();
              } else {
                setTabClosureCountdownSeconds(nextCountdown);
              }
            }, 1000);
          } else {
            clear();
          }
          break;
        }
        case "error":
          setStatus(["noSessionToken"]);
          window.alert(`获取 session token 失败：${resp[2]} (${resp[1]})`);
          break;
        default:
          resp satisfies never;
      }
    })();
  }

  async function fetchAccessToken(): Promise<APIResponseEx<string>> {
    const status_ = status();
    if (status_[0] === "withSessionToken") {
      const resp = await opts.authClient.fetchAccessToken(status_[1]);
      if (resp[0] === "auth_required") {
        clear();
      }
      return resp;
    }
    return ["auth_required"];
  }

  return {
    statusUnion,
    clear,
    redeemTokenCoupon,
    fetchAccessToken,
    get URL_AUTH_BANGUMI_PAGE() {
      return opts.authClient.URL_AUTH_BANGUMI_PAGE;
    },
    tabClosureCountdownSeconds,
    stopTabClosureCountdown() {
      setTabClosureCountdownSeconds(null);
    },
  };
}

export type StatusUnion = {
  noSessionToken?: true;
  withSessionToken?: string;
  redeemingSessionToken?: true;
};

function statusUnionFromStatus(status: Status): StatusUnion {
  switch (status[0]) {
    case "noSessionToken":
      return { noSessionToken: true };
    case "withSessionToken":
      return { withSessionToken: status[1] };
    case "redeemingSessionToken":
      return { redeemingSessionToken: true };
  }
}
