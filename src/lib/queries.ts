import { getDb } from '@/db';
import {
  bucketFor,
  progressOf,
  readyToAdvance,
  recombine,
  sortForBucket,
  today,
} from '@/domain/rules';
import type { Bucket, Pillar, Song, SongStage, Subtask, Task } from '@/domain/types';

type Row = Record<string, any>;

const toTask = (r: Row): Task => ({
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
});

export interface PillarView extends Pillar {
  goalsTotal: number;
  goalsDone: number;
  /** Completed goals as a percentage. Computed, never entered. */
  progress: number;
  /** Stars expressed on the same 0–100 scale, for comparison against progress. */
  felt: number;
  gap: number;
}

export function getPillars(): PillarView[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*,
              COUNT(g.id)                                        AS goals_total,
              SUM(CASE WHEN g.closed_at IS NOT NULL THEN 1 ELSE 0 END) AS goals_done
         FROM pillar p
    LEFT JOIN goal g ON g.pillar_id = p.id
     GROUP BY p.id
     ORDER BY p.hue_order`,
    )
    .all() as Row[];

  return rows.map((r) => {
    const total = Number(r.goals_total) || 0;
    const done = Number(r.goals_done) || 0;
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

export function getAim() {
  return getDb().prepare('SELECT * FROM aim LIMIT 1').get() as Row | undefined;
}

/** The second half of the torus: the bands returning to white. */
export function getRecombined() {
  const pillars = getPillars();
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

export function getBoard(ref = today()): Record<Bucket, TaskView[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS pillar_name, p.hue_order AS pillar_hue,
              (SELECT COUNT(*) FROM subtask s WHERE s.task_id = t.id) AS sub_total,
              (SELECT COUNT(*) FROM subtask s WHERE s.task_id = t.id AND s.done = 1) AS sub_done
         FROM task t
    LEFT JOIN pillar p ON p.id = t.pillar_id
         JOIN task_board tb ON tb.task_id = t.id AND tb.board_id = 'b_master'
     ORDER BY t.position`,
    )
    .all() as Row[];

  const out = Object.fromEntries(BUCKETS.map((b) => [b.key, [] as TaskView[]])) as Record<
    Bucket,
    TaskView[]
  >;

  for (const r of rows) {
    const t = toTask(r);
    const view: TaskView = {
      ...t,
      pillarName: r.pillar_name ?? null,
      pillarHue: r.pillar_hue ?? null,
      subDone: Number(r.sub_done) || 0,
      subTotal: Number(r.sub_total) || 0,
    };
    out[bucketFor(t, ref)].push(view);
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

export function getSongs(): SongView[] {
  const db = getDb();
  const songs = db.prepare('SELECT * FROM song ORDER BY position').all() as Row[];
  const subs = db
    .prepare('SELECT * FROM song_subtask ORDER BY position')
    .all() as Row[];

  return songs.map((r) => {
    const song: Song = {
      id: r.id, title: r.title, stage: r.stage,
      assignee: r.assignee, position: r.position,
    };
    const mine: Subtask[] = subs
      .filter((s) => s.song_id === r.id)
      .map((s) => ({
        id: s.id, taskId: s.song_id, title: s.title,
        done: !!s.done, phase: s.phase, position: s.position,
      }));
    const { done, total, pct } = progressOf(mine);
    return { ...song, subtasks: mine, done, total, pct, canAdvanceTo: readyToAdvance(song, mine) };
  });
}
