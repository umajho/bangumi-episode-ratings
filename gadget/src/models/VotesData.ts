import { Score, scores } from "../definitions";

export class VotesData {
  constructor(
    public readonly data: { [_ in Score]: number },
  ) {}

  private totalVotesCache: number | null = null;
  get totalVotes(): number {
    this.totalVotesCache ??= Object
      .values(this.data)
      .reduce((acc, cur) => acc + cur, 0);
    return this.totalVotesCache;
  }

  get averageScore(): number {
    let totalScore = 0;
    for (const score of scores) {
      totalScore += this.data[score] * score;
    }
    return totalScore / this.totalVotes;
  }

  private mostVotedScoreCache: Score | null = null;
  get mostVotedScore(): Score {
    if (this.mostVotedScoreCache) return this.mostVotedScoreCache;

    let mostVotedScore: Score = scores[0];
    for (const score of scores.slice(1)) {
      if (this.data[score] > this.data[mostVotedScore]) {
        mostVotedScore = score;
      }
    }

    return this.mostVotedScoreCache = mostVotedScore;
  }
  get votesOfMostVotedScore(): number {
    return this.data[this.mostVotedScore];
  }
}
