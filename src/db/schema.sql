-- Arc schema.
--
-- Written in portable SQL so the move to Supabase Postgres is a driver swap
-- rather than a rewrite. The only SQLite-isms are TEXT primary keys (fine in
-- Postgres) and INTEGER booleans (Postgres: BOOLEAN).

CREATE TABLE IF NOT EXISTS aim (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT,
  year        INTEGER NOT NULL
);

-- A pillar cannot exist without a parent aim. The prism does not split light
-- into different lights; it reveals what the white light was already made of.
CREATE TABLE IF NOT EXISTS pillar (
  id          TEXT PRIMARY KEY,
  aim_id      TEXT NOT NULL REFERENCES aim(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  affirmation TEXT NOT NULL,
  stars       INTEGER NOT NULL DEFAULT 3 CHECK (stars BETWEEN 1 AND 5),
  hue_order   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS goal (
  id              TEXT PRIMARY KEY,
  pillar_id       TEXT NOT NULL REFERENCES pillar(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  progress_mode   TEXT NOT NULL DEFAULT 'rollup'
                    CHECK (progress_mode IN ('rollup','metric','manual')),
  target          REAL,
  manual_progress REAL,
  closed_at       TEXT
);

-- Metric goals log a value per tap. Never a field to keep up to date: the
-- four Target/Progress columns on the Monday board were filled on 0 of 37 goals.
CREATE TABLE IF NOT EXISTS metric_entry (
  id        TEXT PRIMARY KEY,
  goal_id   TEXT NOT NULL REFERENCES goal(id) ON DELETE CASCADE,
  value     REAL NOT NULL,
  logged_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS board (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  view_type  TEXT NOT NULL DEFAULT 'priority'
               CHECK (view_type IN ('priority','stage'))
);

-- priority IS the board column. There is no second field to synchronise, which
-- is why eleven of the Monday automations have no equivalent here.
CREATE TABLE IF NOT EXISTS task (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  priority   TEXT CHECK (priority IN ('top','high','low','recurring','parking')),
  status     TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','in_progress','ready','stuck','done')),
  due_date   TEXT,
  recurrence TEXT CHECK (recurrence IN
               ('daily','weekly','biweekly','monthly','bimonthly','yearly')),
  pillar_id  TEXT REFERENCES pillar(id) ON DELETE SET NULL,
  goal_id    TEXT REFERENCES goal(id) ON DELETE SET NULL,
  assignee   TEXT,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subtask (
  id       TEXT PRIMARY KEY,
  task_id  TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  title    TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  phase    TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS song (
  id       TEXT PRIMARY KEY,
  title    TEXT NOT NULL,
  stage    TEXT CHECK (stage IN
             ('backlog','demo','tracking','mix_master','planning','released')),
  assignee TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS song_subtask (
  id       TEXT PRIMARY KEY,
  song_id  TEXT NOT NULL REFERENCES song(id) ON DELETE CASCADE,
  title    TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  phase    TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

-- Multi-homing: one task, many boards. Each row stores only where the card
-- sits on that board. Status, dates and subtasks stay on the task, so there is
-- nothing to mirror and nothing to keep in step.
CREATE TABLE IF NOT EXISTS task_board (
  task_id  TEXT NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  board_id TEXT NOT NULL REFERENCES board(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (task_id, board_id)
);

-- The generic edge. Cheap now, expensive to retrofit: when note capture
-- arrives, notes link through this same table instead of needing a migration.
CREATE TABLE IF NOT EXISTS link (
  from_type TEXT NOT NULL,
  from_id   TEXT NOT NULL,
  to_type   TEXT NOT NULL,
  to_id     TEXT NOT NULL,
  PRIMARY KEY (from_type, from_id, to_type, to_id)
);

CREATE INDEX IF NOT EXISTS idx_task_priority ON task(priority);
CREATE INDEX IF NOT EXISTS idx_task_due      ON task(due_date);
CREATE INDEX IF NOT EXISTS idx_task_pillar   ON task(pillar_id);
CREATE INDEX IF NOT EXISTS idx_goal_pillar   ON goal(pillar_id);
CREATE INDEX IF NOT EXISTS idx_subtask_task  ON subtask(task_id);
CREATE INDEX IF NOT EXISTS idx_songsub_song  ON song_subtask(song_id);
CREATE INDEX IF NOT EXISTS idx_link_to       ON link(to_type, to_id);
