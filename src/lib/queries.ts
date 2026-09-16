import { query } from '@/db';
import {
  bucketFor,
  progressOf,
  readyToAdvance,
  recombine,
  sortForBucket,
  today,
} from '@/domain/rules';
import type { Bucket, Pillar, Song, SongStage, Subtask, Task } from '@/domain/types';

/**
 * Dates are selected as text rather than left to node-postgres.
 *
 * A Postgres DATE arrives as a JS Date at local midnight, which shifts a day
 * either side of UTC and would make "due today" wrong depending on where you
 * open the app. The domain works in 'YYYY-MM-DD' strings throughout, so the
 * cast happens once, here, in SQL.
 */
const DUE = `to_char(t.due_date, 'YYYY-MM-DD') AS due_date`;

export interface PillarView extends Pillar {
  goalsTotal: number;
  goalsDone: number;
  /** Completed goals as a percentage. Computed, never entered. */
  progress: number;
  /** Stars on the same 0-100 scale, for comparison against progress. */
  felt: number;
  gap: number;
}

export async function getPillars(): Promise<PillarView[]> {
  const rows = await query<{
    id: string; aim_id: string; name: string; affirmation: string;
    stars: number; hue_order: number; goals_total: string; goals_done: string;
  }>(
    `SELECT p.id, p.aim_id, p.name, p.affirmation, p.stars, p.hue_order,
            COUNT(g.id)                                            AS goals_total,
            COUNT(g.id) FILTER (WHERE g.closed_at IS NOT NULL)      AS goals_done
       FROM pillar p
  LEFT JOIN goal g ON g.pillar_id = p.id
   GROUP BY p.id
   ORDER BY p.hue_order`,
  );

  return rows.map((r) => {
    const total = Number(r.goals_total);
    const done = Number(r.goals_done);
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    const felt = r.stars * 20;
    return {
      id: r.id,
      aimId: r.aim_id,
      name: r.name,
      affirmation: r.affirmation,
      stars: r.stars,
      hueOrder: r.hue_order,
      goalsTotal: total,
      goalsDone: done,
      progress,
      felt,
      gap: felt - progress,
    };
  });
}

export async function getAim() {
  const [row] = await query<{ id: string; title: string; body: string | null; year: number }>(
    'SELECT id, title, body, year FROM aim ORDER BY year DESC LIMIT 1',
  );
  return row;
}

/** The second half of the torus: the bands returning to white. */
export async function getRecombined() {
  const pillars = await getPillars();
  return recombine(
    pillars.map((p) => ({ hueOrder: p.hueOrder, progress: p.progress })),
    pillars.length,
  );
}

export interface TaskView extends Task {
  pillarName: string | null;
  pillarHue: number | null;
  subDone: number;
  subTotal: number;
}

export const BUCKETS: { key: Bucket; label: string }[] = [
  { key: 'unsorted', label: 'Unsorted' },
  { key: 'top', label: 'Top Priority' },
  { key: 'high', label: 'High Priority' },
  { key: 'low', label: 'Low Priority' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'parking', label: 'Parking Lot' },
  { key: 'completed', label: 'Completed' },
];

export async function getBoard(ref = today()): Promise<Record<Bucket, TaskView[]>> {
  const rows = await query<{
    id: string; title: string; priority: Task['priority']; status: Task['status'];
    due_date: string | null; recurrence: Task['recurrence']; pillar_id: string | null;
    goal_id: string | null; assignee: string | null; position: number;
    pillar_name: string | null; pillar_hue: number | null;
    sub_total: string; sub_done: string;
  }>(
    `SELECT t.id, t.title, t.priority, t.status, ${DUE}, t.recurrence,
            t.pillar_id, t.goal_id, t.assignee, t.position,
            p.name      AS pillar_name,
            p.hue_order AS pillar_hue,
            (SELECT COUNT(*) FROM subtask s WHERE s.task_id = t.id)                 AS sub_total,
            (SELECT COUNT(*) FROM subtask s WHERE s.task_id = t.id AND s.done)      AS sub_done
       FROM task t
  LEFT JOIN pillar p ON p.id = t.pillar_id
       JOIN task_board tb ON tb.task_id = t.id AND tb.board_id = 'b_master'
   ORDER BY t.position`,
  );

  const out = Object.fromEntries(BUCKETS.map((b) => [b.key, [] as TaskView[]])) as Record<
    Bucket,
    TaskView[]
  >;

  for (const r of rows) {
    const task: Task = {
      id: r.id,
      title: r.title,
      priority: r.priority,
      status: r.status,
      dueDate: r.due_date,
      recurrence: r.recurrence,
      pillarId: r.pillar_id,
      goalId: r.goal_id,
      assignee: r.assignee,
      position: r.position,
    };
    out[bucketFor(task, ref)].push({
      ...task,
      pillarName: r.pillar_name,
      pillarHue: r.pillar_hue,
      subDone: Number(r.sub_done),
      subTotal: Number(r.sub_total),
    });
  }

  for (const k of Object.keys(out) as Bucket[]) {
    out[k] = sortForBucket(out[k], ref) as TaskView[];
  }
  return out;
}

export interface SongView extends Song {
  subtasks: Subtask[];
  done: number;
  total: number;
  pct: number;
  canAdvanceTo: SongStage | null;
}

export async function getSongs(): Promise<SongView[]> {
  const songs = await query<{
    id: string; title: string; stage: SongStage | null;
    assignee: string | null; position: number;
  }>('SELECT id, title, stage, assignee, position FROM song ORDER BY position');

  const subs = await query<{
    id: string; song_id: string; title: string;
    done: boolean; phase: string | null; position: number;
  }>('SELECT id, song_id, title, done, phase, position FROM song_subtask ORDER BY position');

  const bySong = new Map<string, Subtask[]>();
  for (const s of subs) {
    const list = bySong.get(s.song_id) ?? [];
    list.push({
      id: s.id, taskId: s.song_id, title: s.title,
      done: s.done, phase: s.phase, position: s.position,
    });
    bySong.set(s.song_id, list);
  }

  return songs.map((r) => {
    const song: Song = {
      id: r.id, title: r.title, stage: r.stage,
      assignee: r.assignee, position: r.position,
    };
    const mine = bySong.get(r.id) ?? [];
    const { done, total, pct } = progressOf(mine);
    return { ...song, subtasks: mine, done, total, pct, canAdvanceTo: readyToAdvance(song, mine) };
  });
}
