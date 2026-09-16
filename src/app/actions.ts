'use server';

import { revalidatePath } from 'next/cache';
import { id, query, transaction } from '@/db';
import { completeTask, moveTask, rollupStatus, subtasksForStage } from '@/domain/rules';
import type { Bucket, Song, SongStage, Subtask, Task } from '@/domain/types';

const TASK_COLS = `id, title, priority, status,
  to_char(due_date, 'YYYY-MM-DD') AS due_date,
  recurrence, pillar_id, goal_id, assignee, position`;

type TaskRow = {
  id: string; title: string; priority: Task['priority']; status: Task['status'];
  due_date: string | null; recurrence: Task['recurrence'];
  pillar_id: string | null; goal_id: string | null;
  assignee: string | null; position: number;
};

const toTask = (r: TaskRow): Task => ({
  id: r.id, title: r.title, priority: r.priority, status: r.status,
  dueDate: r.due_date, recurrence: r.recurrence, pillarId: r.pillar_id,
  goalId: r.goal_id, assignee: r.assignee, position: r.position,
});

async function loadTask(taskId: string): Promise<Task> {
  const [row] = await query<TaskRow>(
    `SELECT ${TASK_COLS} FROM task WHERE id = $1`, [taskId],
  );
  if (!row) throw new Error(`No task ${taskId}`);
  return toTask(row);
}

async function saveTask(t: Task): Promise<void> {
  await query(
    `UPDATE task SET priority = $1, status = $2, due_date = $3, recurrence = $4,
                     pillar_id = $5, goal_id = $6, position = $7
      WHERE id = $8`,
    [t.priority, t.status, t.dueDate, t.recurrence, t.pillarId, t.goalId, t.position, t.id],
  );
}

function refreshBoards() {
  revalidatePath('/board');
  revalidatePath('/');
}

/**
 * Move a task to a column.
 *
 * The whole implementation, because priority and column are one field. On the
 * Monday board this took eleven automations pushing a value back and forth
 * between a status column and a group.
 */
export async function moveTaskAction(taskId: string, to: Bucket) {
  await saveTask(moveTask(await loadTask(taskId), to));
  refreshBoards();
}

/** Complete a task — or, if it recurs, roll it forward to its next date. */
export async function completeTaskAction(taskId: string) {
  await saveTask(completeTask(await loadTask(taskId)));
  refreshBoards();
}

export async function reopenTaskAction(taskId: string) {
  await saveTask({ ...(await loadTask(taskId)), status: 'active' });
  refreshBoards();
}

/** New tasks arrive unlabelled and land in Unsorted until you file them. */
export async function createTaskAction(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;

  const pillarId = String(formData.get('pillarId') ?? '') || null;
  const taskId = id('t');

  await transaction(async (run) => {
    await run(
      `INSERT INTO task (id, title, priority, status, pillar_id, assignee, position)
       VALUES ($1, $2, NULL, 'active', $3, 'Coco Lee', 0)`,
      [taskId, title, pillarId],
    );
    await run(
      `INSERT INTO task_board (task_id, board_id, position) VALUES ($1, 'b_master', 0)`,
      [taskId],
    );
  });

  refreshBoards();
}

export async function setPillarAction(taskId: string, pillarId: string | null) {
  await query('UPDATE task SET pillar_id = $1 WHERE id = $2', [pillarId || null, taskId]);
  refreshBoards();
}

// --- song production --------------------------------------------------------

async function loadSong(songId: string): Promise<{ song: Song; subs: Subtask[] }> {
  const [r] = await query<{
    id: string; title: string; stage: SongStage | null;
    assignee: string | null; position: number;
  }>('SELECT id, title, stage, assignee, position FROM song WHERE id = $1', [songId]);
  if (!r) throw new Error(`No song ${songId}`);

  const rows = await query<{
    id: string; song_id: string; title: string;
    done: boolean; phase: string | null; position: number;
  }>(
    'SELECT id, song_id, title, done, phase, position FROM song_subtask WHERE song_id = $1 ORDER BY position',
    [songId],
  );

  return {
    song: { id: r.id, title: r.title, stage: r.stage, assignee: r.assignee, position: r.position },
    subs: rows.map((s) => ({
      id: s.id, taskId: s.song_id, title: s.title,
      done: s.done, phase: s.phase, position: s.position,
    })),
  };
}

/**
 * Assign a stage to a song.
 *
 * Entering a stage appends that stage's checklist, backfilling any earlier
 * stage the song skipped. Nothing is ever removed, so a released song carries
 * its full production record. Titles already present are not duplicated, which
 * makes moving a song backwards and forwards again safe.
 */
export async function setSongStageAction(songId: string, stage: SongStage) {
  const { subs } = await loadSong(songId);
  const toAdd = subtasksForStage(stage, subs);

  await transaction(async (run) => {
    await run('UPDATE song SET stage = $1 WHERE id = $2', [stage, songId]);
    let pos = subs.length;
    for (const s of toAdd) {
      await run(
        `INSERT INTO song_subtask (id, song_id, title, done, phase, position)
         VALUES ($1, $2, $3, FALSE, $4, $5)`,
        [id('ss'), songId, s.title, s.phase, pos++],
      );
    }
  });

  revalidatePath('/songs');
}

export async function toggleSongSubtaskAction(subtaskId: string) {
  await query('UPDATE song_subtask SET done = NOT done WHERE id = $1', [subtaskId]);
  revalidatePath('/songs');
}

export async function createSongAction(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;
  // No stage: it sits unlabelled until you assign one.
  await query(
    'INSERT INTO song (id, title, stage, position) VALUES ($1, $2, NULL, 0)',
    [id('s'), title],
  );
  revalidatePath('/songs');
}

/** Roll a task's status up from its subtasks. */
export async function toggleSubtaskAction(subtaskId: string) {
  const [s] = await query<{ task_id: string }>(
    'UPDATE subtask SET done = NOT done WHERE id = $1 RETURNING task_id',
    [subtaskId],
  );
  if (!s) return;

  const task = await loadTask(s.task_id);
  const rows = await query<{
    id: string; task_id: string; title: string;
    done: boolean; phase: string | null; position: number;
  }>('SELECT id, task_id, title, done, phase, position FROM subtask WHERE task_id = $1', [s.task_id]);

  const subs: Subtask[] = rows.map((r) => ({
    id: r.id, taskId: r.task_id, title: r.title,
    done: r.done, phase: r.phase, position: r.position,
  }));

  await saveTask({ ...task, status: rollupStatus(task, subs) });
  revalidatePath('/board');
}
