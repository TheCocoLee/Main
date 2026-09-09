import { completeTaskAction, createTaskAction, moveTaskAction, reopenTaskAction } from '../actions';
import MoveSelect from '@/components/MoveSelect';
import { bandColor, isOverdue, isSurfaced, today } from '@/domain/rules';
import { toHex } from '@/domain/rules';
import { BUCKETS, getBoard, getPillars, type TaskView } from '@/lib/queries';
import type { Bucket } from '@/domain/types';

export const dynamic = 'force-dynamic';

const RAIL: Record<string, string> = {
  unsorted: 'var(--line-2)',
  top: 'var(--violet)',
  high: '#6b7dff',
  low: '#5999ff',
  recurring: '#9b5df7',
  parking: 'var(--line-2)',
  completed: 'var(--cyan)',
};

const REC_LABEL: Record<string, string> = {
  daily: 'Daily', weekly: 'Weekly', biweekly: 'Bi-Weekly',
  monthly: 'Monthly', bimonthly: 'Bi-Monthly', yearly: 'Yearly',
};

export default function BoardPage() {
  const ref = today();
  const board = getBoard(ref);
  const pillars = getPillars();
  const hueOf = (h: number | null) =>
    h === null ? null : toHex(bandColor(pillars.length <= 1 ? 0.5 : h / (pillars.length - 1)));

  const total = Object.values(board).reduce((a, b) => a + b.length, 0);

  return (
    <>
      <h1>Master Board</h1>
      <p className="sub">
        {total} tasks · dragging a card between columns <em>is</em> setting its priority — one
        field, nothing to synchronise
      </p>

      <form action={createTaskAction} className="newform">
        <input name="title" placeholder="New task — it lands in Unsorted until you file it" />
        <select name="pillarId" aria-label="Pillar">
          <option value="">No pillar</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button className="btn" type="submit">Add</button>
      </form>

      <div className="cols">
        {BUCKETS.map(({ key, label }) => {
          const list = board[key] ?? [];
          return (
            <section className="col" key={key}>
              <header className="col-h">
                <span className="rail" style={{ background: RAIL[key] }} aria-hidden="true" />
                <span className="t">{label}</span>
                <span className="n mono">{list.length}</span>
              </header>

              {list.length === 0 && <div className="empty">Empty</div>}

              {list.slice(0, 14).map((t) => (
                <Card key={t.id} task={t} ref_={ref} hue={hueOf(t.pillarHue)} bucket={key} />
              ))}

              {list.length > 14 && (
                <p className="empty mono">+ {list.length - 14} more</p>
              )}
            </section>
          );
        })}
      </div>

      <p className="note">
        A task whose date has arrived shows here in Top Priority with a red edge, but its filed
        priority is untouched — reschedule it and it drops back where you put it. Completing a
        recurring task rolls its date forward by one interval and returns it to Recurring; it never
        reaches Completed.
      </p>
    </>
  );
}

function Card({
  task, ref_, hue, bucket,
}: { task: TaskView; ref_: string; hue: string | null; bucket: Bucket }) {
  const surfaced = isSurfaced(task, ref_);
  const overdue = isOverdue(task, ref_);
  const done = task.status === 'done';

  return (
    <article className={`card${surfaced ? ' surfaced' : ''}${done ? ' done' : ''}`}>
      <div className="ttl">{task.title}</div>

      <div className="chips">
        {task.pillarName && (
          <span className="chip pil" style={{ background: hue ?? 'var(--violet)' }}>
            {task.pillarName}
          </span>
        )}
        {task.recurrence && (
          <span className="chip rec">↻ {REC_LABEL[task.recurrence]}</span>
        )}
        {task.dueDate && (
          <span className={`chip${overdue || surfaced ? ' due' : ''}`}>
            {overdue ? 'overdue ' : ''}{task.dueDate.slice(5)}
          </span>
        )}
        {surfaced && <span className="chip due">surfaced from {task.priority}</span>}
      </div>

      <div className="rowacts">
        <MoveSelect
          taskId={task.id}
          current={bucket}
          options={BUCKETS}
          onMove={moveTaskAction}
        />
        {done ? (
          <form action={reopenTaskAction.bind(null, task.id)}>
            <button className="btn" type="submit">Reopen</button>
          </form>
        ) : (
          <form action={completeTaskAction.bind(null, task.id)}>
            <button className="btn" type="submit">
              {task.recurrence ? 'Roll forward' : 'Done'}
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
