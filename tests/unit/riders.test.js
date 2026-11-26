// SPDX-License-Identifier: GPL-2.0-or-later
// Who rides along the pavements follows the difficulty: e-scooter riders on modern, skaters on classic. The jobs
// about them say which, and changing the difficulty turns the riders about into the other kind.
import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JOBS, NEWS } from '../../js/config.js';
import { G, K, P, edge, forDifficulty, isRider, resetState, rider } from '../../js/state.js';
import { genMap } from '../../js/world.js';
import { initWorld, update } from '../../js/game.js';
import { mkPed } from '../../js/entities.js';
import { SKATE, lookOf, pixels } from '../../js/figures.js';
import { killPed } from '../../js/peds.js';
import { jobWords } from '../../js/missions.js';

const DT = 1 / 60;
function start() {
  G.screen = 'title';
  edge.fire = true;
  update(DT);
  edge.fire = false;
}

before(() => genMap());
beforeEach(() => {
  G.difficulty = 'classic';
  resetState();
  for (const k in K) delete K[k];
  initWorld();
});

test('skaters on classic, scooter riders on modern', () => {
  assert.equal(rider(), 'skate');
  G.difficulty = 'modern';
  assert.equal(rider(), 'scoot');
  for (const t of ['skate', 'scoot']) assert.ok(isRider(mkPed(0, 0, t)));
  assert.ok(!isRider(mkPed(0, 0, 'civ')));
});

test('a skater is drawn as a skater on a board, not as a scooter rider', () => {
  const s = mkPed(0, 0, 'skate'),
    r = mkPed(0, 0, 'scoot');
  assert.equal(lookOf(s), 'skate');
  assert.equal(s.shirt, SKATE.shirt);
  assert.equal(s.spd, SKATE.spd);
  // The board in its own colour, which a scooter rider never shows; and the skater's hoodie.
  const px = pixels(s, 2, 0);
  assert.ok(px.includes(SKATE.board) && px.includes(SKATE.shirt));
  assert.ok(!pixels(r, 2, 0).includes(SKATE.board));
});

test('the rider jobs speak of skaters on classic and of scooters on modern; a kill of either counts', () => {
  const riderJobs = JOBS.filter((j) => j.classic);
  assert.equal(riderJobs.length, 2);
  for (const j of riderJobs) {
    assert.match(j.txt, /SCOOTER/);
    assert.match(j.classic.txt, /SKATER/);
    assert.doesNotMatch(j.classic.t + j.classic.txt, /SCOOTER/);
  }
  const def = JOBS.find((j) => j.classic);
  G.difficulty = 'classic';
  assert.equal(jobWords(def).t, def.classic.t);
  assert.match(jobWords(def).txt, /SKATER/);
  G.difficulty = 'modern';
  assert.equal(jobWords(def).t, def.t);
  assert.match(jobWords(def).txt, /SCOOTER/);
  assert.equal(jobWords(JOBS[0]), JOBS[0], 'other jobs are the same on both');
  G.difficulty = 'classic';
  start();
  G.job = { def, n: 0, t: def.time, pay: def.pay };
  const sk = mkPed(P.x + 5, P.y, 'skate');
  G.peds.push(sk);
  killPed(sk, true);
  assert.equal(G.job.n, 1, 'a skater counts');
});

test('changing the difficulty turns the riders about into the other kind', () => {
  start();
  G.peds.push(mkPed(P.x + 40, P.y, 'skate'), mkPed(P.x + 60, P.y, 'civ'));
  G.difficulty = 'modern';
  start();
  const riders = G.peds.filter(isRider);
  assert.ok(riders.length >= 1);
  assert.ok(riders.every((p) => p.type === 'scoot' && p.shirt === 13));
  assert.ok(
    G.peds.some((p) => p.type === 'civ'),
    'passers-by stay as they are',
  );
  G.difficulty = 'classic';
  start();
  assert.ok(G.peds.filter(isRider).every((p) => p.type === 'skate'));
});

test('the news and the greetings speak of skaters on classic, of e-scooters on modern', () => {
  const news = NEWS.find((n) => n.includes('E-SCOOTER'));
  G.difficulty = 'classic';
  assert.equal(forDifficulty(news), 'NEWS: SKATER COUNT NOW EXCEEDS POPULATION');
  assert.equal(
    forDifficulty('GREETINGS TO E-SCOOTER ENTHUSIASTS ...'),
    'GREETINGS TO SKATING ENTHUSIASTS ...',
  );
  assert.equal(forDifficulty(NEWS[0]), NEWS[0], 'other lines are the same');
  for (const n of NEWS) assert.doesNotMatch(forDifficulty(n), /SCOOTER/, 'no scooters on classic');
  G.difficulty = 'modern';
  assert.equal(forDifficulty(news), news);
});
