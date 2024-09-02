import { Score } from "./definitions";
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
  public readonly entrypoint: string;
  public token: string | null;

  constructor(
    opts: {
      entrypoint: string;
      token: string | null;
    },
  ) {
    this.entrypoint = opts.entrypoint;
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
        { method: "PUT", body: JSON.stringify(bodyData) },
      );
    } else {
      return await this.fetch(
        "api/v1",
        `subjects/${opts.subjectID}/episodes/${opts.episodeID}/ratings/mine`,
        { method: "DELETE" },
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
      { method: "GET" },
    ).then((resp) =>
      this.subjectEpisodesRatingsCache[opts.subjectID] = unwrap(resp)
    );
  }

  async mustGetEpisodeRatings(): Promise<GetEpisodeRatingsResponseData> {
    const resp = await this.fetch(
      "api/v1",
      `subjects/${Global.subjectID}/episodes/${Global.episodeID}/ratings`,
      { method: "GET" },
    );

    return unwrap(resp);
  }

  async getMyEpisodeRating(): Promise<
    APIResponse<GetMyEpisodeRatingResponseData>
  > {
    return await this.fetch(
      "api/v1",
      `subjects/${Global.subjectID}/episodes/${Global.episodeID}/ratings/mine`,
      { method: "GET" },
    );
  }

  async changeUserEpisodeRatingVisibility(
    opts: { isVisible: boolean },
  ): Promise<APIResponse<ChangeUserEpisodeRatingVisibilityResponseData>> {
    return await this.fetch(
      "api/v1",
      `subjects/${Global.subjectID}/episodes/${Global.episodeID}/ratings/mine/is-visible`,
      { method: "PUT", body: JSON.stringify(opts.isVisible) },
    );
  }

  private async fetch<T>(
    group: "auth" | "api/v1",
    endpointPath: string,
    opts: {
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
      headers.set("Authorization", `Basic ${this.token}`);
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
    return join(join(this.entrypoint, group + "/"), endpointPath);
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
