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
  const { RGB, ZOOM } = await import('../../js/config.js');
  // Hold him still on his bank, facing north, with the player beside him and nobody else about.
  await game.read((s) => {
    const h = s.G.peds.find((p) => p.type === 'honk');
    Object.assign(h, { spd: 0, t: 1e9, dx: 0, dy: -1, flap: 0, anim: 0 });
    s.G.peds = [h];
    s.G.cars = [];
    Object.assign(s.P, { x: h.x - 30, y: h.y, a: 0, car: null, ammo: 5 });
  });
  await game.wait(1500); // for the view to settle on the player
  // Where he is on the screen: ZOOM screen pixels to a city pixel, as render.js works it out. He keeps his size.
  const shot = await game.page.evaluate((zoom) => {
    const s = window.sleazeburg,
      h = s.G.peds.find((p) => p.type === 'honk'),
      sx = 32 + Math.round(h.x * zoom) - Math.round(s.G.camX * zoom) - 12,
      sy = 36 + Math.round(h.y * zoom) - Math.round(s.G.camY * zoom) - 12;
    return {
      h: { ...h },
      data: [...document.getElementById('c').getContext('2d').getImageData(sx, sy, 24, 24).data],
    };
  }, ZOOM);
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

test('Z changes the scale, the info page shows and changes it, and the choice is kept', async () => {
  await game.start();
  const zoom = () => game.read((s) => s.zoom.now());
  assert.equal(await zoom(), 2, 'the default');
  await game.press('KeyZ');
  assert.equal(await zoom(), 3);
  assert.match(await game.read((s) => s.G.msgTxt), /SCALE 3X/);
  await game.press('KeyI');
  const button = game.page.locator('#bzoom');
  assert.equal(await button.innerText(), 'SCALE: 3X');
  await button.click();
  assert.equal(await zoom(), 1);
  assert.equal(await button.innerText(), 'SCALE: 1X');
  await game.press('KeyI');
  // A new visit starts at the scale chosen last.
  await game.page.reload();
  await game.page.waitForFunction(() => window.sleazeburg);
  assert.equal(await zoom(), 1);
  await game.read((s) => s.zoom.use(2, false));
});

test("pickups and job markers are drawn at the city's scale, each with its letter", async () => {
  await game.start();
  // Hold the game still (the information page, without showing it), with an ammo pickup beside the player and the
  // camera on the first job marker, then count the colours of the canvas where each is drawn.
  const seen = await game.read(async (s) => {
    const { G, P } = s,
      { ZOOM: z, PAL } = await import('/js/config.js'),
      { JOBPTS } = await import('/js/world.js'),
      j = JOBPTS[0];
    G.infoOpen = true;
    G.job = null;
    G.camX = j.x - 60;
    G.camY = j.y - 40;
    G.pickups = [{ x: j.x + 30, y: j.y, type: 'ammo', t: 0 }];
    await new Promise((done) => window.requestAnimationFrame(() => window.requestAnimationFrame(done)));
    const q = document.getElementById('c').getContext('2d'),
      hex = (d, i) => '#' + [0, 1, 2].map((k) => d[i + k].toString(16).padStart(2, '0')).join(''),
      // How many pixels of each colour in a box `h` city pixels either side of (x, y), on the screen.
      count = (x, y, h) => {
        const px = Math.round(x * z) - Math.round(G.camX * z),
          py = Math.round(y * z) - Math.round(G.camY * z),
          d = q.getImageData(32 + px - h * z, 36 + py - h * z, 2 * h * z, 2 * h * z).data,
          n = {};
        for (let i = 0; i < d.length; i += 4) n[hex(d, i)] = (n[hex(d, i)] || 0) + 1;
        return n;
      },
      ammo = count(j.x + 30, j.y, 4),
      mark = count(j.x, j.y, 5);
    return {
      z,
      orange: ammo[PAL[8].toLowerCase()] || 0,
      black: mark[PAL[0].toLowerCase()] || 0,
      lit: Object.entries(mark).reduce((t, [c, k]) => (c === PAL[0].toLowerCase() ? t : t + k), 0),
    };
  });
  const z2 = seen.z * seen.z;
  // The ammo square is 8 city pixels across, orange with its A in it (and it bobs a city pixel).
  assert.ok(seen.orange > 30 * z2, `the ammo square fills its 8 city pixels (${seen.orange} orange pixels)`);
  // The J marker's middle is 10 city pixels of black with the J in it.
  assert.ok(seen.black > 60 * z2, `the marker's black middle (${seen.black} pixels)`);
  assert.ok(seen.lit > 4 * z2, `with its J drawn in it (${seen.lit} pixels)`);
});

test('a stolen car with anti-theft stops, sounds its alarm and flashes its lights', async () => {
  await game.start();
  // Into the car beside the hospital, now with anti-theft that goes off at once.
  await game.read(async (s) => {
    const { fit } = await import('/js/adas.js'),
      { P } = s,
      c = s.G.cars.reduce((a, o) =>
        Math.hypot(o.x - P.x, o.y - P.y) < Math.hypot(a.x - P.x, a.y - P.y) ? o : a,
      );
    fit(c, 'theft').theft.left = 0.3;
    window.testCar = c;
    Object.assign(s.P, { x: c.x, y: c.y, car: c });
  });
  await game.until(() => window.testCar.theft.tripped && window.testCar.alarm > 0);
  assert.equal(await game.read((s) => s.G.msgTxt), 'ANTI-THEFT ENGAGED: ENGINE IMMOBILISED');
  // Held still with the camera on it: its four corner lights drawn yellow with the high note, and not between notes.
  const lit = await game.read(async (s) => {
    const { G } = s,
      c = window.testCar,
      { ZOOM: z, PAL, VIEW_W, VIEW_H } = await import('/js/config.js'),
      q = document.getElementById('c').getContext('2d'),
      count = async (hi) => {
        c.alarmHi = hi;
        await new Promise((d) => window.requestAnimationFrame(() => window.requestAnimationFrame(d)));
        const px = Math.round(c.x * z) - Math.round(G.camX * z),
          py = Math.round(c.y * z) - Math.round(G.camY * z),
          h = 16 * z,
          d = q.getImageData(32 + px - h, 36 + py - h, 2 * h, 2 * h).data,
          [r, g, b] = [1, 3, 5].map((i) => parseInt(PAL[7].slice(i, i + 2), 16));
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] === r && d[i + 1] === g && d[i + 2] === b) n++;
        return n;
      };
    G.infoOpen = true;
    G.camX = c.x - VIEW_W / 2;
    G.camY = c.y - VIEW_H / 2;
    return { on: await count(true), off: await count(false), z };
  });
  assert.ok(
    lit.on - lit.off >= 3 * 4 * lit.z * lit.z,
    `four yellow lights (${lit.on} yellow pixels lit, ${lit.off} between notes)`,
  );
});
