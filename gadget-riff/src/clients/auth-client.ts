import { GADGET_VERSION, LOCAL_STORAGE_KEY_ACCESS_TOKEN } from "../definitions";
import type { APIResponse } from "../shared/dto";
import ENDPOINT_PATHS from "../shared/endpoint-paths";
import type { EntrypointStore } from "../stores/persistent-stores/entrypoint-store";
import { readonlyPageData } from "../stores/readonly-page-data";

export type APIResponseEx<T> = APIResponse<T> | [tag: "auth_required"];

export class AuthClient {
  public readonly entrypointStore: EntrypointStore;

  constructor(
    opts: {
      entrypointStore: EntrypointStore;
    },
  ) {
    this.entrypointStore = opts.entrypointStore;
  }

  get URL_AUTH_BANGUMI_PAGE(): string {
    const url = //
      new URL(this.buildFullEndpoint("auth", ENDPOINT_PATHS.AUTH.BANGUMI_PAGE));
    url.searchParams.set("gadget_version", GADGET_VERSION);
    url.searchParams.set("referrer", window.location.origin);
    return url.toString();
  }

  async redeemTokenCoupon(
    tokenCoupon: string,
  ): Promise<APIResponse<string | null>> {
    const resp: APIResponseEx<string> = await this.fetch(
      "auth",
      ENDPOINT_PATHS.AUTH.REDEEM_TOKEN_COUPON,
      {
        token: null,

        method: "POST",
        body: JSON.stringify({ tokenCoupon }),
      },
    );

    if (resp[0] === "auth_required") throw new Error("unreachable!");

    return resp;
  }

  async fetchAccessToken(sessionToken: string): Promise<APIResponseEx<string>> {
    const fn = async (): Promise<APIResponseEx<string>> => {
      const accessToken = localStorage.getItem(LOCAL_STORAGE_KEY_ACCESS_TOKEN);
      if (accessToken && checkJWTExpiry(accessToken) === "valid") {
        return ["ok", accessToken];
      }

      const resp: APIResponseEx<string> = await this.fetch(
        "auth",
        ENDPOINT_PATHS.AUTH.REFRESH_JWT,
        {
          token: ["basic", sessionToken],

          method: "POST",
        },
      );

      if (resp[0] === "ok") {
        const [_, jwt] = resp;
        localStorage.setItem(LOCAL_STORAGE_KEY_ACCESS_TOKEN, jwt);
      }

      return resp;
    };

    if (window.navigator.locks) {
      return window.navigator.locks.request(LOCAL_STORAGE_KEY_ACCESS_TOKEN, fn);
    } else {
      return fn();
    }
  }

  private async fetch<T>(
    group: "auth",
    endpointPath: string,
    opts: {
      token: ["basic", string] | null;

      method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      searchParams?: URLSearchParams;
      body?: string;
    },
  ): Promise<APIResponseEx<T>> {
    const url = new URL(this.buildFullEndpoint(group, endpointPath));
    if (opts.searchParams) {
      url.search = opts.searchParams.toString();
    }

    const headers = new Headers();
    if (opts.token) {
      switch (opts.token[0]) {
        case "basic": {
          headers.set("Authorization", `Basic ${opts.token[1]}`);
          break;
        }
        default:
          opts.token[0] satisfies never;
      }
    }
    headers.set("X-Gadget-Version", GADGET_VERSION);
    if (readonlyPageData.claimedUserId !== null) {
      headers.set(
        "X-Claimed-User-ID",
        readonlyPageData.claimedUserId.toString(),
      );
    }

    try {
      const resp = await fetch(this.buildRequest(url, {
        method: opts.method,
        headers,
        body: opts.body,
      }));

      const respJSON = await resp.json() as APIResponse<unknown>;
      if (respJSON[0] === "error" && respJSON[1] === "AUTH_REQUIRED") {
        return ["auth_required"];
      }

      return respJSON as APIResponse<T>;
    } catch (e) {
      const operation = `fetch \`${opts.method} ${url}\``;
      console.error(`${operation} 失败`, e);
      return ["error", "UNKNOWN", `${operation} 失败： ${e}`];
    }
  }

  private buildRequest(url: URL, init: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers: Headers;
    body?: string;
  }): Request {
    return new Request(url, init);
  }

  private buildFullEndpoint(
    group: "auth",
    endpointPath: string,
  ): string {
    const entrypoint = ((): string => {
      switch (group) {
        case "auth":
          return this.entrypointStore.authEntrypoint;
        default:
          group satisfies never;
          throw new Error("unreachable");
      }
    })();

    return join(entrypoint, endpointPath);
  }
}

function join(base: string, url: string): string {
  return (new URL(url, base)).href;
}

function checkJWTExpiry(jwt: string): "expired" | "valid" {
  const decoded = JSON.parse(atob(jwt.split(".")[1]));
  const exp = decoded.exp;
  const now = Math.floor(Date.now() / 1000);
  return now > exp ? "expired" : "valid";
}
