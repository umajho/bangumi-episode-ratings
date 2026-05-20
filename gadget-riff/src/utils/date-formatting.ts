export function formatDate(date: Date, opts: { now: Date }): string {
  const nowDayNumber = calculateDayNumber(opts.now);

  const dayNumber = calculateDayNumber(date);

  if (dayNumber === nowDayNumber) return "今天";
  if (dayNumber === nowDayNumber - 1) return "昨天";

  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();

  return `${y}-${m}-${d}`;
}

export function formatDateToTime(date: Date): string {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
  const h = date.getHours(), min = date.getMinutes();
  const hStr = h < 10 ? `0${h}` : h;
  const minStr = min < 10 ? `0${min}` : min;

  return `${y}-${m}-${d} ${hStr}:${minStr}`;
}

export function formatDatesDifferences(dateA: Date, dateB: Date): string {
  const diff = dateB.getTime() - dateA.getTime();
  let suffix: string;
  if (diff < 0) {
    suffix = "后";
    [dateA, dateB] = [dateB, dateA];
  } else {
    suffix = "前";
  }

  const tsA = Math.floor(dateA.getTime() / 1000),
    tsB = Math.floor(dateB.getTime() / 1000);

  const secondsA = tsA % 60, secondsB = tsB % 60;
  let diffSeconds = secondsB - secondsA;

  const minutesA = Math.floor(tsA / 60) % 60,
    minutesB = Math.floor(tsB / 60) % 60;
  let diffMinutes = minutesB - minutesA;
  if (diffSeconds < 0) {
    diffMinutes--;
    diffSeconds += 60;
  }

  const hoursA = dateA.getHours(), hoursB = dateB.getHours();
  let diffHours = hoursB - hoursA;
  if (diffMinutes < 0) {
    diffHours--;
    diffMinutes += 60;
  }

  const daysA = dateA.getDate(), daysB = dateB.getDate();
  let diffDays = daysB - daysA;
  if (diffHours < 0) {
    diffDays--;
    diffHours += 24;
  }

  const monthsA = dateA.getMonth() + 1, monthsB = dateB.getMonth() + 1;
  let diffMonths = monthsB - monthsA;
  if (diffDays < 0) {
    diffMonths--;
    const daysInMonth = new Date(dateA.getFullYear(), dateA.getMonth() + 1, 0)
      .getDate();
    diffDays += daysInMonth;
  }

  const yearsA = dateA.getFullYear(), yearsB = dateB.getFullYear();
  let diffYears = yearsB - yearsA;
  if (diffMonths < 0) {
    diffYears--;
    const monthsInYear = 12;
    diffMonths += monthsInYear;
  }

  let ret: string;
  if (diffYears !== 0) {
    ret = `${diffYears}年${diffMonths > 0 ? `${diffMonths}月` : ""}`;
  } else if (diffMonths !== 0) {
    ret = `${diffMonths}月${diffDays > 0 ? `${diffDays}天` : ""}`;
  } else if (diffDays !== 0) {
    ret = `${diffDays}天${diffHours > 0 ? `${diffHours}时` : ""}`;
  } else if (diffHours !== 0) {
    ret = `${diffHours}小时${diffMinutes > 0 ? `${diffMinutes}分钟` : ""}`;
  } else if (diffMinutes !== 0) {
    ret = `${diffMinutes}分钟${diffSeconds > 0 ? `${diffSeconds}秒` : ""}`;
  } else {
    ret = `${diffSeconds}秒`;
  }

  return `${ret}${suffix}`;
}

const timezoneOffsetSeconds = ((new Date()).getTimezoneOffset() * 60) * 1000;
function calculateDayNumber(date: Date): number {
  const timestamp = Math.floor(date.getTime() / 1000);
  const localTimestamp = timestamp - timezoneOffsetSeconds;
  return Math.floor(localTimestamp / (24 * 60 * 60));
}
