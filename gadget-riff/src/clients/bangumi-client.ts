type BangumiAPIResponse<T> =
  | ["ok", T]
  | ["error"];

interface EpisodeCacheEntry {
  name: string;
  sort: number;
}

export class BangumiClient {
  private episodeCache: Record<
    number,
    EpisodeCacheEntry | null | Promise<EpisodeCacheEntry | null>
  > = {};

  putEntryIntoEpisodeCache(
    episodeID: number,
    entry: EpisodeCacheEntry,
  ): void {
    this.episodeCache[episodeID] = entry;
  }

  async getEpisodeTitle(episodeID: number): Promise<string> {
    const cacheEntry = await (this.episodeCache[episodeID] ??= //
      this.getEpisode(episodeID)
        .then((episode) => {
          if (!episodeID) {
            return null;
          } else {
            return {
              name: episode.name,
              sort: episode.sort,
            };
          }
        }));

    if (!cacheEntry) return `获取失败（ID：${episodeID}）`;
    return `ep.${cacheEntry.sort} ${cacheEntry.name}`;
  }

  private episodeResponseCache: Record<number, any> = {};
  private async getEpisode(episodeID: number): Promise<any> {
    const path = `/v0/episodes/${episodeID}`;
    return this.episodeResponseCache[episodeID] ??= this
      .fetchAPI(path, { method: "GET" })
      .then((resp) => {
        if (resp[0] === "error") {
          return null;
        } else {
          return resp[1];
        }
      });
  }

  private async fetchAPI<T>(
    path: string,
    opts: {
      method: "GET" | "POST";
      searchParams?: URLSearchParams;
      body?: string | URLSearchParams;
    },
  ): Promise<BangumiAPIResponse<T>> {
    const url = new URL(path, "https://api.bgm.tv");
    if (opts.searchParams) {
      url.search = opts.searchParams.toString();
    }

    const resp = await fetch(url.toString(), {
      method: opts.method,
      ...(opts.body && { body: opts.body }),
    });

    if (!resp.ok) {
      console.warn("调用 bangumi API 失败", await resp.text());
      return ["error"];
    }

    return ["ok", await resp.json()];
  }
}
