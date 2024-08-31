import { match, P } from "npm:ts-pattern";

import env from "../env.ts";
import {
  EpisodeID,
  EpisodeInfoData,
  SubjectID,
  TokenData,
  UserID,
  UserSubjectEpisodeRatingData,
} from "../types.ts";
import * as KVUtils from "../kv-utils.ts";

export class Repo {
  #kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.#kv = kv;
  }

  static async open() {
    const kv = await Deno.openKv();
    return new Repo(kv);
  }

  async tx(
    block: (tx: RepoTransaction) => Promise<void> | void,
  ): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    const tx = new RepoTransaction(this.#kv.atomic());
    await block(tx);
    return await tx.__commit();
  }

  async getUserIDByToken(token: string | null): Promise<UserID | null> {
    if (!token) return null;

    const tokenResult = await this.#kv
      .get<TokenData>(env.buildKVKeyToken(token));
    if (!tokenResult.value) return null;

    return tokenResult.value.userID;
  }

  async getUserEx(
    tokenOrUserID: ["token", string | null] | ["userID", UserID],
    opts: { claimedUserID: UserID | null },
  ) {
    if (opts.claimedUserID === null) return null;

    return await match(tokenOrUserID)
      .returnType<Promise<UserID | null>>()
      .with(["userID", P.select()], (id) => Promise.resolve(id))
      .with(["token", P.select()], (token) => this.getUserIDByToken(token))
      .exhaustive();
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

  async getAllEpisodeVotesByScore(subjectID: SubjectID, episodeID: EpisodeID) {
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

  async getAllEpisodesVotesByScoreBySubjectEx(subjectID: SubjectID) {
    const prefix = env.buildKVPrefixSubjectEpisodeScoreVotes([subjectID]);

    const LIMIT = 1000;
    const votesByScoreBySubject: {
      [episodeID: EpisodeID]: { [score: number]: number } | null;
    } = {};
    let lastEpisodeID: EpisodeID | null = null;
    let count = 0;
    for await (const result of this.#kv.list({ prefix }, { limit: LIMIT })) {
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

    const isCertainThatEpisodesVotesAreIntegral = count < LIMIT;
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

  async getAllEpisodePublicVotersByScore(
    subjectID: SubjectID,
    episodeID: EpisodeID,
  ) {
    const votersByScore: { [score: number]: number[] } = {};
    for await (
      const result of this.#kv.list({
        prefix: env.buildKVPrefixSubjectEpisodeScorePublicVoters(
          [subjectID, episodeID],
        ),
      })
    ) {
      const score = result.key.at(-2) as number;
      const voterUserID = result.key.at(-1) as number;

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

  setUserSubjectEpisodeRating(
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