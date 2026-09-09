import Link from 'next/link';

export type ViewMode = 'kanban' | 'list';

/** Server-rendered — the view lives in the URL, so it survives a refresh. */
export default function ViewToggle({ base, current }: { base: string; current: ViewMode }) {
  const modes: { key: ViewMode; label: string }[] = [
    { key: 'kanban', label: 'Kanban' },
    { key: 'list', label: 'List' },
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
  return v === 'list' ? 'list' : 'kanban';
}
