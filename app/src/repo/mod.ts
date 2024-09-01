import { match, P } from "npm:ts-pattern";

import env from "../env.ts";
import {
  EpisodeID,
  EpisodeInfoData,
  SubjectID,
  TokenCouponEntryData,
  TokenEntryData,
  UserData,
  UserID,
  UserSubjectEpisodeRatingData,
} from "../types.ts";
import * as KVUtils from "./utils.ts";

export class Repo {
  #kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.#kv = kv;
  }

  static async open() {
    const kv = await Deno.openKv();
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
    const key = env.buildKVKeyUser(userID);
    return await this.#kv.get<UserData>(key);
  }

  async getTokenEntryResult(
    token: string,
  ): Promise<Deno.KvEntryMaybe<TokenEntryData>> {
    const key = env.buildKVKeyToken(token);
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
    const key = env.buildKVKeyTokenCoupon(tokenCoupon);
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
    const key = env.buildKVKeyEpisodeInfo(episodeID);
    return await this.#kv.get<EpisodeInfoData>(key);
  }
  async getEpisodeInfo(episodeID: EpisodeID): Promise<EpisodeInfoData | null> {
    return (await this.getEpisodeInfoResult(episodeID)).value;
  }
  async setEpisodeInfo(episodeID: EpisodeID, episodeInfo: EpisodeInfoData) {
    const key = env.buildKVKeyEpisodeInfo(episodeID);
    let isOk = false;
    while (!isOk) {
      const result = await this.#kv.set(key, episodeInfo);
      isOk = result.ok;
    }
  }

  async getUserEpisodeRatingResult(
    userID: UserID,
    subjectID: SubjectID,
    episodeID: EpisodeID,
  ): Promise<Deno.KvEntryMaybe<UserSubjectEpisodeRatingData>> {
    const key = //
      env.buildKVKeyUserSubjectEpisodeRating(userID, subjectID, episodeID);
    return (await this.#kv.get<UserSubjectEpisodeRatingData>(key));
  }

  async getAllUserSubjectEpisodesRatings(userID: UserID, subjectID: SubjectID) {
    const prefix = env
      .buildKVPrefixUserSubjectEpisodeRating([userID, subjectID]);

    const ratings: { [episodeID: number]: number } = {};
    for await (
      const result of this.#kv.list<UserSubjectEpisodeRatingData>({ prefix })
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
    const prefix = env.buildKVPrefixSubjectEpisodeScoreVotes //
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
    opts?: { limit?: number },
  ) {
    const limit = opts?.limit ?? 1000;

    const prefix = env.buildKVPrefixSubjectEpisodeScoreVotes([subjectID]);

    const votesByScoreBySubject: {
      [episodeID: EpisodeID]: { [score: number]: number } | null;
    } = {};
    let lastEpisodeID: EpisodeID | null = null;
    let count = 0;
    for await (const result of this.#kv.list({ prefix }, { limit })) {
      count++;

      const episodeID = result.key.at(-2) as EpisodeID;
      lastEpisodeID = episodeID;

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

    const isCertainThatEpisodesVotesAreIntegral = count < limit;
    if (
      !isCertainThatEpisodesVotesAreIntegral &&
      votesByScoreBySubject[lastEpisodeID!] &&
      !(10 in votesByScoreBySubject[lastEpisodeID!]!)
    ) {
      // `list` 返回的结果可能被截取了，靠最后的那一集的评分投票数据可能因此而不
      // 完整，故而删去。
      delete votesByScoreBySubject[lastEpisodeID!];
    }

    return { votesByScoreBySubject, isCertainThatEpisodesVotesAreIntegral };
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
        prefix: env.buildKVPrefixSubjectEpisodeScorePublicVoters(
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
    const key = env.buildKVKeyUser(userID);
    this.#tx = this.#tx
      .check(check)
      .set(key, user);
  }

  setTokenEntry(token: string, tokenEntry: TokenEntryData) {
    const key = env.buildKVKeyToken(token);
    this.#tx = this.#tx.set(key, tokenEntry);
  }
  deleteTokenEntry(token: string) {
    const key = env.buildKVKeyToken(token);
    this.#tx = this.#tx.delete(key);
  }

  setTokenCouponEntry(tokenCoupon: string, opts: {
    token: string;
    expiresInMs?: number;
  }) {
    opts.expiresInMs ??= 1000 * 10; // 10 秒。

    const key = env.buildKVKeyTokenCoupon(tokenCoupon);

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
    const key = env.buildKVKeyTokenCoupon(tokenCoupon);
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
      env.buildKVKeyUserSubjectEpisodeRating(userID, subjectID, episodeID);
    this.#tx = this.#tx
      .check(check)
      .set(key, rating);
  }

  increaseSubjectEpisodeScoreVotes(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
  ) {
    const key = env.buildKVKeySubjectEpisodeScoreVotes //
    (subjectID, episodeID, score);
    this.#tx = this.#tx.sum(key, 1n);
  }
  decreaseSubjectEpisodeScoreVotes(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
  ) {
    const key = env.buildKVKeySubjectEpisodeScoreVotes //
    (subjectID, episodeID, score);
    this.#tx = KVUtils.sumFreely(this.#tx, key, -1n);
  }

  setSubjectEpisodeScorePublicVoter(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
    voterUserID: UserID,
  ) {
    const key = env.buildKVKeySubjectEpisodeScorePublicVoters //
    (subjectID, episodeID, score, voterUserID);
    this.#tx = this.#tx.set(key, 1);
  }
  deleteSubjectEpisodeScorePublicVoter(
    subjectID: SubjectID,
    episodeID: EpisodeID,
    score: number,
    voterUserID: UserID,
  ) {
    const key = env.buildKVKeySubjectEpisodeScorePublicVoters //
    (subjectID, episodeID, score, voterUserID);
    this.#tx = this.#tx.delete(key);
  }
}
