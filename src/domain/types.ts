/**
 * Arc — core domain types.
 *
 * Design note: `priority` and board group are the SAME field. On the Monday
 * boards this replaced, eleven automations existed only to keep a priority
 * column and a board group agreeing with each other. Here there is one value,
 * so moving a card and setting its priority are the same operation and there
 * is nothing to synchronise.
 */

/** The bucket a task sits in. This is the priority AND the board column. */
export type Priority =
  | 'top'
  | 'high'
  | 'low'
  | 'recurring'
  | 'parking';

/** Where a task is rendered. Derived, never stored — see bucketFor(). */
export type Bucket = Priority | 'unsorted' | 'completed';

export type Recurrence =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'yearly';

export type TaskStatus =
  | 'active'
  | 'in_progress'
  | 'ready'
  | 'stuck'
  | 'done';

export interface Task {
  id: string;
  title: string;
  /** null on a freshly created task — it lands in Unsorted until you label it. */
  priority: Priority | null;
  status: TaskStatus;
  /** ISO yyyy-mm-dd, or null. */
  dueDate: string | null;
  recurrence: Recurrence | null;
  pillarId: string | null;
  goalId: string | null;
  assignee: string | null;
  position: number;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  /** Which stage contributed this subtask, on template-driven boards. */
  phase: string | null;
  position: number;
}

export interface Pillar {
  id: string;
  aimId: string;
  name: string;
  affirmation: string;
  /** 1–5, self-assessed. The only progress signal a rollup cannot reach. */
  stars: number;
  /** Position along the spectrum, 0-indexed. Drives hue, not identity. */
  hueOrder: number;
}

export type ProgressMode = 'rollup' | 'metric' | 'manual';

export interface Goal {
  id: string;
  pillarId: string;
  title: string;
  progressMode: ProgressMode;
  target: number | null;
  manualProgress: number | null;
  closedAt: string | null;
}

/** A logged value for a metric goal. One tap, timestamped — never a field to maintain. */
export interface MetricEntry {
  id: string;
  goalId: string;
  value: number;
  loggedAt: string;
}

/** Song-production stages, in order. */
export const SONG_STAGES = [
  'backlog',
  'demo',
  'tracking',
  'mix_master',
  'planning',
  'released',
] as const;

export type SongStage = (typeof SONG_STAGES)[number];

export interface Song {
  id: string;
  title: string;
  /** null on a new song — it sits unlabelled until you assign a stage. */
  stage: SongStage | null;
  assignee: string | null;
  position: number;
}
