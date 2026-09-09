'use client';

import { useTransition } from 'react';

export default function SubtaskToggle({
  id, title, done, onToggle,
}: {
  id: string;
  title: string;
  done: boolean;
  onToggle: (id: string) => Promise<void>;
}) {
  const [pending, start] = useTransition();

  return (
    <div className={`chk${done ? ' on' : ''}`}>
      <button
        type="button"
        disabled={pending}
        aria-pressed={done}
        onClick={() => start(() => { void onToggle(id); })}
      >
        <span className="box" aria-hidden="true" />
        <span>{title}</span>
      </button>
    </div>
  );
}
