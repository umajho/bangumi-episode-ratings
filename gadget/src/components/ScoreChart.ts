import { Score, scores } from "../definitions";
import { VotesData } from "../models/VotesData";

export function renderScoreChart(
  el: JQuery<HTMLElement>,
  props: { votesData: VotesData },
) {
  const { votesData } = props;

  el = $(/*html*/ `
    <div id="ChartWarpper" class="chartWrapper" style="float: right; width: 218px;">
      <div class="chart_desc"><small class="grey"><span class="votes"></span> votes</small></div>
      <ul class="horizontalChart">
        <div class="tooltip fade top in" role="tooltip" style="top: -34px; transform: translateX(-50%);">
          <div class="tooltip-arrow" style="left: 50%;"></div>
          <div class="tooltip-inner"></div>
        </div>
      </ul>
    </div>
  `).replaceAll(el);

  $(el).find(".votes").text(votesData.totalVotes);

  const chartEl = el.find(".horizontalChart");
  const totalVotes = votesData.totalVotes;
  const votesOfMostVotedScore = votesData.votesOfMostVotedScore;
  for (const score of scores) {
    const votes = votesData.getScoreVotes(score);

    const barEl = $("<div />");
    chartEl.prepend(barEl);
    renderBar(barEl, {
      score,
      votes,
      totalVotes,
      votesOfMostVotedScore,
      updateTooltip,
    });
  }

  function updateTooltip(props: { score: Score | null }) {
    let tooltipEl = $(chartEl).find(".tooltip");

    if (props.score === null) {
      tooltipEl.css("display", "none");
      return;
    }

    tooltipEl.css("display", "block");
    const barEl = $(chartEl).find(`li`).eq(10 - props.score);
    const barElRelativeOffsetLeft = barEl.offset()!.left - el.offset()!.left;
    tooltipEl.css("left", `${barElRelativeOffsetLeft + barEl.width()! / 2}px`);

    let scoreVotes = votesData.getScoreVotes(props.score);
    const percentage = votesData.totalVotes
      ? (scoreVotes / votesData.totalVotes * 100)
      : 0;
    $(tooltipEl).find(".tooltip-inner").text(
      `${percentage.toFixed(2)}% (${scoreVotes}人)`,
    );
  }
  updateTooltip({ score: null });

  return el;
}

function renderBar(
  el: JQuery<HTMLElement>,
  props: {
    score: Score;
    votes: number;
    totalVotes: number;
    votesOfMostVotedScore: number;
    updateTooltip: (props: { score: Score | null }) => void;
  },
) {
  el = $(/*html*/ `
    <li><a class="textTip"><span class="label"></span><span class="count"></span></a></li>
  `).replaceAll(el);

  const percentage = (props.votes / props.totalVotes * 100).toFixed(2);
  $(el).find(".textTip").attr(
    "data-original-title",
    `${percentage}% (${props.votes}人)`,
  );

  $(el).find(".label").text(props.score);

  const height = (props.votes / props.votesOfMostVotedScore * 100).toFixed(2);
  $(el).find(".count").css("height", `${height}%`);
  $(el).find(".count").text(`(${props.votes})`);

  $(el)
    .on("mouseover", () => props.updateTooltip({ score: props.score }))
    .on("mouseout", () => props.updateTooltip({ score: null }));

  return el;
}
