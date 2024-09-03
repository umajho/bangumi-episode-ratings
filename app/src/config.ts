import { ReverseMap } from "./type-utils.ts";
import { EpisodeID, SubjectID, UserID } from "./types.ts";

const HARD_CODED = {
  CORS_ALLOWED_METHODS: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  CORS_ALLOWED_HEADERS: [
    "Authorization",
    "X-Gadget-Version",
    "X-Claimed-User-ID",
  ],

  PATH_API_REDEEM_TOKEN_COUPON: "/api/redeem_token_coupon",

  VALID_HOSTNAMES: ["bgm.tv", "bangumi.tv", "chii.in"],

  BGM_PATH_GADGET_CONFIRMATION: "/group/topic/404326",

  BGM_PATH_OAUTH_AUTHORIZE: "/oauth/authorize",
  BGM_PATH_OAUTH_ACCESS_TOKEN: "/oauth/access_token",

  BGM_API_PATH_V0_EPISODES: "/v0/episodes",
} as const;

const ENV = {
  ENTRYPOINT_URL: new URL(mustGetEnv("ENTRYPOINT_URL")),
  PORT: getEnvAndThen("PORT", (port) => Number(port)),

  BGM_APP_ID: mustGetEnv("BGM_APP_ID"),
  BGM_APP_SECRET: mustGetEnv("BGM_APP_SECRET"),

  USER_AGENT: mustGetEnv("USER_AGENT"),

  BGM_HOMEPAGE_URL: new URL(mustGetEnv("BGM_HOMEPAGE_URL")),
};
function mustGetEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`缺失环境变量 “${name}”！`);
  return value;
}
function getEnvAndThen<T>(name: string, mapFn: (value: string) => T): T | null {
  const value = Deno.env.get(name);
  if (value === undefined) return null;
  return mapFn(value);
}

class AppConfigManager {
  constructor(
    private readonly env: typeof ENV,
    private readonly _hardCoded: typeof HARD_CODED,
  ) {}

  get BGM_APP_ID() {
    return this.env.BGM_APP_ID;
  }
  get BGM_APP_SECRET() {
    return this.env.BGM_APP_SECRET;
  }

  get USER_AGENT() {
    return this.env.USER_AGENT;
  }
}

class BangumiConfigManager {
  constructor(
    private readonly env: typeof ENV,
    private readonly hardCoded: typeof HARD_CODED,
  ) {}

  get VALID_HOSTNAMES() {
    return this.hardCoded.VALID_HOSTNAMES;
  }

  validateHostname(
    hostname: string,
  ): (typeof this.VALID_HOSTNAMES)[number] | null {
    if ((this.VALID_HOSTNAMES as readonly string[]).includes(hostname)) {
      return hostname as (typeof this.VALID_HOSTNAMES)[number];
    } else {
      return null;
    }
  }

  #cacheOrigins: string[] | null = null;
  get ORIGINS(): string[] {
    return this.#cacheOrigins ??= this.VALID_HOSTNAMES.map((hostname) =>
      `https://${hostname}`
    );
  }

  get URL_HOMEPAGE() {
    return this.env.BGM_HOMEPAGE_URL;
  }

  get PATH_GADGET_CONFIRMATION() {
    return this.hardCoded.BGM_PATH_GADGET_CONFIRMATION;
  }

  buildURLOauthAuthorize(bangumiBaseURL: URL | string): URL {
    return join(bangumiBaseURL, this.hardCoded.BGM_PATH_OAUTH_AUTHORIZE);
  }

  get PATH_OAUTH_ACCESS_TOKEN() {
    return this.hardCoded.BGM_PATH_OAUTH_ACCESS_TOKEN;
  }

  get API_PATH_V0_EPISODES() {
    return this.hardCoded.BGM_API_PATH_V0_EPISODES;
  }
}

class SiteConfigManager {
  constructor(
    private readonly env: typeof ENV,
    private readonly hardCoded: typeof HARD_CODED,
    private readonly bangumi: BangumiConfigManager,
  ) {}

  get URL_ENTRYPOINT() {
    return this.env.ENTRYPOINT_URL;
  }
  get PORT() {
    return this.env.PORT;
  }

  get CORS_ORIGINS() {
    return this.bangumi.ORIGINS;
  }
  get CORS_ALLOWED_METHODS() {
    return this.hardCoded.CORS_ALLOWED_METHODS;
  }
  cloneCorsAllowedMethods() {
    return [...this.CORS_ALLOWED_METHODS];
  }
  isCorsAllowedMethod(method: string) {
    return (this.CORS_ALLOWED_METHODS as readonly string[]).includes(method);
  }
  get CORS_ALLOWED_HEADERS() {
    return this.hardCoded.CORS_ALLOWED_HEADERS;
  }
  cloneCorsAllowedHeaders() {
    return [...this.CORS_ALLOWED_HEADERS];
  }
  #cacheCorsAllowedHeaderSetLowered: Set<string> | null = null;
  get CORS_ALLOWED_HEADER_SET_LOWERED(): Set<string> {
    return this.#cacheCorsAllowedHeaderSetLowered ??= new Set(
      this.CORS_ALLOWED_HEADERS.map((header) => header.toLowerCase()),
    );
  }
  isCorsAllowedHeader(header: string) {
    return this.CORS_ALLOWED_HEADER_SET_LOWERED.has(header.toLowerCase());
  }

  buildURLAuthorizationCallback(callbackPath: string): URL {
    return join(join(this.URL_ENTRYPOINT, "auth/"), callbackPath);
  }
}

const KV_PREFIXES = (() => {
  const reversedKVPrefixes = {
    1: "users",
    2: "tokens",
    3: "token-coupons",
    4: "episode-infos",
    5: "user-subject-episode-rating-map",
    6: "subject-episode-score-votes",
    7: "subject-episode-score-public-voters",
  } as const;
  return Object.fromEntries(
    Object.entries(reversedKVPrefixes).map(([k, v]) => [v, Number(k)]),
  ) as ReverseMap<typeof reversedKVPrefixes>;
})();
const kvConfigManager = {
  buildKeyUser(userID: UserID) {
    return [KV_PREFIXES["users"], userID] as const;
  },
  buildKeyToken(token: string) {
    return [KV_PREFIXES["tokens"], token] as const;
  },
  buildKeyTokenCoupon(tokenCoupon: string) {
    return [KV_PREFIXES["token-coupons"], tokenCoupon] as const;
  },
  buildKeyEpisodeInfo(episodeID: EpisodeID) {
    return [KV_PREFIXES["episode-infos"], episodeID] as const;
  },
  buildKeyUserSubjectEpisodeRating(
    userID: UserID,
    subjectID: SubjectID,
    episodeID: EpisodeID,
  ) {
    return [
      KV_PREFIXES["user-subject-episode-rating-map"],
      userID,
      subjectID,
      episodeID,
    ] as const;
  },
  buildPrefixUserSubjectEpisodeRating(
    subKey: [userID: UserID, subjectID: SubjectID],
  ) {
    return [KV_PREFIXES["user-subject-episode-rating-map"], ...subKey] as const;
  },
  buildKeySubjectEpisodeScoreVotes(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
  ) {
    return [
      KV_PREFIXES["subject-episode-score-votes"],
      subjectID,
      episodeID,
      score,
    ] as const;
  },
  buildPrefixSubjectEpisodeScoreVotes(
    subKey:
      | [subjectID: SubjectID]
      | [subjectID: SubjectID, episodeID: EpisodeID],
  ) {
    return [KV_PREFIXES["subject-episode-score-votes"], ...subKey] as const;
  },
  buildKeySubjectEpisodeScorePublicVoters(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
    userID: UserID,
  ) {
    return [
      KV_PREFIXES["subject-episode-score-public-voters"],
      subjectID,
      episodeID,
      score,
      userID,
    ] as const;
  },
  buildPrefixSubjectEpisodeScorePublicVoters(
    subKey: [subjectID: SubjectID, episodeID: EpisodeID],
  ) {
    return [
      KV_PREFIXES["subject-episode-score-public-voters"],
      ...subKey,
    ] as const;
  },
};

class ConfigManager {
  readonly app: AppConfigManager;
  readonly bangumi: BangumiConfigManager;
  readonly site: SiteConfigManager;
  readonly kv: typeof kvConfigManager;

  constructor() {
    this.app = new AppConfigManager(ENV, HARD_CODED);
    this.bangumi = new BangumiConfigManager(ENV, HARD_CODED);
    this.site = new SiteConfigManager(ENV, HARD_CODED, this.bangumi);
    this.kv = kvConfigManager;
  }
}

const manager = new ConfigManager();
export default manager;

function join(base: string | URL, url: string): URL {
  return new URL(url, base);
}
