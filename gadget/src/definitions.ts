export const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type Score = typeof scores[number];

export function describeScore(score: number) {
  return ([
    [9.5, "超神作"],
    [8.5, "神作"],
    [7.5, "力荐"],
    [6.5, "推荐"],
    [5.5, "还行"],
    [4.5, "不过不失"],
    [3.5, "较差"],
    [2.5, "差"],
    [1.5, "很差"],
  ] as const)
    .find(([min, _]) => score >= min)?.[1] ?? "不忍直视";
}
