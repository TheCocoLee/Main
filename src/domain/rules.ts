/**
 * Arc — the rules that replace the automations.
 *
 * Every function here is pure. Sixty-five automations across two Monday boards
 * collapse into this file plus one field rename, because most of them existed
 * to compensate for redundant state rather than to express real behaviour.
 *
 *   19 automations syncing a column to a group it duplicated  →  gone (one field)
 *    7 hand-rolled recurrence recipes                         →  completeTask()
 *    3 "when date arrives, move to Top Priority"              →  bucketFor()
 *    3 subitem rollups                                        →  rollupStatus()
 *    5 group-scoped creation defaults                         →  board config
 *    4 phase-template recipes on Song Production              →  subtasksForStage()
 */

import {
  type Bucket,
  type Recurrence,
  type SongStage,
  type Subtask,
  type Song,
  type Task,
  type TaskStatus,
  SONG_STAGES,
} from './types';

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Today as yyyy-mm-dd, in local time. */
export function today(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Advance a date by one recurrence interval.
 *
 * Month arithmetic clamps rather than overflowing: Jan 31 + 1 month is Feb 28,
 * not Mar 3. A monthly review scheduled for the 31st should not silently drift
 * into the following month.
 */
export function advanceDate(iso: string, every: Recurrence): string {
  const [y, m, d] = iso.split('-').map(Number);

  if (every === 'daily' || every === 'weekly' || every === 'biweekly') {
    const days = every === 'daily' ? 1 : every === 'weekly' ? 7 : 14;
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  const addMonths = every === 'monthly' ? 1 : every === 'bimonthly' ? 2 : 12;
  const targetMonthIndex = m - 1 + addMonths;
  const ty = y + Math.floor(targetMonthIndex / 12);
  const tm = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const td = Math.min(d, lastDay);

  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
}

/** A task is due when it has a date at or before today and isn't finished. */
export function isDue(task: Task, ref: string = today()): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  return task.dueDate <= ref;
}

export function isOverdue(task: Task, ref: string = today()): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  return task.dueDate < ref;
}

// ---------------------------------------------------------------------------
// Bucketing — replaces "when date arrives, move item to Top Priority"
// ---------------------------------------------------------------------------

/**
 * Which column a task renders in.
 *
 * Monday physically moved the item when its date arrived, which is destructive:
 * the card kept its new priority forever, even if you never worked on it, and
 * your original ordering was gone. Here the surfacing is derived, so a due task
 * appears at the top of Top Priority and drops back to where you actually filed
 * it once it is done or rescheduled. Visually identical, but reversible.
 */
export function bucketFor(task: Task, ref: string = today()): Bucket {
  if (task.status === 'done') return 'completed';
  if (isDue(task, ref)) return 'top';
  if (task.priority === null) return 'unsorted';
  return task.priority;
}

/** True when the task is only in Top Priority because its date arrived. */
export function isSurfaced(task: Task, ref: string = today()): boolean {
  return isDue(task, ref) && task.priority !== 'top';
}

/**
 * Order within a column: surfaced-by-date first (most overdue leading), then
 * manual position. Undated tasks keep the order you dragged them into.
 */
export function sortForBucket(tasks: Task[], ref: string = today()): Task[] {
  return [...tasks].sort((a, b) => {
    const ad = isDue(a, ref) ? 0 : 1;
    const bd = isDue(b, ref) ? 0 : 1;
    if (ad !== bd) return ad - bd;
    if (ad === 0 && a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.position - b.position;
  });
}

// ---------------------------------------------------------------------------
// Completion — replaces the seven recurrence recipes and their guard
// ---------------------------------------------------------------------------

/**
 * Complete a task.
 *
 * A recurring task never reaches Done. It rolls its date forward by one
 * interval, resets to active, and returns to the Recurring column. That was six
 * near-identical Monday recipes plus a five-condition guard whose only job was
 * stopping recurring items falling into Completed.
 *
 * Rolling forward from the due date rather than from today keeps a weekly
 * review on its weekday even when you tick it off two days late.
 */
export function completeTask(task: Task, ref: string = today()): Task {
  if (!task.recurrence) {
    return { ...task, status: 'done' };
  }

  const base = task.dueDate ?? ref;
  let next = advanceDate(base, task.recurrence);
  // If it was completed very late, roll forward until it lands in the future.
  while (next <= ref) next = advanceDate(next, task.recurrence);

  return {
    ...task,
    status: 'active',
    dueDate: next,
    priority: 'recurring',
  };
}

/** Reopen a completed task. Recurring tasks are never in this state. */
export function reopenTask(task: Task): Task {
  return { ...task, status: 'active' };
}

// ---------------------------------------------------------------------------
// Moving — the operation that eleven sync automations used to approximate
// ---------------------------------------------------------------------------

/**
 * Move a task to a column. Because priority and column are one field, this is
 * the whole implementation — there is no second field to update afterwards.
 */
export function moveTask(task: Task, to: Bucket, position = 0): Task {
  if (to === 'completed') return { ...completeTask(task), position };
  if (to === 'unsorted') return { ...task, priority: null, position };

  const reopened = task.status === 'done' ? reopenTask(task) : task;
  return { ...reopened, priority: to, position };
}

// ---------------------------------------------------------------------------
// Subtask rollup — replaces "when all subitems are Done, set the item to Done"
// ---------------------------------------------------------------------------

export function rollupStatus(task: Task, subtasks: Subtask[]): TaskStatus {
  if (subtasks.length === 0) return task.status;
  if (subtasks.every((s) => s.done)) return 'done';
  if (task.status === 'done') return 'in_progress';
  if (subtasks.some((s) => s.done)) return 'in_progress';
  return task.status;
}

export function progressOf(subtasks: Subtask[]): { done: number; total: number; pct: number } {
  const total = subtasks.length;
  const done = subtasks.filter((s) => s.done).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// ---------------------------------------------------------------------------
// Song production — replaces the four subitem-creating recipes
// ---------------------------------------------------------------------------

/**
 * What each stage contributes. Counts match the templates already running on
 * the Song Production board: 4 / 6 / 2 / 4.
 *
 * Subtasks ACCUMULATE. Nothing is ever removed, so a released song carries its
 * full production record rather than a checklist that keeps resetting.
 */
export const STAGE_TEMPLATES: Record<SongStage, string[]> = {
  backlog: [],
  demo: [
    'Deliver First Demo',
    'Demo Vocals',
    'Finalize Parts & Arrangement',
    'Deliver Final Demo',
  ],
  tracking: [
    'Track + Edit Guitar',
    'Track + Edit Vocals',
    'Track + Edit Drums',
    'Track + Edit Bass',
    'Write + Edit Post-Production',
    'Deliver Tracks for Mixing',
  ],
  mix_master: ['Receive Final Mix', 'Receive Final Master'],
  planning: [
    'Create Art Direction',
    'Create Release Strategy',
    'Create Videos, Content',
    'Schedule Release',
  ],
  released: [],
};

export const STAGE_LABELS: Record<SongStage, string> = {
  backlog: 'Backlog',
  demo: 'Demo',
  tracking: 'Tracking',
  mix_master: 'Mix & Master',
  planning: 'Planning',
  released: 'Released',
};

/**
 * Subtasks a song should gain on entering a stage.
 *
 * Every stage up to and including the target contributes, so assigning a stage
 * directly to a brand-new song backfills the earlier checklists rather than
 * leaving gaps. Titles already present are never duplicated, which makes moving
 * a song backwards and forwards again safe.
 */
export function subtasksForStage(
  stage: SongStage,
  existing: Pick<Subtask, 'title'>[] = [],
): { title: string; phase: SongStage }[] {
  const upTo = SONG_STAGES.indexOf(stage);
  const have = new Set(existing.map((s) => s.title));
  const out: { title: string; phase: SongStage }[] = [];

  for (let i = 0; i <= upTo; i++) {
    const s = SONG_STAGES[i];
    for (const title of STAGE_TEMPLATES[s]) {
      if (!have.has(title)) {
        have.add(title);
        out.push({ title, phase: s });
      }
    }
  }
  return out;
}

/**
 * The stage a song is ready to advance to, or null if it isn't.
 *
 * Advancing is offered, never automatic. Two songs on the current board sit in
 * the Released group with a stage of Scheduled — a confirm step is what stops
 * that drift.
 */
export function readyToAdvance(song: Song, subtasks: Subtask[]): SongStage | null {
  if (!song.stage) return null;
  const i = SONG_STAGES.indexOf(song.stage);
  if (i < 0 || i >= SONG_STAGES.length - 1) return null;

  const forStage = subtasks.filter((s) => s.phase === song.stage);
  if (forStage.length === 0 || !forStage.every((s) => s.done)) return null;

  return SONG_STAGES[i + 1];
}

// ---------------------------------------------------------------------------
// Pillars — the prism
// ---------------------------------------------------------------------------

/** Brand spectrum, sampled from the Auvora mark: pink → violet → cyan. */
const SPECTRUM: [number, number, number][] = [
  [252, 122, 216],
  [131, 86, 255],
  [61, 198, 255],
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** The colour of a band at position t (0–1) along the spectrum. */
export function bandColor(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const [lo, hi, local] =
    clamped <= 0.5
      ? [SPECTRUM[0], SPECTRUM[1], clamped / 0.5]
      : [SPECTRUM[1], SPECTRUM[2], (clamped - 0.5) / 0.5];
  return [
    Math.round(lerp(lo[0], hi[0], local)),
    Math.round(lerp(lo[1], hi[1], local)),
    Math.round(lerp(lo[2], hi[2], local)),
  ];
}

export function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Recombine the bands into one colour, weighted by completed work.
 *
 * The second half of the torus: colour returning to white. A balanced set of
 * pillars recombines to the spectrum's midpoint; a neglected one pulls the
 * result away from it, and the direction of the tint names what is being
 * neglected. This is the glance, not the measurement — four points of
 * difference are not visible in a swatch, which is why the numbers sit beside it.
 */
export function recombine(
  bands: { hueOrder: number; progress: number }[],
  count: number,
): { now: string; balanced: string } {
  const at = (i: number) => (count <= 1 ? 0.5 : i / (count - 1));

  let wr = 0, wg = 0, wb = 0, tw = 0;
  for (const b of bands) {
    const [r, g, bl] = bandColor(at(b.hueOrder));
    const w = Math.max(b.progress, 0);
    wr += r * w; wg += g * w; wb += bl * w; tw += w;
  }

  let br = 0, bg = 0, bb = 0;
  for (let i = 0; i < count; i++) {
    const [r, g, bl] = bandColor(at(i));
    br += r; bg += g; bb += bl;
  }

  const balanced: [number, number, number] = [
    Math.round(br / count), Math.round(bg / count), Math.round(bb / count),
  ];
  if (tw === 0) return { now: toHex(balanced), balanced: toHex(balanced) };

  return {
    now: toHex([Math.round(wr / tw), Math.round(wg / tw), Math.round(wb / tw)]),
    balanced: toHex(balanced),
  };
}
