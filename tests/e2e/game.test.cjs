// SPDX-License-Identifier: GPL-2.0-or-later
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { openGame } = require('./helpers.cjs');

let game;
beforeEach(async () => {
  game = await openGame();
});
afterEach(async () => {
  const errors = game.errors;
  await game.close();
  assert.deepEqual(errors, [], 'the page logged errors');
});

test('boots, shows the title, and starts on fire', async () => {
  assert.equal(await game.screen(), 'boot');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'title');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play');
  const world = await game.read((s) => ({ cars: s.G.cars.length, hp: s.P.hp, cash: s.G.cash }));
  assert.ok(world.cars > 10, 'parked cars exist');
  assert.equal(world.hp, 100);
  assert.equal(world.cash, 0);
  await game.until((s) => s.G.peds.length > 5 && s.G.cars.some((c) => c.ai === 'traffic'));
});

test('the player walks, takes a car and drives it', async () => {
  await game.start();
  // Walk right until the player has gone 25 pixels: by the game's clock, which runs slow where frames are slow,
  // as they are in a headless browser drawing without a graphics card.
  const x0 = await game.read((s) => s.P.x);
  await game.page.keyboard.down('ArrowRight');
  await game.until(`(s) => s.P.x > ${x0} + 25`);
  await game.page.keyboard.up('ArrowRight');

  await game.press('KeyE');
  await game.until((s) => s.P.car);
  await game.page.keyboard.down('ArrowUp');
  await game.until((s) => Math.hypot(s.P.car.vx, s.P.car.vy) > 60);
  await game.page.keyboard.up('ArrowUp');
  await game.until((s) => Math.hypot(s.P.car.vx, s.P.car.vy) < 40);
  await game.press('KeyE');
  await game.until((s) => !s.P.car);
});

test('the handbrake makes a fast car slide and leave skid marks', async () => {
  await game.start();
  await game.read((s) => {
    const car = s.mkCar(s.KIND.sports, 2 * 192 + 8, 250, Math.PI / 2, 2);
    s.G.cars = s.G.cars.filter((c) => c.parked);
    s.G.cars.push(car);
    s.P.car = car;
  });
  await game.page.keyboard.down('ArrowUp');
  await game.until((s) => Math.hypot(s.P.car.vx, s.P.car.vy) > 180);
  assert.equal(await game.read((s) => !!s.P.car.sk), false, 'no marks while driving straight');
  await game.page.keyboard.down('KeyX');
  await game.page.keyboard.down('ArrowLeft');
  await game.until((s) => s.P.car.slide > 30 && s.P.car.sk);
});

test('crime raises the heat and brings the police', async () => {
  await game.start();
  await game.read((s) => s.crime(70));
  assert.equal(await game.read((s) => s.G.heat), 3);
  await game.until((s) => s.G.cars.some((c) => c.ai === 'cop'), 15000);
});

test('a job starts with a timer and a target', async () => {
  await game.start();
  await game.read((s) => s.startJob());
  const job = await game.read((s) => ({ title: s.G.job.def.t, t: s.G.job.t, hasTarget: !!s.G.job.target }));
  assert.equal(job.title, 'PIZZA? SURE.');
  assert.ok(job.t > 60 && job.hasTarget);
});

test('Esc asks before returning to the title screen, and the game is kept', async () => {
  await game.start();
  await game.read((s) => (s.G.cash = 1234));
  await game.press('Escape');
  await game.until((s) => s.G.quitAsk);
  const frozenAt = await game.read((s) => s.G.clock);
  await game.wait(300);
  assert.equal(await game.screen(), 'play');
  await game.press('KeyN');
  await game.until((s) => !s.G.quitAsk);
  assert.equal(await game.screen(), 'play');
  assert.ok(frozenAt > 0);

  await game.press('Escape');
  await game.press('KeyY');
  await game.until((s) => s.G.screen === 'title');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play');
  assert.equal(await game.read((s) => s.G.cash), 1234);
});

test('driving into the canal floods the car and puts the player ashore', async () => {
  await game.start();
  await game.read((s) => {
    const car = s.mkCar(s.KIND.sedan, 776, 100, 0, 2);
    s.G.cars = s.G.cars.filter((c) => c.parked);
    s.G.cars.push(car);
    s.P.car = car;
    window.testCar = car;
  });
  await game.page.keyboard.down('ArrowUp');
  await game.until(() => window.testCar.flooded);
  await game.page.keyboard.up('ArrowUp');
  await game.until((s) => !s.P.car);
  await game.wait(1500);
  const car = await game.page.evaluate(() => ({
    dead: window.testCar.dead,
    burn: window.testCar.burn,
    speed: Math.hypot(window.testCar.vx, window.testCar.vy),
  }));
  assert.deepEqual([car.dead, !!car.burn], [false, false], 'the car does not explode');
  assert.ok(car.speed < 2, 'the car has stopped');
  await game.until(() => window.testCar.sink >= 1, 10000);

  // The driver is in the canal (x 816 to 944) and can swim back to the quay.
  const x0 = await game.read((s) => s.P.x);
  assert.ok(x0 > 816 && x0 < 944, `swimming at x=${x0}`);
  assert.equal(await game.read((s) => s.P.swim), true);
  await game.page.keyboard.down('ArrowLeft');
  await game.until((s) => s.P.x < 812 && !s.P.swim, 10000);
  await game.page.keyboard.up('ArrowLeft');

  // The flooded car cannot be taken again.
  await game.read((s) => {
    s.P.x = window.testCar.x;
    s.P.y = window.testCar.y;
  });
  await game.press('KeyE');
  await game.wait(200);
  assert.equal(await game.read((s) => !!s.P.car), false);
});

test('an arrest with money left costs a fine and the game goes on', async () => {
  await game.start();
  await game.read((s) => {
    s.G.cash = 1000;
    s.down('busted');
  });
  await game.until((s) => s.G.screen === 'play' && s.G.cash === 800);
});

test('an arrest with no money ends the game; N returns to the title for a fresh start', async () => {
  await game.start();
  await game.read((s) => {
    s.crime(70);
    s.P.ammo = 3;
    s.down('busted');
  });
  await game.until((s) => s.G.screen === 'over');
  await game.pressUntil('KeyN', (s) => s.G.screen === 'title');
  await game.press('Space');
  await game.until((s) => s.G.screen === 'play');
  const fresh = await game.read((s) => ({
    cash: s.G.cash,
    heat: s.G.heat,
    hp: s.P.hp,
    ammo: s.P.ammo,
    job: s.G.job,
    msg: s.G.msgTxt,
  }));
  assert.deepEqual([fresh.cash, fresh.heat, fresh.hp, fresh.ammo, fresh.job], [0, 0, 100, 12, null]);
  assert.match(fresh.msg, /YOU WAKE UP OUTSIDE/);
});

test('the game-over screen ignores keys for a moment, then Y starts a new game', async () => {
  await game.start();
  await game.read((s) => s.down('busted'));
  await game.until((s) => s.G.screen === 'over');
  await game.press('KeyY');
  await game.wait(200);
  assert.equal(await game.screen(), 'over', 'too early to answer');
  await game.pressUntil('KeyY', (s) => s.G.screen === 'play' && s.P.hp === 100 && s.G.cars.length > 10);
});

test('reaching the goal shows the victory screen, and Y starts over from nothing', async () => {
  await game.start();
  await game.read((s) => {
    s.G.cash = 24000;
    s.startJob();
    s.passJob();
  });
  await game.until((s) => s.G.screen === 'win');
  await game.pressUntil('KeyY', (s) => s.G.screen === 'play');
  assert.equal(await game.read((s) => s.G.cash), 0);
  // The second game starts with the first job again.
  await game.read((s) => s.startJob());
  assert.equal(await game.read((s) => s.G.job.def.t), 'PIZZA? SURE.');
});

test('the election fund can also be filled with loose cash, not only by finishing a job', async () => {
  await game.start();
  await game.read((s) => (s.G.cash = 25000));
  await game.until((s) => s.G.screen === 'win');
});

test('delivering the limo leaves the player standing somewhere they can walk from', async () => {
  await game.start();
  await game.read((s) => {
    for (let i = 0; i < 2; i++) {
      s.startJob();
      s.passJob();
    }
    s.G.cash = 0;
    s.startJob();
    if (s.G.job.def.type !== 'steal') throw new Error('expected the limo job');
    const limo = s.G.job.car;
    // Parked hard against the chop shop wall, the worst case for getting out.
    limo.x = 1264;
    limo.y = 1193;
    limo.a = 0;
    s.P.car = limo;
  });
  await game.until((s) => !s.G.job && !s.P.car);
  const x0 = await game.read((s) => s.P.x);
  await game.page.keyboard.down('ArrowLeft');
  await game.until(`(s) => s.P.x < ${x0} - 10`);
});

test('both end screens show their picture from the assets folder', async () => {
  await game.start();
  await game.until((s) => s.endingsLoaded());
  // Count the colours in the picture area of the screen: a missing picture would leave it black.
  const colours = () =>
    game.page.evaluate(() => {
      const c = document.getElementById('c'),
        d = c.getContext('2d').getImageData(32, 36 + 18, 320, 150).data,
        seen = new Set();
      for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return seen.size;
    });
  await game.read((s) => (s.G.screen = 'over'));
  await game.wait(200);
  assert.ok((await colours()) >= 6, 'the jail picture is on screen');
  await game.read((s) => (s.G.screen = 'win'));
  await game.wait(200);
  assert.ok((await colours()) >= 6, 'the office picture is on screen');
});

test('Big Honk is in the city, drawn pixel for pixel as figures.js has him, and a shot only makes him flap and honk', async () => {
  await game.start();
  const { frame, poseOf } = await import('../../js/figures.js');
  const { RGB } = await import('../../js/config.js');
  // Hold him still on his bank, facing north, with the player beside him and nobody else about.
  await game.read((s) => {
    const h = s.G.peds.find((p) => p.type === 'honk');
    Object.assign(h, { spd: 0, t: 1e9, dx: 0, dy: -1, flap: 0, anim: 0 });
    s.G.peds = [h];
    s.G.cars = [];
    Object.assign(s.P, { x: h.x - 30, y: h.y, a: 0, car: null, ammo: 5 });
  });
  await game.wait(1500); // for the view to settle on the player
  const shot = await game.page.evaluate(() => {
    const s = window.sleazeburg,
      h = s.G.peds.find((p) => p.type === 'honk'),
      sx = 32 + Math.round(h.x - Math.round(s.G.camX) - 12),
      sy = 36 + Math.round(h.y - Math.round(s.G.camY) - 12);
    return {
      h: { ...h },
      data: [...document.getElementById('c').getContext('2d').getImageData(sx, sy, 24, 24).data],
    };
  });
  const want = frame(shot.h, poseOf(shot.h), (12 / 16) * Math.PI * 2); // north is the 12th of 16 directions
  let wrong = 0,
    drawn = 0;
  want.forEach((c, i) => {
    if (c < 0) return;
    drawn++;
    if (RGB[c].some((v, k) => v !== shot.data[i * 4 + k])) wrong++;
  });
  assert.ok(drawn > 100, 'he is a decent size');
  assert.equal(wrong, 0, `${wrong} of his ${drawn} pixels are not as figures.js draws them`);

  // The player faces him: shoot, holding fire long enough for the game to see it.
  await game.page.keyboard.down('Space');
  await game.until((s) => s.G.peds.some((p) => p.type === 'honk' && p.flap > 0));
  await game.page.keyboard.up('Space');
  const after = await game.read((s) => ({
    honks: s.G.peds.filter((p) => p.type === 'honk').length,
    pops: s.G.pops.map((p) => p.t),
  }));
  assert.equal(after.honks, 1, 'still there');
  assert.ok(after.pops.includes('HONK!'));
});
