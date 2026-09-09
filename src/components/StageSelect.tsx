'use client';

import { useTransition } from 'react';
import type { SongStage } from '@/domain/types';

/**
 * Assign a stage. Doing so appends that stage's checklist and backfills any
 * earlier stage the song skipped — the four subitem-creating recipes on the
 * Monday board, as one operation.
 */
export default function StageSelect({
  songId, current, options, onSet, advanceTo, advanceLabel,
}: {
  songId: string;
  current: SongStage | null;
  options: { key: SongStage; label: string }[];
  onSet: (songId: string, stage: SongStage) => Promise<void>;
  advanceTo?: SongStage;
  advanceLabel?: string;
}) {
  const [pending, start] = useTransition();

  if (advanceTo) {
    return (
      <button
        className="btn advance"
        disabled={pending}
        onClick={() => start(() => { void onSet(songId, advanceTo); })}
      >
        {advanceLabel}
      </button>
    );
  }

  return (
    <select
      aria-label="Stage"
      value={current ?? ''}
      disabled={pending}
      style={{ marginTop: 6, width: '100%' }}
      onChange={(e) => {
        const v = e.target.value as SongStage;
        if (!v) return;
        start(() => { void onSet(songId, v); });
      }}
    >
      <option value="">No stage</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  );
}
