import type { EpisodeId, SubjectId } from "../definitions";

type BangumiAPIResponse<T> =
  | ["ok", T]
  | ["error"];

export interface SubjectCacheEntry {
  name: string;
  nameCn?: string;
  eps: number | null;
}

interface EpisodeCacheEntry {
  name: string;
  sort: number;
}

export class BangumiClient {
  private subjectCache: Record<
    number,
    SubjectCacheEntry | null | Promise<SubjectCacheEntry | null>
  > = {};
  private episodeCache: Record<
    EpisodeId,
    EpisodeCacheEntry | null | Promise<EpisodeCacheEntry | null>
  > = {};

  putEntryIntoSubjectCache(
    subjectID: number,
    entry: SubjectCacheEntry,
  ): void {
    this.subjectCache[subjectID] = entry;
  }
  putEntryIntoEpisodeCache(
    episodeID: EpisodeId,
    entry: EpisodeCacheEntry,
  ): void {
    this.episodeCache[episodeID] = entry;
  }

  private subjectEntryCache: Record<
    SubjectId,
    Promise<SubjectCacheEntry | null>
  > = {};
  async getSubjectEntry(
    subjectID: SubjectId,
  ): Promise<SubjectCacheEntry | null> {
    const path = `/v0/subjects/${subjectID}`;
    return this.subjectEntryCache[subjectID] ??= this
      .fetchAPI(path, { method: "GET" })
      .then((resp) => {
        if (resp[0] === "error") {
          return null;
        } else {
          const data = resp[1] as any;
          return {
            name: data.name,
            ...(data.name_cn ? { nameCn: data.name_cn } : {}),
            eps: data.eps || null,
          };
        }
      });
  }

  async getEpisodeTitle(episodeID: EpisodeId): Promise<string> {
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

  private episodeResponseCache: Record<EpisodeId, any> = {};
  private async getEpisode(episodeID: EpisodeId): Promise<any> {
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
