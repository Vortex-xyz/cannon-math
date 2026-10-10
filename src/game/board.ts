import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { freezeTop, visibleBoard, type ScoreSnap } from "./board-rules";
import { isoWeekId, isPilotName, isPlayerId, makePilotName, nextMondayUtc } from "./names";

export type BoardEntry = {
  rank: number;
  playerId: string;
  name: string;
  score: number;
  held: boolean;
};

export type BoardPayload = {
  weekId: string;
  resetsOn: string;
  entries: BoardEntry[];
  crowns: BoardEntry[];
  you: BoardEntry | null;
};

type ScoreRow = { user_id: string; name: string; score: number; week_id: string };

const playerIdSchema = z.string().regex(/^[a-f0-9]{32}$/);

const identityInput = z.object({
  playerId: playerIdSchema,
  name: z.string().min(3).max(32),
});

const listInput = z.object({
  playerId: playerIdSchema.optional(),
});

const scoreInput = identityInput.extend({
  score: z.number().int().min(0).max(99_999_999),
});

function cleanName(raw: string, fallbackId: string) {
  return isPilotName(raw) ? raw : makePilotName(fallbackId);
}

async function rememberPilot(
  sql: Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>,
  playerId: string,
  name: string,
) {
  const clean = cleanName(name, playerId);
  const existing = await sql<{ name: string }>`select name from pilots where user_id = ${playerId}`;
  if (existing[0]?.name) return existing[0].name;
  await sql`
    insert into pilots (user_id, name) values (${playerId}, ${clean})
    on conflict (user_id) do nothing
  `;
  const again = await sql<{ name: string }>`select name from pilots where user_id = ${playerId}`;
  return again[0]?.name ?? clean;
}

async function replaceCrowns(
  sql: Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>,
  top: ScoreSnap[],
) {
  if (top.length === 0) return;
  for (const row of top) {
    await sql`
      insert into legends (user_id, name, score, week_id)
      values (${row.user_id}, ${row.name}, ${row.score}, ${row.week_id})
      on conflict (user_id) do update
        set name = excluded.name,
            score = excluded.score,
            week_id = excluded.week_id
    `;
  }
  const keep = top.map((row) => row.user_id);
  if (keep.length === 1) {
    await sql`delete from legends where user_id <> ${keep[0]}`;
  } else if (keep.length === 2) {
    await sql`delete from legends where user_id <> ${keep[0]} and user_id <> ${keep[1]}`;
  } else {
    await sql`delete from legends where user_id <> ${keep[0]} and user_id <> ${keep[1]} and user_id <> ${keep[2]}`;
  }
}

function snaps(rows: ScoreRow[]): ScoreSnap[] {
  return rows.map((row) => ({
    user_id: row.user_id,
    name: row.name,
    score: Number(row.score),
    week_id: row.week_id,
  }));
}

async function ensureWeek(
  sql: Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>,
  week: string,
) {
  const meta = await sql<{ value: string }>`select value from board_meta where key = 'active_week'`;
  const active = meta[0]?.value;
  if (!active) {
    await sql`
      insert into board_meta (key, value) values ('active_week', ${week})
      on conflict (key) do nothing
    `;
    return;
  }
  if (active === week) return;

  const prevScores = await sql<ScoreRow>`
    select user_id, name, score::int as score, week_id
    from weekly_scores
    where week_id = ${active}
    order by score desc
    limit 50
  `;
  const legends = await sql<ScoreRow>`
    select user_id, name, score::int as score, week_id
    from legends
  `;
  await replaceCrowns(sql, freezeTop(snaps(prevScores), snaps(legends)));
  await sql`
    update board_meta set value = ${week}
    where key = 'active_week' and value = ${active}
  `;
}

async function readBoard(
  sql: Awaited<ReturnType<(typeof import("@/lib/db"))["getSql"]>>,
  week: string,
  youId?: string,
): Promise<BoardPayload> {
  await ensureWeek(sql, week);

  const crowns = snaps(
    await sql<ScoreRow>`
      select user_id, name, score::int as score, week_id
      from legends
      order by score desc
      limit 3
    `,
  );

  const weekly = snaps(
    await sql<ScoreRow>`
      select user_id, name, score::int as score, week_id
      from weekly_scores
      where week_id = ${week}
      order by score desc
      limit 50
    `,
  );

  const merged = visibleBoard(weekly, crowns);
  const entries: BoardEntry[] = merged.slice(0, 50).map((row, i) => ({
    rank: i + 1,
    playerId: row.user_id,
    name: row.name,
    score: row.score,
    held: row.week_id !== week,
  }));

  const crownEntries: BoardEntry[] = entries.filter((row) => row.held).slice(0, 3);

  let you: BoardEntry | null = youId ? (entries.find((e) => e.playerId === youId) ?? null) : null;
  if (youId && !you) {
    const idx = merged.findIndex((row) => row.user_id === youId);
    if (idx >= 0) {
      const mine = merged[idx];
      you = {
        rank: idx + 1,
        playerId: youId,
        name: mine.name,
        score: mine.score,
        held: mine.week_id !== week,
      };
    }
  }

  return {
    weekId: week,
    resetsOn: nextMondayUtc().toISOString().slice(0, 10),
    entries,
    crowns: crownEntries,
    you,
  };
}

export const claimPilot = createServerFn({ method: "POST" })
  .validator(identityInput)
  .handler(async ({ data }) => {
    if (!isPlayerId(data.playerId)) return { name: cleanName(data.name, data.playerId) };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const name = await rememberPilot(sql, data.playerId, data.name);
    return { name };
  });

export const listBoard = createServerFn({ method: "POST" })
  .validator(listInput)
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const week = isoWeekId();
    const youId = data.playerId && isPlayerId(data.playerId) ? data.playerId : undefined;
    return readBoard(sql, week, youId);
  });

export const postScore = createServerFn({ method: "POST" })
  .validator(scoreInput)
  .handler(async ({ data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const week = isoWeekId();
    await ensureWeek(sql, week);
    const playerId = data.playerId;
    const name = await rememberPilot(sql, playerId, data.name);
    const score = Math.floor(data.score);
    if (score > 0) {
      await sql`
        insert into weekly_scores (user_id, week_id, score, name, updated_at)
        values (${playerId}, ${week}, ${score}, ${name}, now())
        on conflict (user_id, week_id) do update
          set score = greatest(weekly_scores.score, excluded.score),
              name = weekly_scores.name,
              updated_at = now()
      `;
    }
    return readBoard(sql, week, playerId);
  });
