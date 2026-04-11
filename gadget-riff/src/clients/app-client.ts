import {
  type EpisodeId,
  GADGET_VERSION,
  LOCAL_STORAGE_KEY_JWT,
  type Score,
  type SubjectId,
} from "../definitions";
import type {
  APIResponse,
  GetEpisodeRatingsResponseData,
  GetSubjectEpisodesResponseData,
  GetUserTimeLineItemsResponseData,
  RateEpisodeRequestData,
  RateEpisodeResponseData,
} from "../shared/dto";
import ENDPOINT_PATHS from "../shared/endpoint-paths";
import type { AuthStore } from "../stores/persistent-stores/auth-store";
import type { EntrypointStore } from "../stores/persistent-stores/entrypoint-store";
import { readonlyPageData } from "../stores/readonly-page-data";

export type APIResponseEx<T> = APIResponse<T> | [tag: "auth_required"];

export class AppClient {
  public readonly entrypointStore: EntrypointStore;
  public readonly authStore: AuthStore;

  constructor(
    opts: {
      entrypointStore: EntrypointStore;
      authStore: AuthStore;
    },
  ) {
    this.entrypointStore = opts.entrypointStore;
    this.authStore = opts.authStore;
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
        tokenType: "basic",

        method: "POST",
        body: JSON.stringify({ tokenCoupon }),
      },
    );

    if (resp[0] === "auth_required") throw new Error("unreachable!");

    return resp;
  }

  async patchEpisodeRating(
    opts: {
      subjectID: SubjectId;
      episodeID: EpisodeId;
      score?: Score | null;
      isVisible?: boolean;
    },
  ): Promise<APIResponseEx<RateEpisodeResponseData>> {
    if (!this.authStore.token) return ["auth_required"];

    const bodyData: RateEpisodeRequestData = {
      ...(opts.score !== undefined ? { score: opts.score } : {}),
      ...(opts.isVisible !== undefined
        ? { visibility: { is_visible: opts.isVisible } }
        : {}),
    };

    const resp = await this.fetch<RateEpisodeResponseData>(
      "api/v1",
      `subjects/${opts.subjectID}/episodes/${opts.episodeID}/ratings/mine`,
      {
        tokenType: "jwt",

        method: "PATCH",
        body: JSON.stringify(bodyData),
      },
    );

    return resp;
  }

  async getSubjectEpisodesRatings(
    opts: { subjectID: SubjectId },
  ): Promise<APIResponse<GetSubjectEpisodesResponseData>> {
    return this.fetch<
      GetSubjectEpisodesResponseData
    >(
      "api/v1",
      `subjects/${opts.subjectID}/episodes/ratings`,
      {
        tokenType: "jwt",

        method: "GET",
      },
    ).then((resp) => {
      if (resp[0] === "auth_required") {
        throw new Error("unreachable!");
      } else if (resp[0] === "error") {
        return resp;
      } else if (resp[0] === "ok") {
        const [_, data] = resp;
        return ["ok", data];
      } else {
        resp satisfies never;
        throw new Error("unreachable!");
      }
    });
  }

  async getEpisodeRatings(
    opts: { subjectID: SubjectId; episodeID: EpisodeId },
  ): Promise<APIResponseEx<GetEpisodeRatingsResponseData>> {
    return await this.fetch(
      "api/v1",
      `subjects/${opts.subjectID}/episodes/${opts.episodeID}/ratings`,
      {
        tokenType: "jwt",

        method: "GET",
      },
    );
  }

  get TIMELINE_ITEMS_PER_PAGE(): number {
    return 10;
  }

  async getMyTimelineItems(
    opts: { pageNumber: number },
  ): Promise<APIResponseEx<GetUserTimeLineItemsResponseData>> {
    const searchParams = new URLSearchParams();
    searchParams.set("offset", "" + ((opts.pageNumber - 1) * 10));
    searchParams.set("limit", "" + this.TIMELINE_ITEMS_PER_PAGE);

    return await this.fetch(
      "api/v1",
      `users/me/timeline/items`,
      {
        tokenType: "jwt",

        method: "GET",
        searchParams,
      },
    );
  }

  async deleteMyTimelineItem(
    opts: { timestampMs: number },
  ): Promise<APIResponseEx<null>> {
    return await this.fetch(
      "api/v1",
      `users/me/timeline/items/${opts.timestampMs}`,
      {
        tokenType: "jwt",

        method: "DELETE",
      },
    );
  }

  async downloadMyEpisodeRatingsData(): Promise<APIResponseEx<void>> {
    const resp = await this.fetch<any>( // TODO!!!: remove `any`.
      "api/v1",
      "users/me/episode-ratings-data-file",
      {
        tokenType: "jwt",

        method: "GET",
      },
    );

    if (resp[0] !== "ok") return resp;
    const [_, data] = resp;
    this.saveFile(data.content, { fileName: data.fileName });

    return ["ok", undefined];
  }

  private async fetch<T>(
    group: "auth" | "api/v1",
    endpointPath: string,
    opts: {
      tokenType: "basic" | "jwt";

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
    if (this.authStore.token) {
      if (opts.tokenType === "basic") {
        headers.set("Authorization", `Basic ${this.authStore.token}`);
      } else {
        const resp = await this.fetchJWT();
        if (resp[0] !== "ok") return resp;
        const [_, jwt] = resp;
        headers.set("Authorization", `Bearer ${jwt}`);
      }
    }
    headers.set("X-Gadget-Version", GADGET_VERSION);
    if (readonlyPageData.claimedUserID !== null) {
      headers.set(
        "X-Claimed-User-ID",
        readonlyPageData.claimedUserID.toString(),
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
        this.authStore.token = null;
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
    group: "auth" | "api/v1",
    endpointPath: string,
  ): string {
    const entrypoint = ((): string => {
      switch (group) {
        case "auth":
          return this.entrypointStore.authEntrypoint;
        case "api/v1":
          return this.entrypointStore.apiEntrypoint + "v1/";
        default:
          group satisfies never;
          throw new Error("unreachable");
      }
    })();

    return join(entrypoint, endpointPath);
  }

  private async fetchJWT(): Promise<APIResponseEx<string>> {
    const fn = async (): Promise<APIResponseEx<string>> => {
      const localToken = localStorage.getItem(LOCAL_STORAGE_KEY_JWT);
      if (localToken && checkJWTExpiry(localToken) === "valid") {
        return ["ok", localToken];
      }

      const resp: APIResponseEx<string> = await this.fetch(
        "auth",
        ENDPOINT_PATHS.AUTH.REFRESH_JWT,
        {
          tokenType: "basic",

          method: "POST",
        },
      );

      if (resp[0] === "ok") {
        const [_, jwt] = resp;
        localStorage.setItem(LOCAL_STORAGE_KEY_JWT, jwt);
      }

      return resp;
    };

    if (window.navigator.locks) {
      return window.navigator.locks.request(LOCAL_STORAGE_KEY_JWT, fn);
    } else {
      return fn();
    }
  }

  private saveFile(data: string, opts: { fileName: string }) {
    const blob = new Blob([data], { type: "text/plain; charset=utf-8" });
    const aEl = document.createElement("a");
    aEl.href = URL.createObjectURL(blob);
    aEl.download = opts.fileName;
    aEl.click();
    URL.revokeObjectURL(aEl.href);
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
