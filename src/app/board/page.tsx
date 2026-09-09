import { completeTaskAction, createTaskAction, moveTaskAction, reopenTaskAction } from '../actions';
import MoveSelect from '@/components/MoveSelect';
import ViewToggle, { parseView, type ViewMode } from '@/components/ViewToggle';
import { bandColor, isOverdue, isSurfaced, toHex, today } from '@/domain/rules';
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

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const view: ViewMode = parseView((await searchParams).view);
  const refDate = today();
  const board = getBoard(refDate);
  const pillars = getPillars();

  const hueOf = (h: number | null) =>
    h === null ? null : toHex(bandColor(pillars.length <= 1 ? 0.5 : h / (pillars.length - 1)));

  const total = Object.values(board).reduce((a, b) => a + b.length, 0);
  const ctx = { board, refDate, hueOf };

  return (
    <>
      <h1>Master Board</h1>
      <div className="headrow">
        <p className="sub">
          {total} tasks · moving a card between columns <em>is</em> setting its priority — one
          field, nothing to synchronise
        </p>
        <ViewToggle base="/board" current={view} />
      </div>

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

      {view === 'kanban' ? <Kanban {...ctx} /> : <ListView {...ctx} />}

      <p className="note">
        A task whose date has arrived shows in Top Priority with a red edge, but its filed priority
        is untouched — reschedule it and it drops back where you put it. Completing a recurring task
        rolls its date forward by one interval and returns it to Recurring; it never reaches
        Completed.
      </p>
    </>
  );
}

type Ctx = {
  board: Record<Bucket, TaskView[]>;
  refDate: string;
  hueOf: (h: number | null) => string | null;
};

// ---------------------------------------------------------------------------
// Kanban
// ---------------------------------------------------------------------------

function Kanban({ board, refDate, hueOf }: Ctx) {
  return (
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
              <Card key={t.id} task={t} ref_={refDate} hue={hueOf(t.pillarHue)} bucket={key} />
            ))}

            {list.length > 14 && <p className="empty mono">+ {list.length - 14} more</p>}
          </section>
        );
      })}
    </div>
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
        {task.recurrence && <span className="chip rec">↻ {REC_LABEL[task.recurrence]}</span>}
        {task.dueDate && (
          <span className={`chip${overdue || surfaced ? ' due' : ''}`}>
            {overdue ? 'overdue ' : ''}{task.dueDate.slice(5)}
          </span>
        )}
        {surfaced && <span className="chip due">surfaced from {task.priority}</span>}
      </div>

      <div className="rowacts">
        <MoveSelect taskId={task.id} current={bucket} options={BUCKETS} onMove={moveTaskAction} />
        <DoneButton task={task} />
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

function ListView({ board, refDate, hueOf }: Ctx) {
  return (
    <div className="listwrap">
      <table className="list">
        <thead>
          <tr>
            <th>Task</th>
            <th>Pillar</th>
            <th>Due</th>
            <th>Repeats</th>
            <th>Column</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {BUCKETS.map(({ key, label }) => {
            const list = board[key] ?? [];
            return (
              <Fragmented key={key}>
                <tr className="grouprow">
                  <td colSpan={6}>
                    <span className="grouplab">
                      <span className="rail" style={{ background: RAIL[key] }} aria-hidden="true" />
                      <span className="t">{label}</span>
                      <span className="n mono">{list.length}</span>
                    </span>
                  </td>
                </tr>

                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="tmuted" style={{ fontSize: 12 }}>
                      Nothing here.
                    </td>
                  </tr>
                )}

                {list.map((t) => {
                  const surfaced = isSurfaced(t, refDate);
                  const overdue = isOverdue(t, refDate);
                  const done = t.status === 'done';
                  const hue = hueOf(t.pillarHue);
                  return (
                    <tr
                      key={t.id}
                      className={`${done ? 'isdone ' : ''}${surfaced ? 'issurfaced' : ''}`.trim()}
                    >
                      <td className="tname">{t.title}</td>
                      <td>
                        {t.pillarName ? (
                          <span className="chip pil" style={{ background: hue ?? 'var(--violet)' }}>
                            {t.pillarName}
                          </span>
                        ) : (
                          <span className="tmuted">—</span>
                        )}
                      </td>
                      <td className="tnum mono">
                        {t.dueDate ? (
                          <span style={overdue || surfaced ? { color: 'var(--crit)' } : undefined}>
                            {t.dueDate}
                          </span>
                        ) : (
                          <span className="tmuted">—</span>
                        )}
                      </td>
                      <td className="tnum">
                        {t.recurrence ? `↻ ${REC_LABEL[t.recurrence]}` : <span className="tmuted">—</span>}
                      </td>
                      <td>
                        <MoveSelect
                          taskId={t.id}
                          current={key}
                          options={BUCKETS}
                          onMove={moveTaskAction}
                        />
                        {surfaced && (
                          <span className="chip due" style={{ marginLeft: 6 }}>
                            from {t.priority}
                          </span>
                        )}
                      </td>
                      <td className="acts">
                        <DoneButton task={t} />
                      </td>
                    </tr>
                  );
                })}
              </Fragmented>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Grouping inside <tbody> needs a fragment that takes a key. */
function Fragmented({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DoneButton({ task }: { task: TaskView }) {
  if (task.status === 'done') {
    return (
      <form action={reopenTaskAction.bind(null, task.id)}>
        <button className="btn" type="submit">Reopen</button>
      </form>
    );
  }
  return (
    <form action={completeTaskAction.bind(null, task.id)}>
      <button className="btn" type="submit">
        {task.recurrence ? 'Roll forward' : 'Done'}
      </button>
    </form>
  );
}
