import { bandColor, toHex } from '@/domain/rules';
import type { PillarView } from '@/lib/queries';

/**
 * The Prism of Destiny.
 *
 * One white beam enters from above. The prism doesn't split it into different
 * lights — it reveals what the white light was already made of, which is the
 * exact relationship between the aim and the pillars beneath it.
 *
 * Each band lands on a pillar, capped with the Auvora arch. How high the colour
 * climbs is that pillar's completed work; the dashed line is where it would
 * reach if it matched how far along you feel. The space between is the gap.
 *
 * Colour orients, it never identifies: five hues inside a pink-to-cyan spectrum
 * cannot be told apart reliably (the magenta and violet stops separate by only
 * ΔE 2.6 under protanopia), so every pillar is named and the numbers sit beside
 * the name.
 */
export default function Prism({ pillars }: { pillars: PillarView[] }) {
  const W = 640;
  const BASE = 386;      // floor the pillars stand on
  const APEX = 176;      // top of the tallest arch
  const COL_W = 88;
  const R = COL_W / 2;
  const SHOULDER = APEX + R;   // where the arch curve meets the straight sides
  const PRISM_Y = 92;          // base of the prism
  const n = pillars.length;

  const span = W / n;
  const cx = (i: number) => span * i + span / 2;
  const at = (i: number) => (n <= 1 ? 0.5 : i / (n - 1));

  /** An arch: straight sides, semicircular cap. The Auvora mark, standing up. */
  const arch = (c: number) => {
    const l = c - R;
    const r = c + R;
    return `M ${l} ${BASE} L ${l} ${SHOULDER} A ${R} ${R} 0 0 1 ${r} ${SHOULDER} L ${r} ${BASE} Z`;
  };

  /** Height of the colour inside a pillar, as a y coordinate. */
  const level = (pct: number) => BASE - ((BASE - APEX) * Math.max(0, Math.min(100, pct))) / 100;

  return (
    <svg
      className="prism"
      viewBox={`0 0 ${W} 470`}
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
        <linearGradient id="whitebeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="60%" stopColor="#e8e0ff" stopOpacity=".85" />
          <stop offset="100%" stopColor="#c9b6ff" stopOpacity=".95" />
        </linearGradient>

        <radialGradient id="glow">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="100%" stopColor="#8356ff" stopOpacity="0" />
        </radialGradient>

        <linearGradient id="prismface" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fc7ad8" stopOpacity=".16" />
          <stop offset="50%" stopColor="#8356ff" stopOpacity=".22" />
          <stop offset="100%" stopColor="#3dc6ff" stopOpacity=".16" />
        </linearGradient>

        {pillars.map((p, i) => {
          const hex = toHex(bandColor(at(p.hueOrder)));
          return (
            <linearGradient key={`g${p.id}`} id={`fill${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={hex} stopOpacity=".95" />
              <stop offset="100%" stopColor={hex} stopOpacity=".42" />
            </linearGradient>
          );
        })}

        {pillars.map((p, i) => {
          const hex = toHex(bandColor(at(p.hueOrder)));
          return (
            <linearGradient key={`b${p.id}`} id={`beam${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={hex} stopOpacity=".55" />
              <stop offset="100%" stopColor={hex} stopOpacity=".12" />
            </linearGradient>
          );
        })}

        {pillars.map((p, i) => (
          <clipPath key={`c${p.id}`} id={`clip${i}`}>
            <path d={arch(cx(p.hueOrder))} />
          </clipPath>
        ))}
      </defs>

      {/* The white light, before it is anything in particular. */}
      <circle cx={W / 2} cy={PRISM_Y - 26} r={54} fill="url(#glow)" />
      <rect x={W / 2 - 5} y={0} width={10} height={PRISM_Y - 34} fill="url(#whitebeam)" />
      <text
        x={W / 2} y={18} textAnchor="middle" fontSize="9" fontWeight="700"
        letterSpacing="1.8" fill="currentColor" opacity=".45"
      >
        THE CORE
      </text>

      {/* The prism. */}
      <polygon
        points={`${W / 2},${PRISM_Y - 36} ${W / 2 - 34},${PRISM_Y} ${W / 2 + 34},${PRISM_Y}`}
        fill="url(#prismface)"
        stroke="#8356ff"
        strokeOpacity=".5"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Refracted bands, fanning down onto the pillars. */}
      {pillars.map((p, i) => {
        const c = cx(p.hueOrder);
        const spread = 11;
        return (
          <polygon
            key={`beam-${p.id}`}
            points={`${W / 2 - spread},${PRISM_Y} ${W / 2 + spread},${PRISM_Y} ${c + R - 6},${APEX} ${c - R + 6},${APEX}`}
            fill={`url(#beam${i})`}
          />
        );
      })}

      {pillars.map((p, i) => {
        const c = cx(p.hueOrder);
        const fillY = level(p.progress);
        // Clamp the felt mark to the shoulder so a 5-star pillar reads as a line
        // across the column rather than a dash floating up in the arch's crown.
        const feltY = Math.max(level(p.felt), SHOULDER);
        return (
          <g key={p.id}>
            {/* The empty pillar. */}
            <path d={arch(c)} fill="currentColor" opacity=".05" />

            {/* Filled to completed work. */}
            <g clipPath={`url(#clip${i})`}>
              <rect x={c - R} y={fillY} width={COL_W} height={BASE - fillY} fill={`url(#fill${i})`} />
            </g>

            {/* Where it would reach if it matched how far along you feel. */}
            <line
              x1={c - R - 5} y1={feltY} x2={c + R + 5} y2={feltY}
              stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity=".5"
            />

            <path d={arch(c)} fill="none" stroke="currentColor" strokeOpacity=".14" />

            <text
              x={c} y={fillY + 20} textAnchor="middle" fontSize="15" fontWeight="700"
              fill="#ffffff" opacity={p.progress > 12 ? 0.95 : 0}
            >
              {p.progress}%
            </text>

            <text
              x={c} y={BASE + 22} textAnchor="middle" fontSize="11.5" fontWeight="700"
              fill="currentColor" opacity=".85"
            >
              {p.name}
            </text>
            <text
              x={c} y={BASE + 38} textAnchor="middle" fontSize="10" fontWeight="600"
              fill="currentColor" opacity=".45"
              fontFamily="'JetBrains Mono', ui-monospace, monospace"
            >
              {p.goalsDone}/{p.goalsTotal} · felt {p.felt}
            </text>
          </g>
        );
      })}

      {/* The floor the pillars stand on. */}
      <line
        x1={16} y1={BASE} x2={W - 16} y2={BASE}
        stroke="currentColor" strokeOpacity=".16" strokeWidth="1"
      />
    </svg>
  );
}
