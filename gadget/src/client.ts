import { Score } from "./definitions";
import env from "./env";
import Global from "./global";
import {
  APIResponse,
  ChangeUserEpisodeRatingVisibilityResponseData,
  GetEpisodeRatingsResponseData,
  GetSubjectEpisodesResponseData,
  GetUserTimeLineItemsResponseData,
  RateEpisodeRequestData,
  RateEpisodeResponseData,
} from "./shared/dto";
import ENDPOINT_PATHS from "./shared/endpoint-paths";

export type APIResponseEx<T> = APIResponse<T> | [tag: "auth_required"];

export class Client {
  public readonly authEntrypoint: string;
  public readonly apiEntrypoint: string;
  public token: string | null;

  constructor(
    opts: {
      authEntrypoint: string;
      apiEntrypoint: string;
      token: string | null;
    },
  ) {
    this.authEntrypoint = opts.authEntrypoint;
    this.apiEntrypoint = opts.apiEntrypoint;
    this.token = opts.token;
  }

  get URL_AUTH_BANGUMI_PAGE(): string {
    const url = //
      new URL(this.buildFullEndpoint("auth", ENDPOINT_PATHS.AUTH.BANGUMI_PAGE));
    url.searchParams.set("gadget_version", Global.version);
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

  async rateEpisode(
    opts: { subjectID: number; episodeID: number; score: Score | null },
  ): Promise<APIResponseEx<RateEpisodeResponseData>> {
    if (!this.token) return ["auth_required"];

    if (opts.score !== null) {
      const bodyData: RateEpisodeRequestData = { score: opts.score };

      return await this.fetch(
        "api/v1",
        `subjects/${opts.subjectID}/episodes/${opts.episodeID}/ratings/mine`,
        {
          tokenType: "jwt",

          method: "PUT",
          body: JSON.stringify(bodyData),
        },
      );
    } else {
      return await this.fetch(
        "api/v1",
        `subjects/${opts.subjectID}/episodes/${opts.episodeID}/ratings/mine`,
        {
          tokenType: "jwt",

          method: "DELETE",
        },
      );
    }
  }

  private subjectEpisodesRatingsCache: {
    [subjectID: number]:
      | GetSubjectEpisodesResponseData
      | Promise<APIResponse<GetSubjectEpisodesResponseData>>;
  } = {};

  hasCachedSubjectEpisodesRatings(subjectID: number): boolean {
    return (!!this.subjectEpisodesRatingsCache[subjectID]);
  }

  async getSubjectEpisodesRatings(opts: { subjectID: number }): Promise<
    APIResponse<GetSubjectEpisodesResponseData>
  > {
    if (this.subjectEpisodesRatingsCache[opts.subjectID]) {
      const cached = this.subjectEpisodesRatingsCache[opts.subjectID];
      // XXX: 不能用 `cached instanceof Promise` 来判断。这么做在 Tampermonkey
      // 的环境下有效，但在 Bangumi 超合金组件的环境下总是为 false。
      if ("then" in cached) {
        return await cached;
      } else {
        return ["ok", cached];
      }
    }

    return this.subjectEpisodesRatingsCache[opts.subjectID] = this.fetch<
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
        delete this.subjectEpisodesRatingsCache[opts.subjectID];
        return resp;
      } else if (resp[0] === "ok") {
        const [_, data] = resp;
        return ["ok", this.subjectEpisodesRatingsCache[opts.subjectID] = data];
      } else {
        resp satisfies never;
        throw new Error("unreachable!");
      }
    });
  }

  async getEpisodeRatings(): Promise<
    APIResponseEx<GetEpisodeRatingsResponseData>
  > {
    return await this.fetch(
      "api/v1",
      `subjects/${Global.subjectID}/episodes/${Global.episodeID}/ratings`,
      {
        tokenType: "jwt",

        method: "GET",
      },
    );
  }

  async changeUserEpisodeRatingVisibility(
    opts: { isVisible: boolean },
  ): Promise<APIResponseEx<ChangeUserEpisodeRatingVisibilityResponseData>> {
    return await this.fetch(
      "api/v1",
      `subjects/${Global.subjectID}/episodes/${Global.episodeID}/ratings/mine/is-visible`,
      {
        tokenType: "jwt",

        method: "PUT",
        body: JSON.stringify(opts.isVisible),
      },
    );
  }

  get TIMELINE_ITEMS_PER_PAGE(): number {
    return 10;
  }

  async getMyTimelineItems(opts: { pageNumber: number }): Promise<
    APIResponseEx<GetUserTimeLineItemsResponseData>
  > {
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

      method: "GET" | "POST" | "PUT" | "DELETE";
      searchParams?: URLSearchParams;
      body?: string;
    },
  ): Promise<APIResponseEx<T>> {
    const url = new URL(this.buildFullEndpoint(group, endpointPath));
    if (opts.searchParams) {
      url.search = opts.searchParams.toString();
    }

    const headers = new Headers();
    if (this.token) {
      if (opts.tokenType === "basic") {
        headers.set("Authorization", `Basic ${this.token}`);
      } else {
        const resp = await this.fetchJWT();
        if (resp[0] !== "ok") return resp;
        const [_, jwt] = resp;
        headers.set("Authorization", `Bearer ${jwt}`);
      }
    }
    headers.set("X-Gadget-Version", Global.version);
    if (Global.claimedUserID !== null) {
      headers.set("X-Claimed-User-ID", Global.claimedUserID.toString());
    }

    try {
      const resp = await fetch(this.buildRequest(url, {
        method: opts.method,
        headers,
        body: opts.body,
      }));

      const respJSON = await resp.json() as APIResponse<unknown>;
      if (respJSON[0] === "error" && respJSON[1] === "AUTH_REQUIRED") {
        if (Global.token.getValueOnce() !== null) {
          Global.token.setValue(null);
        }
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
    method: "GET" | "POST" | "PUT" | "DELETE";
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
          return this.authEntrypoint;
        case "api/v1":
          return this.apiEntrypoint + "v1/";
        default:
          group satisfies never;
          throw new Error("unreachable");
      }
    })();

    return join(entrypoint, endpointPath);
  }

  private async fetchJWT(): Promise<APIResponseEx<string>> {
    const fn = async (): Promise<APIResponseEx<string>> => {
      const localToken = localStorage.getItem(env.LOCAL_STORAGE_KEY_JWT);
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
        localStorage.setItem(env.LOCAL_STORAGE_KEY_JWT, jwt);
      }

      return resp;
    };

    if (window.navigator.locks) {
      return window.navigator.locks.request(env.LOCAL_STORAGE_KEY_JWT, fn);
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

  clearCache(): void {
    this.subjectEpisodesRatingsCache = {};
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
