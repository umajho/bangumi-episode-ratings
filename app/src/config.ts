import { match, P } from "npm:ts-pattern";

import { ReverseMap } from "@/type-utils.ts";
import {
  APIRouteMode,
  AuthRouteMode,
  EpisodeID,
  SubjectID,
  UserID,
} from "@/types.ts";

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

  JWT_KEY_ALGORITHM: {
    FOR_DJWT: { alg: "ES256" },
    FOR_CRYPTO: { name: "ECDSA", namedCurve: "P-256" },
  },
} as const;

const AUTH_ROUTE_MODE = JSON
    .parse(mustGetEnv("AUTH_ROUTE_MODE")) as AuthRouteMode,
  API_ROUTE_MODE = JSON
    .parse(mustGetEnv("API_ROUTE_MODE")) as APIRouteMode;

const ENV = {
  KV_PATH: Deno.env.get("KV_PATH") ?? null,

  AUTH_ROUTE_MODE,
  API_ROUTE_MODE,

  ENTRYPOINT_URL: new URL(mustGetEnv("ENTRYPOINT_URL")),
  PORT: getEnvAndThen("PORT", (port) => Number(port)),

  BGM_APP_ID: mustGetEnv("BGM_APP_ID"),
  BGM_APP_SECRET: mustGetEnv("BGM_APP_SECRET"),

  USER_AGENT: mustGetEnv("USER_AGENT"),

  BGM_HOMEPAGE_URL: new URL(mustGetEnv("BGM_HOMEPAGE_URL")),

  JWT_SIGNING_KEY_JWK: getEnvAndThen("JWT_SIGNING_KEY_JWK", JSON.parse) as
    | JsonWebKey
    | null,
  JWT_VERIFYING_KEY_JWK: match(API_ROUTE_MODE)
    .with(
      ["normal"],
      () => JSON.parse(mustGetEnv("JWT_VERIFYING_KEY_JWK")) as JsonWebKey,
    )
    .with(P.union(["maintenance", P._], ["forward", P._]), () => null)
    .exhaustive(),
};
function mustGetEnv(name: string): string {
  {
    const value = getEnvByFile(name);
    if (value) return value;
  }

  const value = Deno.env.get(name);
  if (!value) throw new Error(`缺失环境变量 “${name}”！`);
  return value;
}
function getEnvAndThen<T>(name: string, mapFn: (value: string) => T): T | null {
  {
    const value = getEnvByFile(name);
    if (value) return mapFn(value);
  }

  const value = Deno.env.get(name);
  if (value === undefined) return null;
  return mapFn(value);
}
function getEnvByFile(name: string): string | null {
  const filePath = Deno.env.get(`${name}_FILE`);
  if (!filePath) return null;
  return Deno.readTextFileSync(filePath);
}

class AppConfigManager {
  constructor(
    private readonly env: typeof ENV,
    private readonly hardCoded: typeof HARD_CODED,
  ) {}

  get KV_PATH() {
    return this.env.KV_PATH;
  }

  get AUTH_ROUTE_MODE() {
    return this.env.AUTH_ROUTE_MODE;
  }
  get API_ROUTE_MODE() {
    return this.env.API_ROUTE_MODE;
  }

  get BGM_APP_ID() {
    return this.env.BGM_APP_ID;
  }
  get BGM_APP_SECRET() {
    return this.env.BGM_APP_SECRET;
  }

  get USER_AGENT() {
    return this.env.USER_AGENT;
  }

  get JWT_KEY_ALGORITHM_FOR_DJWT() {
    return this.hardCoded.JWT_KEY_ALGORITHM.FOR_DJWT;
  }

  #jwtSigningKeyCache: CryptoKey | Promise<CryptoKey> | null = null;
  getJwtSigningKey(): CryptoKey | Promise<CryptoKey> | null {
    if (this.#jwtSigningKeyCache) return this.#jwtSigningKeyCache;
    const jwk = this.env.JWT_SIGNING_KEY_JWK;
    if (!jwk) return null;
    return this.#jwtSigningKeyCache = crypto.subtle.importKey(
      "jwk",
      jwk,
      this.hardCoded.JWT_KEY_ALGORITHM.FOR_CRYPTO,
      false,
      ["sign"],
    ).then((key) => {
      this.#jwtSigningKeyCache = key;
      return key;
    });
  }

  #jwtVerifyingKeyCache: CryptoKey | Promise<CryptoKey> | null = null;
  /**
   * XXX: 仅应该在正常的 `/api/*` 中使用。
   */
  getJwtVerifyingKey(): CryptoKey | Promise<CryptoKey> {
    if (this.#jwtVerifyingKeyCache) return this.#jwtVerifyingKeyCache;
    const jwk = this.env.JWT_VERIFYING_KEY_JWK;
    // 除非写错，否则只有在 `API_ROUTE_MODE` 为 `"normal"` 时才会调用此方法。
    if (!jwk) throw new Error("unreachable!");
    return this.#jwtVerifyingKeyCache = crypto.subtle.importKey(
      "jwk",
      jwk,
      this.hardCoded.JWT_KEY_ALGORITHM.FOR_CRYPTO,
      false,
      ["verify"],
    ).then((key) => {
      this.#jwtVerifyingKeyCache = key;
      return key;
    });
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
  /**
   * 含义：
   * - `:u` -> User ID
   * - `:t` -> Token
   * - `:tc` -> Token Coupon
   * - `:s` -> Subject ID
   * - `:e` -> Episode ID
   * - `:sc` -> Score
   */
  const reversedKVPrefixes = {
    1: "users/:u", // 用户信息。
    2: "tokens/:t", // token 信息（对应于哪个用户）。
    3: "token-coupons/:tc", // token 兑换券信息（对应于哪个 token）。
    4: "episode-infos/:e", // 剧集信息（其属于哪个条目）。
    5: "ratings/:u/:s/:e", // 用户对剧集的评分信息。
    6: "vote-counts/:s/:e/:sc", // 剧集对应分数的评分数。
    // 剧集对应评分下评分公开者的标记。（若某名用户公开了对某个剧集的评分，其在此
    // 处对应值为 1。）
    7: "public-voter-marks/:s/:e/:sc/:u",
  } as const;
  return Object.fromEntries(
    Object.entries(reversedKVPrefixes).map(([k, v]) => [v, Number(k)]),
  ) as ReverseMap<typeof reversedKVPrefixes>;
})();
const kvConfigManager = {
  buildKeyUser(userID: UserID) {
    return [KV_PREFIXES["users/:u"], userID] as const;
  },
  buildKeyToken(token: string) {
    return [KV_PREFIXES["tokens/:t"], token] as const;
  },
  buildKeyTokenCoupon(tokenCoupon: string) {
    return [KV_PREFIXES["token-coupons/:tc"], tokenCoupon] as const;
  },
  buildKeyEpisodeInfo(episodeID: EpisodeID) {
    return [KV_PREFIXES["episode-infos/:e"], episodeID] as const;
  },
  buildKeyUserSubjectEpisodeRating(
    userID: UserID,
    subjectID: SubjectID,
    episodeID: EpisodeID,
  ) {
    return [
      KV_PREFIXES["ratings/:u/:s/:e"],
      userID,
      subjectID,
      episodeID,
    ] as const;
  },
  buildPrefixUserSubjectEpisodeRating(
    subKey: [userID: UserID, subjectID: SubjectID],
  ) {
    return [KV_PREFIXES["ratings/:u/:s/:e"], ...subKey] as const;
  },
  buildKeySubjectEpisodeScoreVotes(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
  ) {
    return [
      KV_PREFIXES["vote-counts/:s/:e/:sc"],
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
    return [KV_PREFIXES["vote-counts/:s/:e/:sc"], ...subKey] as const;
  },
  buildKeySubjectEpisodeScorePublicVoters(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
    userID: UserID,
  ) {
    return [
      KV_PREFIXES["public-voter-marks/:s/:e/:sc/:u"],
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
      KV_PREFIXES["public-voter-marks/:s/:e/:sc/:u"],
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
