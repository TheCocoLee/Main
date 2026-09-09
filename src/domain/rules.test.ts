import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceDate,
  bucketFor,
  completeTask,
  isSurfaced,
  moveTask,
  progressOf,
  readyToAdvance,
  recombine,
  rollupStatus,
  sortForBucket,
  subtasksForStage,
} from './rules';
import type { Song, Subtask, Task } from './types';

const TODAY = '2026-09-09';

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Task',
    priority: null,
    status: 'active',
    dueDate: null,
    recurrence: null,
    pillarId: null,
    goalId: null,
    assignee: null,
    position: 0,
    ...over,
  };
}

function sub(over: Partial<Subtask> = {}): Subtask {
  return { id: 's', taskId: 't1', title: 'S', done: false, phase: null, position: 0, ...over };
}

// --- dates ------------------------------------------------------------------

test('advanceDate covers every interval', () => {
  assert.equal(advanceDate('2026-09-09', 'daily'), '2026-09-10');
  assert.equal(advanceDate('2026-09-09', 'weekly'), '2026-09-16');
  assert.equal(advanceDate('2026-09-09', 'biweekly'), '2026-09-23');
  assert.equal(advanceDate('2026-09-09', 'monthly'), '2026-10-09');
  assert.equal(advanceDate('2026-09-09', 'bimonthly'), '2026-11-09');
  assert.equal(advanceDate('2026-09-09', 'yearly'), '2027-09-09');
});

test('advanceDate clamps short months instead of overflowing', () => {
  assert.equal(advanceDate('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(advanceDate('2028-01-31', 'monthly'), '2028-02-29');
  assert.equal(advanceDate('2026-12-15', 'monthly'), '2027-01-15');
  assert.equal(advanceDate('2026-11-30', 'bimonthly'), '2027-01-30');
});

// --- bucketing --------------------------------------------------------------

test('a new task with no label lands in Unsorted', () => {
  assert.equal(bucketFor(task(), TODAY), 'unsorted');
});

test('labelling a task moves it, with no second field to sync', () => {
  const t = moveTask(task(), 'high');
  assert.equal(t.priority, 'high');
  assert.equal(bucketFor(t, TODAY), 'high');
});

test('a due date arriving surfaces the task in Top Priority', () => {
  const t = task({ priority: 'low', dueDate: TODAY });
  assert.equal(bucketFor(t, TODAY), 'top');
  assert.equal(isSurfaced(t, TODAY), true);
});

test('surfacing is derived, so the filed priority is never destroyed', () => {
  const t = task({ priority: 'low', dueDate: '2026-09-01' });
  assert.equal(bucketFor(t, TODAY), 'top');
  assert.equal(t.priority, 'low', 'stored priority untouched');
  // Reschedule past today and it drops back where it was filed.
  assert.equal(bucketFor({ ...t, dueDate: '2026-12-01' }, TODAY), 'low');
});

test('a future date does not surface anything', () => {
  assert.equal(bucketFor(task({ priority: 'low', dueDate: '2026-12-01' }), TODAY), 'low');
});

test('done outranks everything, including an overdue date', () => {
  const t = task({ priority: 'top', dueDate: '2026-01-01', status: 'done' });
  assert.equal(bucketFor(t, TODAY), 'completed');
});

test('due tasks sort ahead of undated ones, most overdue first', () => {
  const a = task({ id: 'a', priority: 'top', position: 0 });
  const b = task({ id: 'b', priority: 'top', dueDate: '2026-09-08', position: 5 });
  const c = task({ id: 'c', priority: 'top', dueDate: '2026-08-01', position: 9 });
  assert.deepEqual(sortForBucket([a, b, c], TODAY).map((t) => t.id), ['c', 'b', 'a']);
});

// --- completion & recurrence ------------------------------------------------

test('completing a plain task finishes it', () => {
  assert.equal(completeTask(task({ priority: 'top' }), TODAY).status, 'done');
});

test('a recurring task rolls forward instead of completing', () => {
  const weekly = task({ priority: 'top', recurrence: 'weekly', dueDate: '2026-09-09' });
  const next = completeTask(weekly, TODAY);
  assert.equal(next.status, 'active');
  assert.equal(next.dueDate, '2026-09-16');
  assert.equal(next.priority, 'recurring');
  assert.notEqual(bucketFor(next, TODAY), 'completed');
});

test('a recurring task ticked off late keeps its weekday', () => {
  // Due Monday, ticked off the following Wednesday.
  const t = task({ recurrence: 'weekly', dueDate: '2026-08-31' });
  const next = completeTask(t, '2026-09-09');
  assert.equal(next.dueDate, '2026-09-14', 'still a Monday, not shifted to Wednesday');
});

test('a badly overdue recurring task rolls past today, not into the past', () => {
  const t = task({ recurrence: 'daily', dueDate: '2026-01-01' });
  const next = completeTask(t, TODAY);
  assert.ok(next.dueDate! > TODAY, `expected future date, got ${next.dueDate}`);
});

test('dragging a completed task back to a column reopens it', () => {
  const done = task({ status: 'done', priority: 'top' });
  const moved = moveTask(done, 'high');
  assert.equal(moved.status, 'active');
  assert.equal(moved.priority, 'high');
});

test('dragging a recurring task to Completed rolls it forward instead', () => {
  const t = task({ recurrence: 'monthly', dueDate: '2026-09-09', priority: 'recurring' });
  const moved = moveTask(t, 'completed');
  assert.equal(moved.status, 'active');
  assert.equal(moved.dueDate, '2026-10-09');
});

// --- subtask rollup ---------------------------------------------------------

test('all subtasks done rolls the parent up to done', () => {
  const subs = [sub({ id: '1', done: true }), sub({ id: '2', done: true })];
  assert.equal(rollupStatus(task(), subs), 'done');
});

test('unchecking one subtask brings the parent back out of done', () => {
  const subs = [sub({ id: '1', done: true }), sub({ id: '2', done: false })];
  assert.equal(rollupStatus(task({ status: 'done' }), subs), 'in_progress');
});

test('a task with no subtasks keeps its own status', () => {
  assert.equal(rollupStatus(task({ status: 'stuck' }), []), 'stuck');
});

test('progressOf counts what is finished', () => {
  assert.deepEqual(progressOf([sub({ done: true }), sub(), sub()]), {
    done: 1, total: 3, pct: 33,
  });
});

// --- song production --------------------------------------------------------

test('stage templates match the counts already on the board', () => {
  assert.equal(subtasksForStage('demo').length, 4);
  assert.equal(subtasksForStage('tracking').length, 10, 'demo 4 + tracking 6');
  assert.equal(subtasksForStage('mix_master').length, 12);
  assert.equal(subtasksForStage('planning').length, 16);
});

test('assigning a stage to a new song backfills the earlier checklists', () => {
  const added = subtasksForStage('tracking');
  assert.ok(added.some((s) => s.title === 'Deliver First Demo' && s.phase === 'demo'));
  assert.ok(added.some((s) => s.title === 'Track + Edit Bass' && s.phase === 'tracking'));
});

test('re-entering a stage never duplicates subtasks', () => {
  const have = subtasksForStage('demo').map((s) => ({ title: s.title }));
  const again = subtasksForStage('tracking', have);
  assert.equal(again.length, 6, 'only the six new tracking items');
  assert.equal(again.filter((s) => s.title === 'Demo Vocals').length, 0);
});

test('a song only offers to advance once its stage is fully checked', () => {
  const song: Song = { id: 'x', title: 'parallels', stage: 'demo', assignee: null, position: 0 };
  const partly = [sub({ phase: 'demo', done: true }), sub({ id: '2', phase: 'demo' })];
  assert.equal(readyToAdvance(song, partly), null);

  const all = partly.map((s) => ({ ...s, done: true }));
  assert.equal(readyToAdvance(song, all), 'tracking');
});

test('a released song has nowhere further to advance', () => {
  const song: Song = { id: 'x', title: 'bloom', stage: 'released', assignee: null, position: 0 };
  assert.equal(readyToAdvance(song, [sub({ phase: 'released', done: true })]), null);
});

// --- the prism --------------------------------------------------------------

test('evenly progressed pillars recombine to the balanced colour', () => {
  const bands = [0, 1, 2, 3, 4].map((hueOrder) => ({ hueOrder, progress: 50 }));
  const { now, balanced } = recombine(bands, 5);
  assert.equal(now, balanced);
});

test('a neglected band pulls the recombined colour away from balance', () => {
  const bands = [
    { hueOrder: 0, progress: 75 },
    { hueOrder: 1, progress: 43 },
    { hueOrder: 2, progress: 38 },
    { hueOrder: 3, progress: 40 },
    { hueOrder: 4, progress: 36 },
  ];
  const { now, balanced } = recombine(bands, 5);
  assert.notEqual(now, balanced);
  // Career (the pink end) carries the beam, so the result runs warmer than balance.
  const red = (h: string) => parseInt(h.slice(1, 3), 16);
  assert.ok(red(now) > red(balanced), `${now} should be redder than ${balanced}`);
});

test('no progress anywhere still yields a usable colour', () => {
  const bands = [0, 1, 2].map((hueOrder) => ({ hueOrder, progress: 0 }));
  const { now, balanced } = recombine(bands, 3);
  assert.equal(now, balanced);
  assert.match(now, /^#[0-9A-F]{6}$/);
});
