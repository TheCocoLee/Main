# Arc

One aim, refracted into five pillars, recombined by the work you finish.

A replacement for the Monday.com boards at `thecocolee.monday.com` — the Coco
Master Board, 2026 Goals, and song production — unified onto one spine.

## Running it

```bash
npm install
npm run seed     # loads the real board contents into arc.db
npm run dev      # http://localhost:3000
npm test         # domain rules
```

## The three screens

- **`/`** — the Prism. One aim at the centre, five bands reaching out by
  completed work, dashed outlines showing how far along you feel. The space
  between is the gap.
- **`/board`** — the Master Board. Seven columns, `priority` doubling as the
  column, tasks carrying their pillar.
- **`/songs`** — Song Production. Six stages, each contributing its checklist.

## What replaced the automations

Sixty-five automations across two boards collapse into `src/domain/rules.ts`
plus one field rename. Most of them existed to compensate for redundant state
rather than to express behaviour.

| Monday | Count | Arc |
|---|---|---|
| Sync a status column to the group that duplicates it | 19 | Nothing — `priority` **is** the column |
| Hand-rolled recurrence recipes + a 5-condition guard | 7 | `completeTask()` |
| "When date arrives, move item to Top Priority" | 3 | `bucketFor()` — derived, non-destructive |
| Subitem rollups | 3 | `rollupStatus()` |
| Group-scoped creation defaults | 5 | Board config |
| Stage → create subitems | 4 | `subtasksForStage()` |

Three behaviours differ deliberately from the originals:

1. **Date surfacing is derived, not a move.** Monday physically moved the item,
   so it kept its new priority forever and the original filing was lost. Here a
   due task appears in Top Priority with a red edge and a "surfaced from parking"
   chip; reschedule it and it drops back where you filed it.
2. **Recurring tasks roll forward from their due date, not from today** — a
   weekly review ticked off two days late keeps its weekday.
3. **Stage advance is offered, never automatic.** Two songs currently sit in the
   Released group with a stage of Scheduled; a confirm step is what stops that.

## Data model

`aim → pillar → goal → task → subtask`, plus two joins that matter:

- **`task_board`** — multi-homing. One task, many boards; each row stores only
  where the card sits on that board. This is what replaces four board-relation
  columns, five mirror columns and two nested `IF` chains.
- **`link`** — the generic edge, `(from_type, from_id, to_type, to_id)`. Cheap
  now, expensive to retrofit: when note capture arrives, notes link through this
  same table instead of needing a migration.

Goals declare how they measure themselves — `rollup`, `metric` or `manual` —
because the four Target/Progress columns on the Monday board were filled on
**0 of 37 goals**. Metric goals log a timestamped value per tap rather than
carrying a field to maintain.

## Storage

SQLite via `better-sqlite3`, schema in `src/db/schema.sql` written in portable
SQL. Moving to Supabase Postgres is a driver swap: `TEXT` keys carry over,
`INTEGER` booleans become `BOOLEAN`.
