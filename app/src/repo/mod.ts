import { match, P } from "npm:ts-pattern";

import {
  EpisodeID,
  EpisodeInfoData,
  SubjectID,
  TokenCouponEntryData,
  TokenEntryData,
  UserData,
  UserID,
  UserSubjectEpisodeRatingData,
  UserTimelineItem,
} from "@/types.ts";

import * as KVUtils from "./utils.ts";
import * as kvPrefixes from "./kv-prefixes.ts";

export class Repo {
  #kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.#kv = kv;
  }

  static async open(path?: string) {
    const kv = await Deno.openKv(path);
    return new Repo(kv);
  }

  static async __openForTest() {
    const kv = await Deno.openKv(":memory:");
    return new Repo(kv);
  }

  __closeForTest() {
    this.#kv.close();
  }

  async tx(
    block: (tx: RepoTransaction) => Promise<void> | void,
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    const tx = new RepoTransaction(this.#kv.atomic());
    await block(tx);
    return await tx.__commit();
  }

  async getUserResult(userID: UserID): Promise<Deno.KvEntryMaybe<UserData>> {
    const key = kvPrefixes.buildKeyUser(userID);
    return await this.#kv.get<UserData>(key);
  }

  async getTokenEntryResult(
    token: string,
  ): Promise<Deno.KvEntryMaybe<TokenEntryData>> {
    const key = kvPrefixes.buildKeyToken(token);
    return await this.#kv.get<TokenEntryData>(key);
  }
  async getTokenEntry(token: string): Promise<TokenEntryData | null> {
    return (await this.getTokenEntryResult(token)).value;
  }
  async getUserIDByToken(token: string | null): Promise<UserID | null> {
    if (!token) return null;
    return (await this.getTokenEntry(token))?.userID ?? null;
  }
  /**
   * TODO: 在传入 token 且 token 对应的实际的用户 ID 与 `opts.claimedUserID` 不
   * 一致时，清理掉 token。
   */
  async getUserIDEx(
    tokenOrUserID: ["token", string | null] | ["userID", UserID],
    opts: { claimedUserID: UserID | null },
  ) {
    if (opts.claimedUserID === null) return null;

    const userID = await match(tokenOrUserID)
      .returnType<Promise<UserID | null>>()
      .with(["userID", P.select()], (id) => Promise.resolve(id))
      .with(["token", P.select()], (token) => this.getUserIDByToken(token))
      .exhaustive();

    if (userID !== opts.claimedUserID) return null;
    return userID;
  }

  async __getTokenCouponEntryResult(
    tokenCoupon: string,
  ): Promise<Deno.KvEntryMaybe<TokenCouponEntryData>> {
    const key = kvPrefixes.buildKeyTokenCoupon(tokenCoupon);
    return await this.#kv.get<TokenCouponEntryData>(key);
  }
  async popTokenCouponEntryToken(tokenCoupon: string): Promise<string | null> {
    let isOk = false;
    let token!: string | null;
    while (!isOk) {
      token = null;
      const tokenCouponEntryResult = await this
        .__getTokenCouponEntryResult(tokenCoupon);
      const tokenCouponEntry = tokenCouponEntryResult.value;
      if (!tokenCouponEntry) break;
      if (Date.now() <= tokenCouponEntry.expiry) {
        token = tokenCouponEntry.token;
      }

      const result = await this.tx((tx) => {
        tx.deleteTokenCouponEntry(tokenCoupon, tokenCouponEntryResult);
      });
      isOk = result.ok;
    }

    return token;
  }

  async getEpisodeInfoResult(
    episodeID: EpisodeID,
  ): Promise<Deno.KvEntryMaybe<EpisodeInfoData>> {
    const key = kvPrefixes.buildKeyEpisodeInfo(episodeID);
    return await this.#kv.get<EpisodeInfoData>(key);
  }
  async getEpisodeInfo(episodeID: EpisodeID): Promise<EpisodeInfoData | null> {
    return (await this.getEpisodeInfoResult(episodeID)).value;
  }
  async setEpisodeInfo(episodeID: EpisodeID, episodeInfo: EpisodeInfoData) {
    const key = kvPrefixes.buildKeyEpisodeInfo(episodeID);
    let isOk = false;
    while (!isOk) {
      const result = await this.#kv.set(key, episodeInfo);
      isOk = result.ok;
    }
  }

  /**
   * XXX: 由于 Deno KV 的限制，`limit` 不应大于 10。
   */
  async getManyEpisodeInfos(
    episodeIDs: Set<EpisodeID>,
  ): Promise<Record<EpisodeID, EpisodeInfoData>> {
    const keys: (ReturnType<typeof kvPrefixes.buildKeyEpisodeInfo>)[] = [];
    for (const episodeID of episodeIDs) {
      keys.push(kvPrefixes.buildKeyEpisodeInfo(episodeID));
    }

    const ret: Record<EpisodeID, EpisodeInfoData> = {};
    for (
      const result of await this.#kv.getMany(keys, { consistency: "eventual" })
    ) {
      const episodeID = kvPrefixes
        // deno-lint-ignore no-explicit-any
        .extractEpisodeIDFromKeyEpisodeInfo(result.key as any);
      if (result.value) {
        ret[episodeID] = result.value as EpisodeInfoData;
      }
    }

    return ret;
  }

  async getUserEpisodeRatingResult(
    userID: UserID,
    subjectID: SubjectID,
    episodeID: EpisodeID,
  ): Promise<Deno.KvEntryMaybe<UserSubjectEpisodeRatingData>> {
    const key = //
      kvPrefixes.buildKeyUserSubjectEpisodeRating(userID, subjectID, episodeID);
    return (await this.#kv.get<UserSubjectEpisodeRatingData>(key));
  }

  async getUserEpisodesRatingsUnderSubject(
    userID: UserID,
    subjectID: SubjectID,
  ) {
    const prefix = kvPrefixes
      .buildPrefixUserSubjectEpisodeRating([userID, subjectID]);

    const ratings: { [episodeID: number]: number } = {};
    for await (
      const result of this.#kv.list<UserSubjectEpisodeRatingData>({ prefix }, {
        batchSize: 1000,
      })
    ) {
      const episodeID = result.key.at(-1) as number;
      if (result.value.score !== null) {
        ratings[episodeID] = result.value.score;
      }
    }

    return ratings;
  }

  async getUserAllEpisodesRatings(userID: UserID) {
    const prefix = kvPrefixes.buildPrefixUserSubjectEpisodeRating([userID]);

    const ratings: { [episodeID: number]: number } = {};
    for await (
      const result of this.#kv.list<UserSubjectEpisodeRatingData>({ prefix }, {
        batchSize: 1000,
      })
    ) {
      const episodeID = result.key.at(-1) as number;
      if (result.value.score !== null) {
        ratings[episodeID] = result.value.score;
      }
    }

    return ratings;
  }

  /**
   * 获取指定章节的评分，并以评分分组。
   */
  async getAllEpisodeVotesGroupedByScore(
    subjectID: SubjectID,
    episodeID: EpisodeID,
  ) {
    const prefix = kvPrefixes.buildPrefixSubjectEpisodeScoreVotes //
    ([subjectID, episodeID]);

    const votes: { [score: number]: number } = {};
    for await (const result of this.#kv.list({ prefix })) {
      const score = result.key.at(-1) as number;

      const scoreVotes = result.value as Deno.KvU64;
      if (scoreVotes.value) {
        votes[score] = Number(scoreVotes.value);
      }
    }

    return votes;
  }

  /**
   * 获取指定条目中各个章节的评分，并以章节和评分分组。
   */
  async getAllEpisodesVotesInSubjectGroupedByScoreAndEpisodeEx(
    subjectID: SubjectID,
  ) {
    const prefix = kvPrefixes.buildPrefixSubjectEpisodeScoreVotes([subjectID]);

    const votesByScoreBySubject: {
      [episodeID: EpisodeID]: { [score: number]: number } | null;
    } = {};
    let count = 0;
    for await (const result of this.#kv.list({ prefix }, { batchSize: 1000 })) {
      count++;

      const episodeID = result.key.at(-2) as EpisodeID;
      const score = result.key.at(-1) as number;

      const scoreVotes = result.value as Deno.KvU64;
      if (scoreVotes.value) {
        const votes = votesByScoreBySubject[episodeID] ??
          (votesByScoreBySubject[episodeID] = {});
        votes[score] = Number(scoreVotes.value);
      } else if (!votesByScoreBySubject[episodeID]) {
        votesByScoreBySubject[episodeID] = null;
      }
    }

    return { votesByScoreBySubject };
  }

  /**
   * 获取指定章节中选择公开了自己的评分的用户，并以这些用户所评的分分组。
   */
  async getAllEpisodePublicVotersGroupedByScore(
    subjectID: SubjectID,
    episodeID: EpisodeID,
  ) {
    const votersByScore: { [score: number]: UserID[] } = {};
    for await (
      const result of this.#kv.list({
        prefix: kvPrefixes.buildPrefixSubjectEpisodeScorePublicVoters(
          [subjectID, episodeID],
        ),
      })
    ) {
      const score = result.key.at(-2) as number;
      const voterUserID = result.key.at(-1) as UserID;

      const voters = votersByScore[score] ?? (votersByScore[score] = []);
      voters.push(voterUserID);
    }

    return votersByScore;
  }

  /**
   * 获取指定用户的时间线 items。顺序从新到旧。
   *
   * XXX: `offset` 的效率很差。
   */
  async getUserTimelineItems(
    userID: UserID,
    opts?: { offset?: number; limit?: number },
  ) {
    let i = -1;
    const items: [timestampMs: number, ...rest: UserTimelineItem][] = [];
    for await (
      const result of this.#kv.list<UserTimelineItem>(
        { prefix: kvPrefixes.buildPrefixUserTimelineItem([userID]) },
        {
          reverse: true,
          ...(opts?.limit && { limit: opts.limit + (opts.offset ?? 0) }),
        },
      )
    ) {
      i++;
      if (opts?.offset && i < opts.offset) continue;

      items.push([result.key.at(-1) as number, ...result.value]);
    }

    return items;
  }
}

export class RepoTransaction {
  #tx: Deno.AtomicOperation;

  constructor(tx: Deno.AtomicOperation) {
    this.#tx = tx;
  }

  async __commit(): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    return await this.#tx.commit();
  }

  check(...checks: Deno.AtomicCheck[]) {
    this.#tx = this.#tx.check(...checks);
  }

  setUser(userID: UserID, user: UserData, check: Deno.KvEntryMaybe<UserData>) {
    const key = kvPrefixes.buildKeyUser(userID);
    this.#tx = this.#tx
      .check(check)
      .set(key, user);
  }

  setTokenEntry(token: string, tokenEntry: TokenEntryData) {
    const key = kvPrefixes.buildKeyToken(token);
    this.#tx = this.#tx.set(key, tokenEntry);
  }
  deleteTokenEntry(token: string) {
    const key = kvPrefixes.buildKeyToken(token);
    this.#tx = this.#tx.delete(key);
  }

  setTokenCouponEntry(tokenCoupon: string, opts: {
    token: string;
    expiresInMs?: number;
  }) {
    opts.expiresInMs ??= 1000 * 10; // 10 秒。

    const key = kvPrefixes.buildKeyTokenCoupon(tokenCoupon);

    const data: TokenCouponEntryData = {
      token: opts.token,
      expiry: Date.now() + opts.expiresInMs,
    };
    this.#tx = this.#tx.set(key, data, { expireIn: opts.expiresInMs });
  }
  deleteTokenCouponEntry(
    tokenCoupon: string,
    check: Deno.KvEntryMaybe<TokenCouponEntryData>,
  ) {
    const key = kvPrefixes.buildKeyTokenCoupon(tokenCoupon);
    this.#tx = this.#tx
      .check(check)
      .delete(key);
  }

  setUserEpisodeRating(
    userID: UserID,
    subjectID: SubjectID,
    episodeID: EpisodeID,
    rating: UserSubjectEpisodeRatingData,
    check: Deno.KvEntryMaybe<UserSubjectEpisodeRatingData>,
  ) {
    const key = //
      kvPrefixes.buildKeyUserSubjectEpisodeRating(userID, subjectID, episodeID);
    this.#tx = this.#tx
      .check(check)
      .set(key, rating);
  }

  increaseSubjectEpisodeScoreVotes(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
  ) {
    const key = kvPrefixes.buildKeySubjectEpisodeScoreVotes //
    (subjectID, episodeID, score);
    this.#tx = this.#tx.sum(key, 1n);
  }
  decreaseSubjectEpisodeScoreVotes(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
  ) {
    const key = kvPrefixes.buildKeySubjectEpisodeScoreVotes //
    (subjectID, episodeID, score);
    this.#tx = KVUtils.sumFreely(this.#tx, key, -1n);
  }

  setSubjectEpisodeScorePublicVoter(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
    voterUserID: UserID,
  ) {
    const key = kvPrefixes.buildKeySubjectEpisodeScorePublicVoters //
    (subjectID, episodeID, score, voterUserID);
    this.#tx = this.#tx.set(key, 1);
  }
  deleteSubjectEpisodeScorePublicVoter(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
    voterUserID: UserID,
  ) {
    const key = kvPrefixes.buildKeySubjectEpisodeScorePublicVoters //
    (subjectID, episodeID, score, voterUserID);
    this.#tx = this.#tx.delete(key);
  }

  /**
   * 插入一项用户时间线 item。
   *
   * 只有在 key 对应的位置原先不存在值时成功。
   */
  insertUserTimelineItem(
    userID: UserID,
    timestampMs: number,
    item: UserTimelineItem,
  ) {
    const key = kvPrefixes.buildKeyUserTimelineItem(userID, timestampMs);
    this.#tx = this.#tx
      .check({ key, versionstamp: null })
      .set(key, item);
  }
}
