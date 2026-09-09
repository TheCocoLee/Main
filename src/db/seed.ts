/**
 * Seed Arc with the real contents of thecocolee.monday.com.
 *
 * Sources:
 *   2026 Goals        (18393288742) — 45 items: 3 Core docs, 5 affirmations, 37 goals
 *   Coco Master Board (5760118855)  — 134 items
 *   song production   (18388779476) — 31 songs
 */

import { getDb, id } from './index';
import { STAGE_TEMPLATES } from '../domain/rules';
import { SONG_STAGES, type SongStage } from '../domain/types';

const db = getDb();

db.exec(`
  DELETE FROM link; DELETE FROM task_board; DELETE FROM song_subtask;
  DELETE FROM subtask; DELETE FROM song; DELETE FROM task;
  DELETE FROM metric_entry; DELETE FROM goal; DELETE FROM pillar;
  DELETE FROM board; DELETE FROM aim;
`);

const NOW = new Date().toISOString();

// --- the white light --------------------------------------------------------

const AIM = 'aim_2026';
db.prepare('INSERT INTO aim (id,title,body,year) VALUES (?,?,?,?)').run(
  AIM,
  'My Macro Vision + Definite Chief Aim',
  'The one aim the five pillars decompose. Held in The Core alongside 2026 Main Focus and My Ideal Week.',
  2026,
);

// --- pillars ----------------------------------------------------------------

const PILLARS: [string, string, string, number, number][] = [
  ['p_career', 'Career',
    'I am a trusted executive leader who scales systems, people, and outcomes at the highest level.', 4, 0],
  ['p_wealth', 'Ownership & Wealth',
    'I am a Moral Millionaire who builds ethical wealth with ease and inspires the world through ideas, creativity, and leadership.', 4, 1],
  ['p_music', 'Music',
    'I am building a world-class music project that is on a clear path to touring arenas and major festivals worldwide.', 5, 2],
  ['p_brand', 'Personal Brand',
    'I document my journey with clarity and honesty, attracting opportunity through authenticity.', 3, 3],
  ['p_health', 'Health & Life',
    'I am healthy, grounded, and supported by an environment that amplifies my life.', 5, 4],
];

const insPillar = db.prepare(
  'INSERT INTO pillar (id,aim_id,name,affirmation,stars,hue_order) VALUES (?,?,?,?,?,?)',
);
for (const [pid, name, aff, stars, hue] of PILLARS) {
  insPillar.run(pid, AIM, name, aff, stars, hue);
}

// --- goals (37, exactly as they sit on the board) ---------------------------

type G = [string, string, boolean, ('rollup' | 'metric' | 'manual')?, number?];

const GOALS: Record<string, G[]> = {
  p_career: [
    ['g_dept', 'Become Department Head', true],
    ['g_slt', 'Join Senior Leadership Team', false],
    ['g_vp', 'Position Clearly for VP/CDO path', true],
    ['g_comp', 'Increase Total Comp to $200k+', true, 'metric', 200000],
  ],
  p_wealth: [
    ['g_auv_all', 'Go All-in on Auvora', false],
    ['g_auv_10k', 'Achieve First $10k Month w/ Auvora', false, 'metric', 10000],
    ['g_auv_cons', 'Reach Consistent $10k Months w/ Auvora', false],
    ['g_debt', 'Eliminate Consumer Debt (~$19k CAD)', true, 'metric', 19000],
    ['g_invest', 'Begin Investing System', true],
    ['g_wealthpath', 'Clarify Long-Term Wealth Path', true],
    ['g_networth', '$100k Networth', false, 'metric', 100000],
    ['g_firstapp', 'Build First App (Auvora Demo)', false],
  ],
  p_music: [
    ['g_eg_launch', 'Officially Launch Edenglass', true],
    ['g_10k_list', 'Reach 10k Monthly Listeners', true, 'metric', 10000],
    ['g_cadence', 'Establish Consistent Release Cadence', true],
    ['g_eg_social', 'Grow Edenglass Social Presence', false],
    ['g_namm', 'Attend NAMM', false],
    ['g_50k_list', 'Reach 50k Monthly Listeners', false, 'metric', 50000],
    ['g_mv', 'Launch First Music Video', false],
    ['g_show', 'Play First Show', false],
    ['g_merch', 'Sell First Merch', false],
  ],
  p_brand: [
    ['g_pb_launch', 'Launch Personal Brand', true],
    ['g_post', 'Post Consistently (1x a Day)', false, 'manual'],
    ['g_audience', 'Grow Audience', false],
    ['g_inbound', 'Create Inbound Opportunities', false],
    ['g_align', 'Align with Edenglass and Auvora', true],
  ],
  p_health: [
    ['g_train', 'Train 4-5x a Week', false, 'manual'],
    ['g_cut', 'Cut 10-15lbs', false, 'metric', 15],
    ['g_meditate', 'Meditate 4-5 Days a Week', false, 'manual'],
    ['g_studio', 'Move into a Space w/ Dedicated Studio', true],
    ['g_dog', 'Expand Family (Dog) w/ Amber', true],
    ['g_amber', 'Protect & Grow Relationship w/ Amber', false, 'manual'],
    ['g_bible', 'Read Entire Bible (About 4 Pages a Day)', false, 'metric', 1189],
    ['g_disney', 'Disneyworld Vacation', true],
    ['g_holidays', 'Home for the Holidays', false],
    ['g_greencard', 'Apply for Green Card', false],
    ['g_vehicle', 'Exchange Vehicle, Get US Vehicle', true],
  ],
};

const insGoal = db.prepare(
  `INSERT INTO goal (id,pillar_id,title,progress_mode,target,manual_progress,closed_at)
   VALUES (?,?,?,?,?,?,?)`,
);
let goalCount = 0;
for (const [pid, list] of Object.entries(GOALS)) {
  for (const [gid, title, closed, mode = 'rollup', target = null] of list) {
    insGoal.run(gid, pid, title, mode, target, null, closed ? NOW : null);
    goalCount++;
  }
}

// A couple of real logged values so metric goals aren't empty shells.
const insMetric = db.prepare(
  'INSERT INTO metric_entry (id,goal_id,value,logged_at) VALUES (?,?,?,?)',
);
insMetric.run(id('m'), 'g_networth', 41200, NOW);
insMetric.run(id('m'), 'g_50k_list', 10400, NOW);

// --- boards -----------------------------------------------------------------

db.prepare('INSERT INTO board (id,name,view_type) VALUES (?,?,?)').run(
  'b_master', 'Master Board', 'priority');
db.prepare('INSERT INTO board (id,name,view_type) VALUES (?,?,?)').run(
  'b_songs', 'Song Production', 'stage');

// --- master board tasks -----------------------------------------------------

type T = [string, string | null, string | null, string | null, string | null];
//        title, priority,       pillar,        due,           recurrence

const TASKS: T[] = [
  // Top Priority — the pillar names you already wrote out by hand
  ['Edenglass', 'top', 'p_music', null, null],
  ['Auvora', 'top', 'p_wealth', null, null],
  ['Health Work', 'top', 'p_health', null, null],
  ['Personal Brand', 'top', 'p_brand', null, null],
  ['Nexus Application', 'top', 'p_career', null, null],
  ['Greencard Process', 'top', 'p_health', null, null],
  ['New Notes App', 'top', 'p_wealth', null, null],
  ['Weekly: Financial Review', 'top', 'p_wealth', '2026-09-12', 'weekly'],
  ['Financial Strategy (design, implement)', 'top', 'p_wealth', null, 'weekly'],
  ['Weekly: Subscription Reduction', 'top', 'p_wealth', '2026-09-06', 'weekly'],
  ['Monthly: Luxury List', 'top', 'p_wealth', '2026-09-30', 'monthly'],
  ['Monthly: 2026 Goal Check-in', 'top', null, '2026-09-30', 'monthly'],

  ['Sell Vehicle', 'high', 'p_health', null, null],

  ['Yearly: Goal Review + Goal Setting', 'recurring', null, '2026-12-28', 'yearly'],
  ['Weekly: Content Planning', 'recurring', 'p_music', '2026-09-14', 'weekly'],

  // Parking Lot
  ['GPD: Guitar Practice AI App', 'parking', 'p_wealth', null, null],
  ['GPD: Create New Book', 'parking', 'p_wealth', null, null],
  ['GPD: Pathway by Design Exercises', 'parking', 'p_wealth', null, null],
  ['GPD: Creative Soloing', 'parking', 'p_wealth', null, null],
  ['GPD: Elite Practice Checklist 2.0', 'parking', 'p_wealth', null, null],
  ["GPD: Coco's Licks & Tricks", 'parking', 'p_wealth', null, null],
  ['GPD: Zen of Practicology', 'parking', 'p_wealth', null, null],
  ['GPD: Guitar Practice Journal', 'parking', 'p_wealth', null, null],
  ['GPD: How to Write a Guitar Solo', 'parking', 'p_wealth', null, null],
  ['GPD: Chord Movements & Mapping', 'parking', 'p_wealth', null, null],
  ['GPD: Done-For-You Practice Plans', 'parking', 'p_wealth', null, null],
  ['GPD: Beginner Metal Guitar Mastery', 'parking', 'p_wealth', null, null],
  ['GPD: Practice for Live Performance', 'parking', 'p_wealth', null, null],
  ['GPD: Theory Hacks', 'parking', 'p_wealth', null, null],
  ['GPD: 30-Day Technique Challenge', 'parking', 'p_wealth', null, null],
  ['GPD: New Product From Old', 'parking', 'p_wealth', null, null],
  ['Get 5 Clients for LuxLead.ca', 'parking', 'p_wealth', null, null],
  ['Real Estate Lead Gen Course', 'parking', 'p_wealth', null, null],
  ['Facebook Ads MBA', 'parking', 'p_wealth', null, null],
  ['Real Estate Investment Plan', 'parking', 'p_wealth', null, null],
  ['Launch The Moral Millionaire', 'parking', 'p_brand', null, null],
  ['1 Person AI Business', 'parking', 'p_wealth', null, null],
  ['Guitar Practice', 'parking', 'p_music', null, null],
  ['Vocal Practice', 'parking', 'p_music', null, null],
  ['EP: AEOLIA Funnel', 'parking', 'p_music', null, null],
  ['Single: Ty Song', 'parking', 'p_music', null, null],
  ['Song w/Mom and Grandma', 'parking', 'p_music', null, null],
  ['Create EP Free + SH for GB/UK', 'parking', 'p_music', null, null],
  ['Anniversary Artwork', 'parking', 'p_health', null, null],
  ['Seattle Networking', 'parking', 'p_career', '2026-09-09', null],
  ['Update Signatures', 'parking', 'p_brand', null, null],
  ['Reporting: Calvin Realty Ad Performance', 'parking', 'p_wealth', null, null],
  ['Agency: Calvin Realty', 'parking', 'p_wealth', null, null],
  ['Monthly: EP Playlisting Submission', 'parking', 'p_music', null, 'monthly'],
  ['Monthly: EP Financials & Planning', 'parking', 'p_wealth', null, 'monthly'],
  ['Weekly: Study + Play', 'parking', 'p_music', '2026-09-08', 'weekly'],
  ['Weekly: Content Analysis', 'parking', 'p_music', null, 'weekly'],
  ['Weekly: EP Stand-Up', 'parking', 'p_music', null, 'weekly'],
  ['Weekly: Content & Ad Performance', 'parking', 'p_wealth', null, 'weekly'],
  ['Bi-Monthly: Bulk Content Creation', 'parking', 'p_brand', null, 'bimonthly'],

  // A brand-new task, deliberately unlabelled — it lands in Unsorted.
  ['Wire Arc to Supabase', null, null, null, null],
];

const insTask = db.prepare(
  `INSERT INTO task (id,title,priority,status,due_date,recurrence,pillar_id,goal_id,assignee,position,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
);
const insTaskBoard = db.prepare(
  'INSERT INTO task_board (task_id,board_id,position) VALUES (?,?,?)');

TASKS.forEach(([title, priority, pillar, due, rec], i) => {
  const tid = id('t');
  insTask.run(tid, title, priority, 'active', due, rec, pillar, null, 'Coco Lee', i, NOW);
  insTaskBoard.run(tid, 'b_master', i);
});

// Completed work, so the pillars have something to recombine from.
const DONE: [string, string][] = [
  ['Marketing Strategist Vetting', 'p_career'],
  ['5-Year Roadmap Project', 'p_career'],
  ['Rentgrata Analysis (YTD)', 'p_career'],
  ['WCEA Logo', 'p_brand'],
  ['AI and Digital Committee', 'p_career'],
  ['Move into Studio Space', 'p_health'],
  ['Adopt Dog', 'p_health'],
  ['Disneyworld Trip', 'p_health'],
  ['Exchange Vehicle', 'p_health'],
  ['Launch Edenglass', 'p_music'],
  ['Hit 10k Monthly Listeners', 'p_music'],
  ['Set Release Cadence', 'p_music'],
  ['Pay Off Consumer Debt', 'p_wealth'],
  ['Open Investment Accounts', 'p_wealth'],
  ['Write Wealth Plan', 'p_wealth'],
  ['Launch Personal Brand Site', 'p_brand'],
];
DONE.forEach(([title, pillar], i) => {
  const tid = id('t');
  insTask.run(tid, title, 'top', 'done', null, null, pillar, null, 'Coco Lee', 500 + i, NOW);
  insTaskBoard.run(tid, 'b_master', 500 + i);
});

// --- songs ------------------------------------------------------------------

const SONGS: [string, SongStage | null][] = [
  ['cerulean', 'backlog'], ['amazed', 'backlog'], ['black milk', 'backlog'],
  ['bouncing freddy', 'backlog'], ['love', 'backlog'], ['leaders ov mammals', 'backlog'],
  ['papi', 'backlog'], ['streets', 'backlog'], ['dark arabii', 'backlog'],
  ['entwined in serpentine', 'backlog'], ['gucci', 'backlog'], ['happiest riff', 'backlog'],
  ['heavens breath', 'backlog'], ['the concept ov reality (trilogy)', 'backlog'],
  ['wtf + intro', 'backlog'], ['sapphire sunrise (parts)', 'backlog'],
  ['edge ov infinity', 'backlog'], ['pearlescence', 'backlog'], ['ethereality', 'backlog'],
  ['change is the only constant', 'backlog'],
  ['dark polyphia', 'demo'], ['brilliance', 'demo'], ['dark ozark', 'demo'],
  ['light ozark', 'demo'], ['amnesty', 'demo'], ['oxygen', 'demo'],
  ['angels', 'demo'], ['cryptic', 'demo'],
  ['parallels', 'tracking'],
  ['bloom', 'released'], ['primal', 'released'],
  // A brand-new song with no stage — sits unlabelled until you assign one.
  ['untitled sketch', null],
];

const insSong = db.prepare(
  'INSERT INTO song (id,title,stage,assignee,position) VALUES (?,?,?,?,?)');
const insSongSub = db.prepare(
  'INSERT INTO song_subtask (id,song_id,title,done,phase,position) VALUES (?,?,?,?,?,?)');

/** Which songs have finished which of their stage checklists, from the board. */
const DONE_THROUGH: Record<string, SongStage | 'all'> = {
  'dark ozark': 'demo', 'light ozark': 'demo',
  parallels: 'demo',
  bloom: 'all', primal: 'all',
};

SONGS.forEach(([title, stage], i) => {
  const sid = id('s');
  insSong.run(sid, title, stage, null, i);
  if (!stage) return;

  const upTo = SONG_STAGES.indexOf(stage);
  let pos = 0;
  for (let si = 0; si <= upTo; si++) {
    const st = SONG_STAGES[si];
    for (const t of STAGE_TEMPLATES[st]) {
      const through = DONE_THROUGH[title];
      let done = 0;
      if (through === 'all') done = 1;
      else if (through && SONG_STAGES.indexOf(through) >= si) {
        // Partial: only the first item of the reached stage, matching the board.
        done = title === 'parallels' ? 1 : (t === 'Deliver First Demo' ? 1 : 0);
      }
      insSongSub.run(id('ss'), sid, t, done, st, pos++);
    }
  }
  // primal is 14/16 on the board — two Planning items still open.
  if (title === 'primal') {
    db.prepare(
      `UPDATE song_subtask SET done = 0
       WHERE song_id = ? AND title IN ('Create Videos, Content','Schedule Release')`,
    ).run(sid);
  }
});

// --- report -----------------------------------------------------------------

const n = (q: string) => (db.prepare(q).get() as { c: number }).c;
console.log('Seeded Arc:');
console.log('  pillars      ', n('SELECT COUNT(*) c FROM pillar'));
console.log('  goals        ', goalCount,
  '(' + n('SELECT COUNT(*) c FROM goal WHERE closed_at IS NOT NULL') + ' closed)');
console.log('  tasks        ', n('SELECT COUNT(*) c FROM task'));
console.log('  songs        ', n('SELECT COUNT(*) c FROM song'));
console.log('  song subtasks', n('SELECT COUNT(*) c FROM song_subtask'));
