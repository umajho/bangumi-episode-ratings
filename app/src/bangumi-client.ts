import * as log from "@std/log";

import config from "@/config.ts";
import { EpisodeID } from "@/types.ts";

type BangumiAPIResponse<T> =
  | ["ok", T]
  | ["error", { userFacingMessage?: string }];

type postToGetAccessTokenResponse = {
  user_id: string;
};

type GetEpisodeResponse = {
  subject_id: number;
};

export class BangumiClient {
  async postToGetAccessToken(opts: {
    clientID: string;
    clientSecret: string;
    code: string;
    redirectURI: string;
  }): Promise<postToGetAccessTokenResponse> {
    const searchParams = new URLSearchParams();
    searchParams.append("grant_type", "authorization_code");
    searchParams.append("client_id", opts.clientID);
    searchParams.append("client_secret", opts.clientSecret);
    searchParams.append("code", opts.code);
    searchParams.append("redirect_uri", opts.redirectURI);

    const data = await this.fetch<postToGetAccessTokenResponse>(
      null,
      config.bangumi.PATH_OAUTH_ACCESS_TOKEN,
      { method: "POST", body: searchParams },
    );
    return unwrap(data);
  }

  async getEpisode(
    episodeID: EpisodeID,
  ): Promise<BangumiAPIResponse<GetEpisodeResponse>> {
    const url = `${config.bangumi.API_PATH_V0_EPISODES}/${episodeID}`;

    return await this.fetch<GetEpisodeResponse>("api", url, {
      method: "GET",
    });
  }

  async fetch<T>(
    subDomain: "api" | null,
    path: string,
    opts: {
      method: "GET" | "POST";
      searchParams?: URLSearchParams;
      body?: string | URLSearchParams;
    },
  ): Promise<BangumiAPIResponse<T>> {
    // NOTE: 必须用 “bgm.tv”，因为只有 “api.bgm.tv” 能用。
    let domain =
      "bgm.tv" satisfies (typeof config.bangumi.VALID_HOSTNAMES)[number];
    if (subDomain) {
      domain = `${subDomain}.${domain}`;
    }

    const url = new URL(path, `https://${domain}`);
    if (opts.searchParams) {
      url.search = opts.searchParams.toString();
    }

    const headers = new Headers();
    headers.append("User-Agent", config.app.USER_AGENT);

    const resp = await fetch(url.toString(), {
      method: opts.method,
      headers,
      ...(opts.body && { body: opts.body }),
    });

    if (!resp.ok) {
      let userFacingMessage: string | undefined;
      if (resp.status >= 500 && resp.status < 600) {
        userFacingMessage =
          `目前 Bangumi 官方 API 服务器似乎不可用，状态码：${resp.status}`;
      }
      log.warn("调用 bangumi API 失败", {
        statusCode: resp.status,
        text: await resp.text(),
        ...(userFacingMessage && { userFacingMessage }),
      });
      return ["error", {
        ...(userFacingMessage && { userFacingMessage }),
      }];
    }

    return ["ok", await resp.json()];
  }
}

function unwrap<T>(resp: BangumiAPIResponse<T>): T {
  if (resp[0] === "error") {
    throw new Error('TODO: BangumiClient: `resp[0] === "error"`');
  }
  return resp[1];
}
