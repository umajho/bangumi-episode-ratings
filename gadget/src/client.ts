import { Score } from "./definitions";
import env from "./env";
import Global from "./global";
import {
  APIErrorResponse,
  APIOkResponse,
  APIResponse,
  ChangeUserEpisodeRatingVisibilityResponseData,
  GetEpisodeRatingsResponseData,
  GetMyEpisodeRatingResponseData,
  GetSubjectEpisodesResponseData,
  RateEpisodeRequestData__V1,
  RateEpisodeResponseData,
} from "./shared/dto";
import ENDPOINT_PATHS from "./shared/endpoint-paths";

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
    return url.toString();
  }

  async mustRedeemTokenCoupon(tokenCoupon: string): Promise<string | null> {
    const data = await this.fetch(
      "auth",
      ENDPOINT_PATHS.AUTH.REDEEM_TOKEN_COUPON,
      {
        tokenType: "basic",

        method: "POST",
        body: JSON.stringify({ tokenCoupon }),
      },
    );
    return unwrap(data);
  }

  async rateEpisode(
    opts: { subjectID: number; episodeID: number; score: Score | null },
  ): Promise<APIResponse<RateEpisodeResponseData>> {
    if (!this.token) return ["auth_required"];

    if (opts.score !== null) {
      const bodyData: RateEpisodeRequestData__V1 = { score: opts.score };

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
      | Promise<GetSubjectEpisodesResponseData>;
  } = {};

  hasCachedSubjectEpisodesRatings(subjectID: number): boolean {
    return (!!this.subjectEpisodesRatingsCache[subjectID]);
  }

  async mustGetSubjectEpisodesRatings(opts: { subjectID: number }): Promise<
    GetSubjectEpisodesResponseData
  > {
    if (this.subjectEpisodesRatingsCache[opts.subjectID]) {
      return this.subjectEpisodesRatingsCache[opts.subjectID];
    }

    return this.subjectEpisodesRatingsCache[opts.subjectID] = this.fetch(
      "api/v1",
      `subjects/${opts.subjectID}/episodes/ratings`,
      {
        tokenType: "jwt",

        method: "GET",
      },
    ).then((resp) =>
      this.subjectEpisodesRatingsCache[opts.subjectID] = unwrap(resp)
    );
  }

  async mustGetEpisodeRatings(): Promise<GetEpisodeRatingsResponseData> {
    const resp = await this.fetch(
      "api/v1",
      `subjects/${Global.subjectID}/episodes/${Global.episodeID}/ratings`,
      {
        tokenType: "jwt",

        method: "GET",
      },
    );

    return unwrap(resp);
  }

  async getMyEpisodeRating(): Promise<
    APIResponse<GetMyEpisodeRatingResponseData>
  > {
    return await this.fetch(
      "api/v1",
      `subjects/${Global.subjectID}/episodes/${Global.episodeID}/ratings/mine`,
      {
        tokenType: "jwt",

        method: "GET",
      },
    );
  }

  async changeUserEpisodeRatingVisibility(
    opts: { isVisible: boolean },
  ): Promise<APIResponse<ChangeUserEpisodeRatingVisibilityResponseData>> {
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

  private async fetch<T>(
    group: "auth" | "api/v1",
    endpointPath: string,
    opts: {
      tokenType: "basic" | "jwt";

      method: "GET" | "POST" | "PUT" | "DELETE";
      searchParams?: URLSearchParams;
      body?: string;
    },
  ): Promise<APIResponse<T>> {
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
      }, { shouldBypassCORSPreflight: group === "api/v1" }));

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
  }, opts: { shouldBypassCORSPreflight: boolean }): Request {
    if (opts.shouldBypassCORSPreflight) {
      url.pathname =
        `/${ENDPOINT_PATHS.CORS_PREFLIGHT_BYPASS}/${init.method}${url.pathname}`;
      const body = [
        Object.fromEntries(init.headers.entries()),
        init.body ?? null,
      ];
      return new Request(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
    } else {
      return new Request(url, init);
    }
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

  private async fetchJWT(): Promise<APIResponse<string>> {
    const fn = async (): Promise<APIResponse<string>> => {
      const localToken = localStorage.getItem(env.LOCAL_STORAGE_KEY_JWT);
      if (localToken && checkJWTExpiry(localToken) === "valid") {
        return ["ok", localToken];
      }

      const resp: APIResponse<string> = await this.fetch(
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

  clearCache(): void {
    this.subjectEpisodesRatingsCache = {};
  }
}

function join(base: string, url: string): string {
  return (new URL(url, base)).href;
}

function unwrap<T>(resp: APIOkResponse<T> | APIErrorResponse | unknown): T {
  if (!Array.isArray(resp) || (resp[0] !== "ok" && resp[0] !== "error")) {
    console.error("Unsupported response", resp);
    throw new Error(`Unsupported response: ${JSON.stringify(resp)}`);
  }

  if (resp[0] === "error") throw new Error(resp[2]);
  return resp[1];
}

function checkJWTExpiry(jwt: string): "expired" | "valid" {
  const decoded = JSON.parse(atob(jwt.split(".")[1]));
  const exp = decoded.exp;
  const now = Math.floor(Date.now() / 1000);
  return now > exp ? "expired" : "valid";
}
