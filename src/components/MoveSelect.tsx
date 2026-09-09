'use client';

import { useTransition } from 'react';
import type { Bucket } from '@/domain/types';

/**
 * Changing this select is the move — the whole operation. Because priority and
 * board column are one field, there is no second write afterwards and nothing
 * that can fall out of step.
 */
export default function MoveSelect({
  taskId,
  current,
  options,
  onMove,
}: {
  taskId: string;
  current: Bucket;
  options: { key: Bucket; label: string }[];
  onMove: (taskId: string, to: Bucket) => Promise<void>;
}) {
  const [pending, start] = useTransition();

  return (
    <select
      aria-label="Move to column"
      value={current}
      disabled={pending}
      onChange={(e) => {
        const to = e.target.value as Bucket;
        start(() => {
          void onMove(taskId, to);
        });
      }}
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
