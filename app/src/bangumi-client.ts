import env from "./env.ts";
import { EpisodeID } from "./types.ts";

type BangumiAPIResponse<T> =
  | ["ok", T]
  | ["error"];

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
      env.BGM_PATH_OAUTH_ACCESS_TOKEN,
      { method: "POST", body: searchParams },
    );
    return unwrap(data);
  }

  async getEpisode(episodeID: EpisodeID): Promise<GetEpisodeResponse | null> {
    const url = `${env.BGM_API_PATH_V0_EPISODES}/${episodeID}`;

    const data = await this.fetch<GetEpisodeResponse>("api", url, {
      method: "GET",
    });
    if (data[0] === "error") return null;
    return data[1];
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
    let domain = "bgm.tv" satisfies (typeof env.VALID_BGM_HOSTNAMES)[number];
    if (subDomain) {
      domain = `${subDomain}.${domain}`;
    }

    const url = new URL(path, `https://${domain}`);
    if (opts.searchParams) {
      url.search = opts.searchParams.toString();
    }

    const headers = new Headers();
    headers.append("User-Agent", env.USER_AGENT);

    const resp = await fetch(url.toString(), {
      method: opts.method,
      headers,
      ...(opts.body && { body: opts.body }),
    });

    if (!resp.ok) {
      console.warn("调用 bangumi API 失败", await resp.text());
      return ["error"];
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
