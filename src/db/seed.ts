/**
 * Seed Arc from the real contents of thecocolee.monday.com.
 *
 * Sources:
 *   2026 Goals        (18393288742) — 45 items: 3 Core docs, 5 affirmations, 37 goals
 *   Coco Master Board (5760118855)  — 134 items
 *   song production   (18388779476) — 31 songs
 *
 * Idempotent: wipes and reloads. Run with `npm run seed`. Needs DATABASE_URL,
 * and applies src/db/schema.sql first so a fresh database works in one step.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPool, id, query } from './index';
import { STAGE_TEMPLATES } from '../domain/rules';
import { SONG_STAGES, type SongStage } from '../domain/types';

const AIM = 'aim_2026';

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

type T = [string, string | null, string | null, string | null, string | null];
//        title, priority,       pillar,        due,           recurrence

const TASKS: T[] = [
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

  // Deliberately unlabelled — it lands in Unsorted.
  ['Wire Arc to Supabase', null, null, null, null],
];

/** Completed work, so the pillars have something to recombine from. */
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
  // Brand-new, no stage — sits unlabelled until you assign one.
  ['untitled sketch', null],
];

/** How far each song has actually got, from the board. */
const DONE_THROUGH: Record<string, SongStage | 'all'> = {
  'dark ozark': 'demo', 'light ozark': 'demo',
  parallels: 'demo',
  bloom: 'all', primal: 'all',
};

async function main() {
  await query(readFileSync(join(process.cwd(), 'src/db/schema.sql'), 'utf8'));

  await query(`
    DELETE FROM link; DELETE FROM task_board; DELETE FROM song_subtask;
    DELETE FROM subtask; DELETE FROM song; DELETE FROM task;
    DELETE FROM metric_entry; DELETE FROM goal; DELETE FROM pillar;
    DELETE FROM board; DELETE FROM aim;
  `);

  await query(
    'INSERT INTO aim (id,title,body,year) VALUES ($1,$2,$3,$4)',
    [AIM, 'My Macro Vision + Definite Chief Aim',
     'The one aim the five pillars decompose. Held in The Core alongside 2026 Main Focus and My Ideal Week.',
     2026],
  );

  for (const [pid, name, aff, stars, hue] of PILLARS) {
    await query(
      'INSERT INTO pillar (id,aim_id,name,affirmation,stars,hue_order) VALUES ($1,$2,$3,$4,$5,$6)',
      [pid, AIM, name, aff, stars, hue],
    );
  }

  let goals = 0;
  const now = new Date().toISOString();
  for (const [pid, list] of Object.entries(GOALS)) {
    for (const [gid, title, closed, mode = 'rollup', target = null] of list) {
      await query(
        `INSERT INTO goal (id,pillar_id,title,progress_mode,target,closed_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [gid, pid, title, mode, target, closed ? now : null],
      );
      goals++;
    }
  }

  await query('INSERT INTO metric_entry (id,goal_id,value,logged_at) VALUES ($1,$2,$3,$4)',
    [id('m'), 'g_networth', 41200, now]);
  await query('INSERT INTO metric_entry (id,goal_id,value,logged_at) VALUES ($1,$2,$3,$4)',
    [id('m'), 'g_50k_list', 10400, now]);

  await query('INSERT INTO board (id,name,view_type) VALUES ($1,$2,$3)',
    ['b_master', 'Master Board', 'priority']);
  await query('INSERT INTO board (id,name,view_type) VALUES ($1,$2,$3)',
    ['b_songs', 'Song Production', 'stage']);

  const addTask = async (
    title: string, priority: string | null, status: string,
    due: string | null, rec: string | null, pillar: string | null, pos: number,
  ) => {
    const tid = id('t');
    await query(
      `INSERT INTO task (id,title,priority,status,due_date,recurrence,pillar_id,assignee,position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Coco Lee',$8)`,
      [tid, title, priority, status, due, rec, pillar, pos],
    );
    await query('INSERT INTO task_board (task_id,board_id,position) VALUES ($1,$2,$3)',
      [tid, 'b_master', pos]);
  };

  let i = 0;
  for (const [title, priority, pillar, due, rec] of TASKS) {
    await addTask(title, priority, 'active', due, rec, pillar, i++);
  }
  i = 500;
  for (const [title, pillar] of DONE) {
    await addTask(title, 'top', 'done', null, null, pillar, i++);
  }

  let songs = 0, songSubs = 0;
  for (const [pos, [title, stage]] of SONGS.entries()) {
    const sid = id('s');
    await query('INSERT INTO song (id,title,stage,position) VALUES ($1,$2,$3,$4)',
      [sid, title, stage, pos]);
    songs++;
    if (!stage) continue;

    const upTo = SONG_STAGES.indexOf(stage);
    let sp = 0;
    for (let si = 0; si <= upTo; si++) {
      const st = SONG_STAGES[si];
      for (const t of STAGE_TEMPLATES[st]) {
        const through = DONE_THROUGH[title];
        let done = false;
        if (through === 'all') done = true;
        else if (through && SONG_STAGES.indexOf(through) >= si) {
          done = title === 'parallels' ? true : t === 'Deliver First Demo';
        }
        await query(
          `INSERT INTO song_subtask (id,song_id,title,done,phase,position)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [id('ss'), sid, t, done, st, sp++],
        );
        songSubs++;
      }
    }
    // primal is 14/16 on the board — two Planning items still open.
    if (title === 'primal') {
      await query(
        `UPDATE song_subtask SET done = FALSE
          WHERE song_id = $1 AND title IN ('Create Videos, Content','Schedule Release')`,
        [sid],
      );
    }
  }

  console.log('Seeded Arc:');
  console.log('  pillars      ', PILLARS.length);
  console.log('  goals        ', goals);
  console.log('  tasks        ', TASKS.length + DONE.length);
  console.log('  songs        ', songs);
  console.log('  song subtasks', songSubs);

  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
