import { Score } from "./definitions";
import Global from "./global";
import {
  APIErrorResponse,
  APIOkResponse,
  APIResponse,
  GetEpisodeRatingsResponseData,
  GetMyEpisodeRatingResponseData,
  GetSubjectEpisodesResponseData,
  RateEpisodeRequestData,
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

  async rateEpisode(
    opts: {
      userID: number;
      subjectID: number;
      episodeID: number;
      score: Score | null;
    },
  ): Promise<APIResponse<RateEpisodeResponseData>> {
    if (!this.token) return ["auth_required"];

    const bodyData: RateEpisodeRequestData = {
      claimed_user_id: opts.userID,
      subject_id: opts.subjectID,
      episode_id: opts.episodeID,
      score: opts.score,
    };

    return await this.fetch(
      "api/v0",
      ENDPOINT_PATHS.API.V0.RATE_EPISODE,
      {
        method: "POST",
        body: JSON.stringify(bodyData),
      },
    );
  }

  subjectEpisodesRatingsCache: {
    [subjectID: number]:
      | GetSubjectEpisodesResponseData
      | Promise<GetSubjectEpisodesResponseData>;
  } = {};

  async mustGetSubjectEpisodesRatings(opts: { subjectID: number }): Promise<
    GetSubjectEpisodesResponseData
  > {
    if (this.subjectEpisodesRatingsCache[opts.subjectID]) {
      return this.subjectEpisodesRatingsCache[opts.subjectID];
    }

    const searchParams = new URLSearchParams();
    if (Global.claimedUserID) {
      searchParams.set("claimed_user_id", String(Global.claimedUserID));
      searchParams.set("subject_id", String(opts.subjectID!));
    }

    return this.subjectEpisodesRatingsCache[opts.subjectID] = this.fetch(
      "api/v0",
      ENDPOINT_PATHS.API.V0.SUBJECT_EPISODES_RATINGS,
      { method: "GET", searchParams },
    ).then((resp) =>
      this.subjectEpisodesRatingsCache[opts.subjectID] = unwrap(resp)
    );
  }

  async mustGetEpisodeRatings(): Promise<GetEpisodeRatingsResponseData> {
    const searchParams = new URLSearchParams();
    if (Global.claimedUserID) {
      searchParams.set("claimed_user_id", String(Global.claimedUserID));
      searchParams.set("subject_id", String(Global.subjectID!));
      searchParams.set("episode_id", String(Global.episodeID!));
    }

    const resp = await this.fetch(
      "api/v0",
      ENDPOINT_PATHS.API.V0.EPISODE_RATINGS,
      {
        method: "GET",
        searchParams,
      },
    );

    return unwrap(resp);
  }

  async getMyEpisodeRating(): Promise<
    APIResponse<GetMyEpisodeRatingResponseData>
  > {
    const searchParams = new URLSearchParams();
    if (Global.claimedUserID) {
      searchParams.set("claimed_user_id", String(Global.claimedUserID));
      searchParams.set("subject_id", String(Global.subjectID!));
      searchParams.set("episode_id", String(Global.episodeID!));
    }

    return await this.fetch(
      "api/v0",
      ENDPOINT_PATHS.API.V0.MY_EPISODE_RATING,
      {
        method: "GET",
        searchParams,
      },
    );
  }

  async fetch<T>(
    group: "auth" | "api/v0" | "api/dev",
    endpointPath: string,
    opts: {
      method: "GET" | "POST";
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

    try {
      const resp = await fetch(url, {
        method: opts.method,
        headers,
        body: opts.body,
      });

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

  buildFullEndpoint(
    group: "auth" | "api/v0" | "api/dev",
    endpointPath: string,
  ): string {
    return join(join(this.entrypoint, group + "/"), endpointPath);
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
