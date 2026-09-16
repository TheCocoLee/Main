import StageSelect from '@/components/StageSelect';
import SubtaskToggle from '@/components/SubtaskToggle';
import ViewToggle, { parseView, type ViewMode } from '@/components/ViewToggle';
import { setSongStageAction, toggleSongSubtaskAction, createSongAction } from '../actions';
import { STAGE_LABELS, STAGE_TEMPLATES } from '@/domain/rules';
import { getSongs, type SongView } from '@/lib/queries';
import { SONG_STAGES, type SongStage } from '@/domain/types';

export const dynamic = 'force-dynamic';

const STRIPE: Record<string, string> = {
  unassigned: 'var(--line-2)',
  backlog: 'var(--line-2)',
  demo: '#fc7ad8',
  tracking: '#cb6ce8',
  mix_master: '#9b5df7',
  planning: '#6b7dff',
  released: '#3dc6ff',
};

const COLUMNS: { key: string; label: string }[] = [
  { key: 'unassigned', label: 'Unassigned' },
  ...SONG_STAGES.map((s) => ({ key: s as string, label: STAGE_LABELS[s] })),
];

const STAGE_OPTS = SONG_STAGES.map((st) => ({ key: st, label: STAGE_LABELS[st] }));

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const view: ViewMode = parseView((await searchParams).view);
  const songs = await getSongs();

  const focus = songs.find((s) => s.stage === 'tracking') ?? songs.find((s) => s.total > 0);
  const released = songs.find((s) => s.stage === 'released');

  return (
    <>
      <h1>Song Production</h1>
      <div className="headrow">
        <p className="sub">
          {songs.length} songs · assigning a stage creates that stage&rsquo;s checklist and
          backfills anything skipped — nothing is ever removed
        </p>
        <ViewToggle base="/songs" current={view} />
      </div>

      <form action={createSongAction} className="newform">
        <input name="title" placeholder="New song — no stage until you assign one" />
        <button className="btn" type="submit">Add</button>
      </form>

      {view === 'kanban' ? <Kanban songs={songs} /> : <ListView songs={songs} />}

      <div className="detail">
        {[focus, released].filter(Boolean).map((s) => (
          <div key={s!.id}>
            <h2 style={{ fontSize: 15 }}>{s!.title}</h2>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 0' }}>
              {s!.stage ? STAGE_LABELS[s!.stage] : 'Unassigned'} · {s!.done}/{s!.total}
            </p>
            {SONG_STAGES.filter((st) => STAGE_TEMPLATES[st].length > 0).map((st) => {
              const items = s!.subtasks.filter((x) => x.phase === st);
              if (items.length === 0) return null;
              return (
                <div key={st}>
                  <div className="phase-lb">{STAGE_LABELS[st]}</div>
                  <div className="checks">
                    {items.map((x) => (
                      <SubtaskToggle
                        key={x.id}
                        id={x.id}
                        title={x.title}
                        done={x.done}
                        onToggle={toggleSongSubtaskAction}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="note">
        Advancing is offered, never automatic — a song only proposes its next stage once the current
        stage is fully checked. Two songs on the Monday board sit in the Released group with a stage
        of Scheduled; a confirm step is what stops that drift.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------

function Kanban({ songs }: { songs: SongView[] }) {
  return (
    <div className="kan">
      {COLUMNS.map((c) => {
        const list = songs.filter((s) => (s.stage ?? 'unassigned') === c.key);
        return (
          <section className="kcol" key={c.key}>
            <div className="kstripe" style={{ background: STRIPE[c.key] }} aria-hidden="true" />
            <header className="col-h">
              <span className="t">{c.label}</span>
              <span className="n mono">{list.length}</span>
            </header>

            {list.length === 0 && <div className="empty">Empty</div>}

            {list.slice(0, 8).map((s) => (
              <article className="song" key={s.id}>
                <div className="st">{s.title}</div>
                {s.total > 0 && (
                  <>
                    <div className="meta mono">{s.done} / {s.total}</div>
                    <div className="bar"><i style={{ width: `${s.pct}%` }} /></div>
                  </>
                )}
                <StageSelect
                  songId={s.id}
                  current={s.stage}
                  options={STAGE_OPTS}
                  onSet={setSongStageAction}
                />
                {s.canAdvanceTo && (
                  <StageSelect
                    songId={s.id}
                    current={s.stage}
                    advanceTo={s.canAdvanceTo}
                    advanceLabel={`Advance to ${STAGE_LABELS[s.canAdvanceTo]}`}
                    options={[]}
                    onSet={setSongStageAction}
                  />
                )}
              </article>
            ))}

            {list.length > 8 && <p className="empty mono">+ {list.length - 8} more</p>}
          </section>
        );
      })}
    </div>
  );
}

function ListView({ songs }: { songs: SongView[] }) {
  return (
    <div className="listwrap">
      <table className="list">
        <thead>
          <tr>
            <th>Song</th>
            <th>Progress</th>
            <th>Stage</th>
            <th>Next</th>
          </tr>
        </thead>
        <tbody>
          {COLUMNS.map((c) => {
            const list = songs.filter((s) => (s.stage ?? 'unassigned') === c.key);
            return (
              <Fragmented key={c.key}>
                <tr className="grouprow">
                  <td colSpan={4}>
                    <span className="grouplab">
                      <span
                        className="rail"
                        style={{ background: STRIPE[c.key] }}
                        aria-hidden="true"
                      />
                      <span className="t">{c.label}</span>
                      <span className="n mono">{list.length}</span>
                    </span>
                  </td>
                </tr>

                {list.length === 0 && (
                  <tr>
                    <td colSpan={4} className="tmuted" style={{ fontSize: 12 }}>
                      Nothing here.
                    </td>
                  </tr>
                )}

                {list.map((s) => (
                  <tr key={s.id}>
                    <td className="tname">{s.title}</td>
                    <td style={{ minWidth: 150 }}>
                      {s.total > 0 ? (
                        <>
                          <span className="tnum mono" style={{ fontSize: 11.5 }}>
                            {s.done} / {s.total}
                          </span>
                          <span className="bar" style={{ display: 'block', marginTop: 4 }}>
                            <i style={{ width: `${s.pct}%` }} />
                          </span>
                        </>
                      ) : (
                        <span className="tmuted">—</span>
                      )}
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <StageSelect
                        songId={s.id}
                        current={s.stage}
                        options={STAGE_OPTS}
                        onSet={setSongStageAction}
                      />
                    </td>
                    <td className="acts">
                      {s.canAdvanceTo ? (
                        <StageSelect
                          songId={s.id}
                          current={s.stage}
                          advanceTo={s.canAdvanceTo}
                          advanceLabel={`Advance to ${STAGE_LABELS[s.canAdvanceTo]}`}
                          options={[]}
                          onSet={setSongStageAction}
                        />
                      ) : (
                        <span className="tmuted" style={{ fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </Fragmented>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Fragmented({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
