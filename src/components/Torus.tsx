import { bandColor, toHex } from '@/domain/rules';
import type { PillarView } from '@/lib/queries';

/**
 * The torus.
 *
 * A prism runs one direction — an apparatus, used once. A torus is the whole
 * cycle: the outbreath from white into colour, the work lived out at the
 * coloured circumference, and the return inward to white. Planning and progress
 * are not two phases here; they are the same flow at different points on one
 * surface.
 *
 * Each band is a pillar. The solid reach is that pillar's completed work; the
 * dashed outline is where it would reach if it matched how far along you feel.
 * The empty space between them is the gap — the useful part.
 *
 * Colour orients, it never identifies: five hues inside a pink-to-cyan spectrum
 * cannot be told apart reliably, so every band is named and the numbers sit in
 * the legend beside it.
 */
export default function Torus({ pillars }: { pillars: PillarView[] }) {
  const CX = 300;
  const CY = 296;
  const R_MAX = 176;
  const R_MIN = 62;
  const R_LABEL = R_MAX + 30;
  const n = pillars.length;

  const at = (i: number) => (n <= 1 ? 0.5 : i / (n - 1));
  const radius = (pct: number) => R_MIN + (R_MAX - R_MIN) * (pct / 100);

  // Fan across the upper half; the dashed underside carries the flow back in.
  const START = Math.PI * 1.04;
  const SWEEP = Math.PI * 0.92;
  const HALF = SWEEP / (n * 1.9);

  const pt = (r: number, a: number): [number, number] => [
    CX + r * Math.cos(a),
    CY + r * Math.sin(a),
  ];

  const petal = (angle: number, r: number) => {
    const [tx, ty] = pt(r, angle);
    const [c1x, c1y] = pt(r * 0.72, angle - HALF);
    const [c2x, c2y] = pt(r * 0.72, angle + HALF);
    return `M ${CX} ${CY} Q ${c1x} ${c1y} ${tx} ${ty} Q ${c2x} ${c2y} ${CX} ${CY} Z`;
  };

  return (
    <svg
      className="torus"
      viewBox="0 0 600 360"
      role="img"
      aria-label={
        `One aim refracted into ${n} pillars. ` +
        pillars
          .map((p) => `${p.name}: ${p.progress} per cent of goals closed, felt ${p.felt}`)
          .join('. ') +
        '.'
      }
    >
      <defs>
        <radialGradient id="core">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".98" />
          <stop offset="45%" stopColor="#c8b6ff" stopOpacity=".5" />
          <stop offset="100%" stopColor="#8356ff" stopOpacity="0" />
        </radialGradient>
        {pillars.map((p, i) => {
          const hex = toHex(bandColor(at(p.hueOrder)));
          return (
            <radialGradient
              key={p.id}
              id={`band${i}`}
              gradientUnits="userSpaceOnUse"
              cx={CX}
              cy={CY}
              r={R_MAX}
            >
              <stop offset="0%" stopColor={hex} stopOpacity=".18" />
              <stop offset="100%" stopColor={hex} stopOpacity=".88" />
            </radialGradient>
          );
        })}
      </defs>

      {/* Where each band would reach if closed work matched felt progress. */}
      {pillars.map((p) => (
        <path
          key={`ghost-${p.id}`}
          d={petal(START + SWEEP * at(p.hueOrder), radius(p.felt))}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity=".33"
        />
      ))}

      {pillars.map((p, i) => (
        <path
          key={p.id}
          d={petal(START + SWEEP * at(p.hueOrder), radius(p.progress))}
          fill={`url(#band${i})`}
        />
      ))}

      {/* The return: colour flowing back inward to white. */}
      <path
        d={`M ${CX - R_MAX * 0.95} ${CY + 4}
            A ${R_MAX * 0.95} ${R_MAX * 0.46} 0 0 0 ${CX + R_MAX * 0.95} ${CY + 4}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 6"
        opacity=".28"
      />

      <circle cx={CX} cy={CY} r={66} fill="url(#core)" />
      <circle cx={CX} cy={CY} r={15} fill="#ffffff" stroke="#8356ff" strokeOpacity=".4" />

      <text x={CX} y={CY + 40} textAnchor="middle" fontSize="9"
            fontWeight="700" letterSpacing="1.7" fill="currentColor" opacity=".5">
        THE CORE
      </text>

      {/* Labels sit beyond every band, so they can never collide with one. */}
      {pillars.map((p) => {
        const a = START + SWEEP * at(p.hueOrder);
        const [x, y] = pt(R_LABEL, a);
        const c = Math.cos(a);
        const anchor = c < -0.34 ? 'end' : c > 0.34 ? 'start' : 'middle';
        return (
          <g key={`l-${p.id}`}>
            <text x={x} y={y} textAnchor={anchor} fontSize="10.5" fontWeight="700"
                  fill="currentColor" opacity=".82">
              {p.name}
            </text>
            <text x={x} y={y + 12} textAnchor={anchor} fontSize="9.5" fontWeight="600"
                  fill="currentColor" opacity=".45"
                  fontFamily="'JetBrains Mono', ui-monospace, monospace">
              {p.progress}% · felt {p.felt}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
