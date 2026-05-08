import {
  type EpisodeId,
  GADGET_VERSION,
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

  async patchEpisodeRating(
    opts: {
      subjectID: SubjectId;
      episodeID: EpisodeId;
      score?: Score | null;
      isVisible?: boolean;
    },
  ): Promise<APIResponseEx<RateEpisodeResponseData>> {
    const tokenResult = await this.fetchAccessTokenRequired();
    if (tokenResult[0] !== "ok") return tokenResult;

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
        token: tokenResult[1],

        method: "PATCH",
        body: JSON.stringify(bodyData),
      },
    );

    return resp;
  }

  async getSubjectEpisodesRatings(
    opts: { subjectID: SubjectId },
  ): Promise<APIResponse<GetSubjectEpisodesResponseData>> {
    const tokenResult = await this.fetchAccessTokenOptional();
    if (tokenResult[0] !== "ok") return tokenResult;

    return this.fetch<
      GetSubjectEpisodesResponseData
    >(
      "api/v1",
      `subjects/${opts.subjectID}/episodes/ratings`,
      {
        token: tokenResult[1],

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
    const tokenResult = await this.fetchAccessTokenOptional();
    if (tokenResult[0] !== "ok") return tokenResult;

    return await this.fetch(
      "api/v1",
      `subjects/${opts.subjectID}/episodes/${opts.episodeID}/ratings`,
      {
        token: tokenResult[1],

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
    const tokenResult = await this.fetchAccessTokenRequired();
    if (tokenResult[0] !== "ok") return tokenResult;

    const searchParams = new URLSearchParams();
    searchParams.set("offset", "" + ((opts.pageNumber - 1) * 10));
    searchParams.set("limit", "" + this.TIMELINE_ITEMS_PER_PAGE);

    return await this.fetch(
      "api/v1",
      `users/me/timeline/items`,
      {
        token: tokenResult[1],

        method: "GET",
        searchParams,
      },
    );
  }

  async deleteMyTimelineItem(
    opts: { timestampMs: number },
  ): Promise<APIResponseEx<null>> {
    const tokenResult = await this.fetchAccessTokenRequired();
    if (tokenResult[0] !== "ok") return tokenResult;

    return await this.fetch(
      "api/v1",
      `users/me/timeline/items/${opts.timestampMs}`,
      {
        token: tokenResult[1],

        method: "DELETE",
      },
    );
  }

  async downloadMyEpisodeRatingsData(): Promise<APIResponseEx<void>> {
    const tokenResult = await this.fetchAccessTokenRequired();
    if (tokenResult[0] !== "ok") return tokenResult;

    const resp = await this.fetch<any>( // TODO!!!: remove `any`.
      "api/v1",
      "users/me/episode-ratings-data-file",
      {
        token: tokenResult[1],

        method: "GET",
      },
    );

    if (resp[0] !== "ok") return resp;
    const [_, data] = resp;
    this.saveFile(data.content, { fileName: data.fileName });

    return ["ok", undefined];
  }

  private async fetch<T>(
    group: "api/v1",
    endpointPath: string,
    opts: {
      token: ["jwt", string] | null;

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
        case "jwt": {
          headers.set("Authorization", `Bearer ${opts.token[1]}`);
          break;
        }
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
        this.authStore.clear();
        return ["auth_required"];
      }

      return respJSON as APIResponse<T>;
    } catch (e) {
      const operation = `fetch \`${opts.method} ${url}\``;
      console.error(`${operation} 失败`, e);
      return ["error", "UNKNOWN", `${operation} 失败： ${e}`];
    }
  }

  async fetchAccessTokenRequired(): Promise<
    APIResponseEx<["jwt", string]>
  > {
    const jwt = await this.authStore.fetchAccessToken();
    if (jwt[0] === "ok") return ["ok", ["jwt", jwt[1]]];
    return jwt;
  }

  async fetchAccessTokenOptional(): Promise<
    APIResponse<["jwt", string] | null>
  > {
    const jwt = await this.authStore.fetchAccessToken();
    if (jwt[0] === "ok") return ["ok", ["jwt", jwt[1]]];
    if (jwt[0] === "auth_required") {
      return ["ok", null];
    }
    return jwt;
  }

  private buildRequest(url: URL, init: {
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    headers: Headers;
    body?: string;
  }): Request {
    return new Request(url, init);
  }

  private buildFullEndpoint(
    group: "api/v1",
    endpointPath: string,
  ): string {
    const entrypoint = ((): string => {
      switch (group) {
        case "api/v1":
          return this.entrypointStore.apiEntrypoint + "v1/";
        default:
          group satisfies never;
          throw new Error("unreachable");
      }
    })();

    return join(entrypoint, endpointPath);
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
