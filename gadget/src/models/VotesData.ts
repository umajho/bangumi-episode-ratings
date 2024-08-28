import { Score, scores } from "../definitions";

export class VotesData {
  constructor(
    private readonly data: { [_ in Score]?: number },
  ) {}

  getClonedData(): { [_ in Score]?: number } {
    return { ...this.data };
  }

  getScoreVotes(score: Score): number {
    return this.data[score] ?? 0;
  }

  private totalVotesCache: number | null = null;
  get totalVotes(): number {
    if (this.totalVotesCache) return this.totalVotesCache;

    let totalVotes = 0;
    for (const score of scores) {
      totalVotes += this.getScoreVotes(score);
    }

    return this.totalVotesCache = totalVotes;
  }

  private averageScoreCache: number | null = null;
  get averageScore(): number {
    if (this.averageScoreCache) return this.averageScoreCache;

    let totalScore = 0;
    for (const score of scores) {
      totalScore += this.getScoreVotes(score) * score;
    }

    return this.averageScoreCache = totalScore / this.totalVotes;
  }

  private mostVotedScoreCache: Score | null = null;
  get mostVotedScore(): Score {
    if (this.mostVotedScoreCache) return this.mostVotedScoreCache;

    let mostVotedScore: Score = scores[0];
    for (const score of scores.slice(1)) {
      if (this.getScoreVotes(score) > this.getScoreVotes(mostVotedScore)) {
        mostVotedScore = score;
      }
    }

    return this.mostVotedScoreCache = mostVotedScore;
  }
  get votesOfMostVotedScore(): number {
    return this.getScoreVotes(this.mostVotedScore);
  }
}
