import Torus from '@/components/Torus';
import { bandColor, toHex } from '@/domain/rules';
import { getAim, getPillars, getRecombined } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default function PrismPage() {
  const pillars = getPillars();
  const aim = getAim();
  const { now, balanced } = getRecombined();

  const at = (i: number) => (pillars.length <= 1 ? 0.5 : i / (pillars.length - 1));
  const widest = [...pillars].sort((a, b) => b.gap - a.gap).slice(0, 2);
  const carrying = [...pillars].sort((a, b) => b.progress - a.progress)[0];

  return (
    <>
      <h1>
        One aim, refracted into five pillars, <span className="grad">recombined by the work you finish.</span>
      </h1>
      <p className="sub">{aim?.title}</p>

      <div className="torus-wrap">
        <Torus pillars={pillars} />

        <div>
          <div className="legend">
            {pillars.map((p) => {
              const hex = toHex(bandColor(at(p.hueOrder)));
              const cls = p.gap >= 50 ? 'hi' : p.gap >= 15 ? 'mid' : 'lo';
              return (
                <div className="lrow" key={p.id}>
                  <span className="swatch" style={{ background: hex }} aria-hidden="true" />
                  <span className="lname">
                    {p.name}
                    <small>{'★'.repeat(p.stars)}{'☆'.repeat(5 - p.stars)} felt {p.felt}</small>
                  </span>
                  <span className="lnum mono">
                    {p.progress}% · {p.goalsDone}/{p.goalsTotal}
                  </span>
                  <span className={`lgap ${cls}`}>
                    {p.gap > 0 ? '+' : ''}{p.gap}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="recomb">
            <div className="chip-col">
              <i style={{ background: now }} />
              <b className="mono">{now}</b>
              <em>Now</em>
            </div>
            <div className="chip-col">
              <i style={{ background: balanced }} />
              <b className="mono">{balanced}</b>
              <em>Balanced</em>
            </div>
            <p>
              {carrying.name} is carrying the beam at {carrying.progress}%, while{' '}
              {widest.map((p) => p.name).join(' and ')} sit widest between what you feel and what
              you&rsquo;ve closed. A glance, not a measurement — the numbers are beside it.
            </p>
          </div>
        </div>
      </div>

      <div className="detail">
        {pillars.map((p) => (
          <div key={p.id}>
            <h2 style={{ fontSize: 14 }}>{p.name}</h2>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', margin: '6px 0 0' }}>
              {p.affirmation}
            </p>
          </div>
        ))}
      </div>

      <p className="note">
        Band reach is goals closed — computed, never entered. The dashed mark is your star rating on
        the same scale. Where they disagree is the useful part: either the goals under that pillar
        are the wrong goals, or you are further along than the checkboxes know.
      </p>
    </>
  );
}
