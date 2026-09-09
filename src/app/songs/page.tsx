import StageSelect from '@/components/StageSelect';
import SubtaskToggle from '@/components/SubtaskToggle';
import { setSongStageAction, toggleSongSubtaskAction, createSongAction } from '../actions';
import { STAGE_LABELS, STAGE_TEMPLATES } from '@/domain/rules';
import { getSongs } from '@/lib/queries';
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

export default function SongsPage() {
  const songs = getSongs();
  const columns: { key: string; label: string }[] = [
    { key: 'unassigned', label: 'Unassigned' },
    ...SONG_STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s] })),
  ];

  const focus = songs.find((s) => s.stage === 'tracking') ?? songs.find((s) => s.total > 0);
  const released = songs.find((s) => s.stage === 'released');

  return (
    <>
      <h1>Song Production</h1>
      <p className="sub">
        {songs.length} songs · assigning a stage creates that stage&rsquo;s checklist and backfills
        anything skipped — nothing is ever removed
      </p>

      <form action={createSongAction} className="newform">
        <input name="title" placeholder="New song — no stage until you assign one" />
        <button className="btn" type="submit">Add</button>
      </form>

      <div className="kan">
        {columns.map((c) => {
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
                    options={SONG_STAGES.map((st) => ({ key: st, label: STAGE_LABELS[st] }))}
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
