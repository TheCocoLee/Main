import Link from 'next/link';

export type ViewMode = 'kanban' | 'list';

/**
 * The view a board opens on when the URL says nothing.
 *
 * List, because the columns are lopsided — 40 of 72 tasks sit in the Parking
 * Lot and 20 of 32 songs in Backlog. Kanban truncates a column that long, so
 * the default view would hide most of the board.
 */
export const DEFAULT_VIEW: ViewMode = 'list';

/** Server-rendered — the view lives in the URL, so it survives a refresh. */
export default function ViewToggle({ base, current }: { base: string; current: ViewMode }) {
  const modes: { key: ViewMode; label: string }[] = [
    { key: 'list', label: 'List' },
    { key: 'kanban', label: 'Kanban' },
  ];
  return (
    <div className="vtoggle" role="group" aria-label="View">
      {modes.map((m) => (
        <Link
          key={m.key}
          href={`${base}?view=${m.key}`}
          className={current === m.key ? 'on' : undefined}
          aria-current={current === m.key ? 'true' : undefined}
        >
          {m.label}
        </Link>
      ))}
    </div>
  );
}

export function parseView(v: string | string[] | undefined): ViewMode {
  if (v === 'list') return 'list';
  if (v === 'kanban') return 'kanban';
  return DEFAULT_VIEW;
}
