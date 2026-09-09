'use server';

import { revalidatePath } from 'next/cache';
import { getDb, id } from '@/db';
import { completeTask, moveTask, rollupStatus, subtasksForStage } from '@/domain/rules';
import type { Bucket, Song, SongStage, Subtask, Task } from '@/domain/types';

function loadTask(taskId: string): Task {
  const r = getDb().prepare('SELECT * FROM task WHERE id = ?').get(taskId) as any;
  if (!r) throw new Error(`No task ${taskId}`);
  return {
    id: r.id, title: r.title, priority: r.priority, status: r.status,
    dueDate: r.due_date, recurrence: r.recurrence, pillarId: r.pillar_id,
    goalId: r.goal_id, assignee: r.assignee, position: r.position,
  };
}

function saveTask(t: Task) {
  getDb()
    .prepare(
      `UPDATE task SET priority=?, status=?, due_date=?, recurrence=?,
                       pillar_id=?, goal_id=?, position=? WHERE id=?`,
    )
    .run(t.priority, t.status, t.dueDate, t.recurrence, t.pillarId, t.goalId, t.position, t.id);
}

/**
 * Move a task to a column.
 *
 * The whole implementation, because priority and column are one field. On the
 * Monday board this took eleven automations pushing a value back and forth
 * between a status column and a group.
 */
export async function moveTaskAction(taskId: string, to: Bucket) {
  saveTask(moveTask(loadTask(taskId), to));
  revalidatePath('/board');
  revalidatePath('/');
}

/** Complete a task — or, if it recurs, roll it forward to its next date. */
export async function completeTaskAction(taskId: string) {
  saveTask(completeTask(loadTask(taskId)));
  revalidatePath('/board');
  revalidatePath('/');
}

export async function reopenTaskAction(taskId: string) {
  saveTask({ ...loadTask(taskId), status: 'active' });
  revalidatePath('/board');
  revalidatePath('/');
}

/** New tasks arrive unlabelled and land in Unsorted until you file them. */
export async function createTaskAction(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;

  const pillarId = String(formData.get('pillarId') ?? '') || null;
  const tid = id('t');
  getDb()
    .prepare(
      `INSERT INTO task (id,title,priority,status,due_date,recurrence,pillar_id,goal_id,assignee,position,created_at)
       VALUES (?,?,NULL,'active',NULL,NULL,?,NULL,'Coco Lee',0,?)`,
    )
    .run(tid, title, pillarId, new Date().toISOString());
  getDb()
    .prepare('INSERT INTO task_board (task_id,board_id,position) VALUES (?,?,0)')
    .run(tid, 'b_master');

  revalidatePath('/board');
  revalidatePath('/');
}

export async function setPillarAction(taskId: string, pillarId: string | null) {
  getDb().prepare('UPDATE task SET pillar_id = ? WHERE id = ?').run(pillarId || null, taskId);
  revalidatePath('/board');
  revalidatePath('/');
}

// --- song production --------------------------------------------------------

function loadSong(songId: string): { song: Song; subs: Subtask[] } {
  const db = getDb();
  const r = db.prepare('SELECT * FROM song WHERE id = ?').get(songId) as any;
  if (!r) throw new Error(`No song ${songId}`);
  const subs = (db
    .prepare('SELECT * FROM song_subtask WHERE song_id = ? ORDER BY position')
    .all(songId) as any[]).map((s) => ({
    id: s.id, taskId: s.song_id, title: s.title,
    done: !!s.done, phase: s.phase, position: s.position,
  }));
  return {
    song: { id: r.id, title: r.title, stage: r.stage, assignee: r.assignee, position: r.position },
    subs,
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
  const db = getDb();
  const { subs } = loadSong(songId);

  const toAdd = subtasksForStage(stage, subs);
  const insert = db.prepare(
    'INSERT INTO song_subtask (id,song_id,title,done,phase,position) VALUES (?,?,?,0,?,?)',
  );

  const tx = db.transaction(() => {
    db.prepare('UPDATE song SET stage = ? WHERE id = ?').run(stage, songId);
    let pos = subs.length;
    for (const s of toAdd) insert.run(id('ss'), songId, s.title, s.phase, pos++);
  });
  tx();

  revalidatePath('/songs');
}

export async function toggleSongSubtaskAction(subtaskId: string) {
  const db = getDb();
  db.prepare('UPDATE song_subtask SET done = 1 - done WHERE id = ?').run(subtaskId);
  revalidatePath('/songs');
}

export async function createSongAction(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;
  // No stage: it sits unlabelled until you assign one.
  getDb()
    .prepare('INSERT INTO song (id,title,stage,assignee,position) VALUES (?,?,NULL,NULL,0)')
    .run(id('s'), title);
  revalidatePath('/songs');
}

/** Roll a task's status up from its subtasks. */
export async function toggleSubtaskAction(subtaskId: string) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM subtask WHERE id = ?').get(subtaskId) as any;
  if (!s) return;
  db.prepare('UPDATE subtask SET done = 1 - done WHERE id = ?').run(subtaskId);

  const task = loadTask(s.task_id);
  const subs = (db.prepare('SELECT * FROM subtask WHERE task_id = ?').all(s.task_id) as any[]).map(
    (r) => ({
      id: r.id, taskId: r.task_id, title: r.title,
      done: !!r.done, phase: r.phase, position: r.position,
    }),
  );
  saveTask({ ...task, status: rollupStatus(task, subs) });
  revalidatePath('/board');
}
