// SPDX-License-Identifier: GPL-2.0-or-later
// Pickups around the city: never where the player appears, so nothing is picked up for free at the start of a
// game or on coming back from the hospital or the police station.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { GRASS, PLAZA, WALK } from '../../js/config.js';
import { COPS, HOSP, genMap, tileAt } from '../../js/world.js';
import { SPAWN_CLEAR, placePickup } from '../../js/spawner.js';

before(() => genMap());

test('no pickup lies within reach of where the player starts or comes back', () => {
  // A pickup is collected within 11 pixels; the spawn points sit between two tile middles, 8 pixels from each.
  assert.ok(SPAWN_CLEAR >= 11 + 16, 'clear of the pickup reach, and a tile more');
  for (let i = 0; i < 20000; i++) {
    const k = placePickup({});
    for (const [name, s] of [
      ['hospital', HOSP],
      ['police station', COPS],
    ])
      assert.ok(
        Math.hypot(k.x - s.x, k.y - s.y) >= SPAWN_CLEAR,
        `a pickup ${name === 'hospital' ? 'at' : 'by'} the ${name}`,
      );
  }
});

test('pickups still lie on pavement, grass or plazas, all over the city', () => {
  const seen = new Set();
  for (let i = 0; i < 3000; i++) {
    const k = placePickup({});
    assert.ok([WALK, GRASS, PLAZA].includes(tileAt(k.x, k.y)));
    seen.add(Math.floor(k.x / 400) + ',' + Math.floor(k.y / 400));
  }
  assert.ok(seen.size >= 12, `spread over ${seen.size} parts of the city`);
});
