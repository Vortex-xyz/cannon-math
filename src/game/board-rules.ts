export type ScoreSnap = {
  user_id: string;
  name: string;
  score: number;
  week_id: string;
};

function maxOther(rows: ScoreSnap[], userId: string) {
  let max = 0;
  for (const row of rows) {
    if (row.user_id !== userId && row.score > max) max = row.score;
  }
  return max;
}

/** This week's scores, plus carried crowns nobody has beaten yet. */
export function visibleBoard(weekly: ScoreSnap[], legends: ScoreSnap[]): ScoreSnap[] {
  const map = new Map<string, ScoreSnap>();
  for (const legend of legends) {
    if (legend.score <= 0) continue;
    if (legend.score >= maxOther(weekly, legend.user_id)) map.set(legend.user_id, legend);
  }
  for (const row of weekly) {
    if (row.score <= 0) continue;
    const prev = map.get(row.user_id);
    if (!prev || row.score > prev.score) map.set(row.user_id, row);
  }
  return [...map.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Top 3 of the week that just ended. Empty input keeps the caller from wiping crowns. */
export function freezeTop(weekly: ScoreSnap[], legends: ScoreSnap[]): ScoreSnap[] {
  return visibleBoard(weekly, legends).slice(0, 3);
}
