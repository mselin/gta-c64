# Sleazeburg 64: game design

The rules and the look of the game, in one place, for everyone who builds a version of it:

- the browser game (this folder);
- the desktop app (`desktop/`), which runs the same code;
- the Commodore 64 version in [mselin/Sleazeburg64](https://github.com/mselin/Sleazeburg64), written in
  assembly, which follows this document.

The numbers here come from the code, and each section names the file to look in. When the game changes, this
document changes in the same pull request.

**Units.**
- Distances are in world pixels. The city is 98 × 98 tiles of 16 pixels, 1568 pixels square.
- Speeds are in pixels a second. On a PAL C64 at 50 frames a second, divide by 50 for pixels a frame, so
  150 px/s is 3 px a frame.
- The screen is 320 × 200: a 320 × 176 view of the city and a 24-pixel status panel.

**C64 notes** in this document point out where the hardware forces a choice. They do not make it: that is for
the C64 version's own documents.

## Palette

The sixteen C64 colours, by their usual numbers (`PAL` in `js/config.js`). Everything is drawn in these,
without in-between shades.

| # | Colour | # | Colour | # | Colour | # | Colour |
|---|---|---|---|---|---|---|---|
| 0 | black `#000000` | 4 | purple `#6f3d86` | 8 | orange `#6f4f25` | 12 | grey `#6c6c6c` |
| 1 | white `#ffffff` | 5 | green `#588d43` | 9 | brown `#433900` | 13 | light green `#9ad284` |
| 2 | red `#68372b` | 6 | blue `#352879` | 10 | light red `#9a6759` | 14 | light blue `#6c5eb5` |
| 3 | cyan `#70a4b2` | 7 | yellow `#b8c76f` | 11 | dark grey `#444444` | 15 | light grey `#959595` |

## People on foot

`js/figures.js` draws people, and `js/sprites.js` only paints the frames it makes.

People are seen from above, about the size of a swimmer's splash, so that they read at a glance.

- **Pixels:**
  - Hard pixels, each one of the 16 colours, with no smoothing at any angle.
  - People are drawn in chunky 2 × 2 blocks (`CELL`). They read as pixel art next to the cars, which use
    single pixels.
- **Size:**
  - 12 pixels across, hands included: 8 of shoulders and a hand each side. Add the outline to that.
  - Each frame is 24 × 24, with room for an arm held out and two outlines at any angle.
  - 16 directions.
- **How a figure is made:**
  - A few plain shapes, facing right: square shoulders with the corners cut, a round head over them that pokes
    out in front, two hands at the sides, and two feet in the trousers' colour.
  - For each frame, the shapes are turned and sampled once in the middle of each 2 × 2 block, so every block
    is one colour.
  - The head shows which way someone faces: hair at the back, the face (skin) in front, or a police cap with
    its black peak in front.
- **Walking: five poses** (`STRIDES`), from a full stride one way to a full stride the other:
  - Hands and feet swing opposite ways. When the left foot is out in front, the right hand is forward and the
    left hand and the right foot are back.
  - At a full stride a foot shows about 3.4 pixels in front of or behind the middle, and a hand swings about
    2.2 pixels forward or back.
  - The walk cycles 3, 4, 5, 4, 3, 2, 1, 2 (pose 3 is standing), four frames to a step, so one cycle is two
    steps.
  - Steps go with the speed: a passer-by takes 0.15 steps for each pixel walked; the player takes 9 steps a
    second at a walking speed of 58.
  - Standing still is pose 3: hands at the sides and both feet under the body.
- **Arm out:**
  - When the player fires, the right arm goes straight out in front, the hand about 7 pixels ahead of the
    middle, with a short dark grey (11) gun beyond it. The other hand stays at the side.
  - When the player punches, the same arm goes out with a bigger fist and no gun.
  - When the player stabs, the same arm goes out with a short white (1) blade where the gun would be.
  - A police officer firing does the same as the player firing.
  - The arm stays out for 0.2 seconds (`ARM_OUT_T`), then the walk carries on.
- **Knocked down:** flat on their back, head to the front: legs out straight behind in the trousers' colour,
  arms flung wide, face up with the hair (or a police officer's cap) at the crown. A cultist's robe covers the
  legs; a scooter rider's scooter lies on its side beside them. Two small yellow (7) stars go round just above
  the head until they get up.
- **Not walking:**
  - A scooter rider stands on the deck, hands on the handlebar.
  - A cultist stands in a wide robe, hands held together in front, the hood hanging down the back.
  - Neither swings arms or feet.
- **Outline:**
  - Everyone has a one-pixel black outline, drawn after turning, so it is unbroken at every angle.
  - The player alone has a second, white outline outside the black one.
- **Shading:** the back of the shoulders is a darker colour of the shirt (`SHADE`).

| Who | Shirt | Trousers | Head | Extra |
|---|---|---|---|---|
| The player | yellow (7) | black (0) | black hair (0) | white outer outline |
| Police officer | light blue (14) | blue (6) | white cap (1) with a black peak | yellow (7) badge on the cap |
| Passer-by | one of purple 4, orange 8, cyan 3, red 2, light red 10, brown 9, green 5, white 1 | one of dark grey 11, brown 9, black 0, grey 12 | hair black 0, brown 9, orange 8 or yellow 7, never the shirt's colour | |
| Scooter rider | light green (13) | | | stands on a deck behind a handlebar |
| Cultist | purple robe (4) | | light blue hood (14) | long robe, hood up |

**No one else may look like the player or the police.** Passers-by never wear yellow, either police blue,
police trousers or a white cap, and no one else is ever drawn with a white outline.

**In the water:** a swimmer is a head, one arm and ripples, about 11 pixels across, in the person's own skin
and hair colours. The player's head keeps its outlines.

**Hit distances** (`HIT` in `js/config.js`) match the drawn body, so what you see is what you hit. Each
distance is measured from the person's middle.

| What | Distance |
|---|---|
| A bullet hits a person | 6 |
| A moving car runs someone over, from the car's middle | 10 |
| …or from the point 6 pixels ahead of its middle | 9 |
| A car hurts the player | 10 |
| Traffic brakes for someone this far either side of its line… | 9 |
| …and up to this far ahead of its middle | 26 |

**Against walls**, a person's footprint stays small: four points 3 pixels either side of their middle
(`footClear` in `js/world.js`). Doorways and pavements stay easy to walk, and shoulders may overlap a wall by a
pixel or two. The arrest distance stays at 7.

> **C64 note.** A figure at this size is larger than a character cell: 2 × 2 characters at least, or a
> sprite. In 2 × 2 blocks a standing figure is 6 blocks across, and with the arm out it reaches 5 blocks
> ahead of its middle. A multicolour sprite (12 double-wide pixels by 21 lines) is about 12 × 10 such blocks,
> each block one double-wide pixel two lines tall, which holds a figure at most angles. It has three colours
> plus transparent, so the player's yellow, black and white, or a police officer's light blue, blue and white
> cap, are what to keep. The five walking poses and the arm out are seven frames for each of the directions
> the C64 version keeps.

## Fighting on foot

`js/player.js` (fire), `js/peds.js` (`knockDown`), `MELEE`, `KO`, `KNIFE` and `AMMO_MAX` in `js/config.js`.

Fire on foot uses the gun while there is ammo. Out of ammo, the player fights hand to hand: with the knife if
they have one, otherwise with their fists. Nobody fires in the water.

| | Gun | Knife | Fists |
|---|---|---|---|
| When | ammo left | no ammo, knife | no ammo, no knife |
| Reach | a bullet | the first person within 7 of the point 10 ahead | the first person within 7 of the point 7 ahead |
| Wait before the next | 0.22 s | 0.28 s | 0.35 s |
| What it does | kills | kills, even someone already down | knocks down; passes over anyone already down |
| Heat | 1.5 a shot, then 6 a kill (28 a police officer) | 6 a kill (28 a police officer) | 3 (14 a police officer): half a kill |

**Knocked down:**
- They lie flat for 4 seconds (`KO.t`), and can still be run over, shot or stabbed.
- People within 60 of them run for 2 seconds.
- Then they get up. A passer-by runs from where the player is; a police officer carries on chasing; a cultist
  goes back to the meeting.
- A police officer who is down cannot arrest, shoot or notice the player, so the heat keeps cooling with them
  lying there.

**The knife:**
- A pickup marked **K** (black on light grey). 6% of the pickups around the city are knives, and someone the
  player kills drops one 8% of the time, unless the player already has one.
- Picking it up says so. A spare one is pawned for $10.
- The player keeps it until they are wasted or busted.

**Ammo** stops at 99. An ammo pickup gives up to 12, as many as fit.

**The HUD** shows what fire does, at the right of its top line, in place of the old `A012`:
- `AMMO12` in yellow (7) while there is ammo, always two digits;
- `KNIFE` in light grey (15), or `FIST` in light red (10), once it runs out.

The car's health bar is 28 pixels wide, so `AMMO99` fits beside it.

## Big Honk

Sleazeburg's crime boss is a goose. He has the run of The Moat, and nothing can hurt him. The numbers are in
`HONK` in `js/config.js`, his look is `gooseAt` in `js/figures.js`, and what he does is in `js/peds.js`.

- **Look:** a white (1) goose seen from above, in the same 2 × 2 blocks as people. From his tail to his beak:
  - a light grey (15) tail;
  - his body, with the wings folded along its back half in light grey;
  - a gold chain, yellow (7), round the bottom of his neck;
  - black (0) sunglasses across his head, wider than it;
  - the white front of his head, and an orange (8) beak.

  He has a black outline, as everyone but the player does. He is about 12 pixels across, his feet
  included, and 18 long.
- **Poses:**
  - Walking, his orange feet paddle out at his sides, on the same five-pose walk as people.
  - Afloat, his feet do not show. He is drawn as himself in the water, not as a swimmer.
  - Flapping, his wings go out to the sides and then back, 12 beats a second (`FLAP_RATE`), and his beak
    opens wide.
- **Where:** The Moat, the canal down the middle of the city and its two banks, x from 800 to 960, the whole
  length of the city.
  - A new game finds him on the west bank at (808, 840).
  - He wanders like a passer-by, preferring the banks, the water and grass. Each time he picks a way, he
    is ready to cross a road three times in ten (`HONK.jay`), so he gets over the bridges and up and down the
    canal.
  - He walks at 18 px/s and swims just as fast: he is a goose.
  - The spawner never clears him away, however far off the player is, and gunfire does not scare him.
- **Nothing hurts him:** shot, stabbed, punched, run over or caught in a blast, he does not die and is not
  knocked down. Instead:
  - he flaps for 1.2 seconds (`HONK.flapT`), honks (two nasal blasts, `sfx.honk`) and says `HONK!` in yellow;
  - he runs off away from what hit him at 44 px/s;
  - nothing ruffles him again until he stops flapping;
  - a bullet that hits him is spent, and hitting him is no crime (firing the shot still is).

  Traffic brakes for him as it does for anyone.

> **C64 note.** He fits a sprite, at most 22 × 22 pixels with his wings out. A multicolour sprite has three
> colours and transparent. His white and black are two of them, which leaves one for the beak and feet (orange)
> or the chain (yellow): one of those goes, or a second sprite lies over the first. The C64 version keeps the
> chain and draws his beak yellow too, with his grey tail and wings white and no feet. It has a frame for each
> way he faces and one with his wings out, and sways him a pixel from side to side as he walks instead of
> paddling his feet. Its traffic does not stop for him yet, and he has no honk until it has sound.

## Cars

The rules are in `js/cars.js` and the kinds in `KIND` in `js/config.js`.

| Kind | Length × width | Top speed | Acceleration | Strength (hp) |
|---|---|---|---|---|
| Sedan | 20 × 11 | 150 | 120 | 100 |
| Sports car | 20 × 10 | 215 | 180 | 80 |
| Van | 22 × 12 | 120 | 85 | 150 |
| Taxi (yellow) | 20 × 11 | 150 | 120 | 100 |
| Police (white) | 20 × 11 | 188 | 165 | 140 |
| Limousine (white) | 28 × 11 | 140 | 100 | 170 |

### Walls

Cars never go into or through buildings, trees or the edge of the map, and no speed or angle gets round that:

- **What counts as a wall:** a car takes up three points along its length (its middle, and `length/2 − 4`
  ahead and behind), each a box 4 pixels either side. A car is in a wall when any box touches a solid tile.
  Outside the map counts as solid.
- **Turning:** a turn that would swing the car into a wall does not happen.
- **Moving:** the car moves one axis at a time. If the move on an axis would hit a wall, the car stays put on
  that axis, its speed that way reverses to 30 % (a small bounce back), and it takes damage. Moving the other
  axis still works, so a car hitting a wall at an angle slides along it.
- **Damage:** hitting a wall at more than 35 px/s does `(speed − 35) × 0.14` damage, where the speed is the
  part going into the wall. Below that it is a bump and does nothing. So a sedan at full speed head-on loses
  about 16 of its 100.
- **Corners:** a car that only clips the corner of a wall slips up to 3 pixels sideways past it instead of being
  held there. This keeps a car whose nose has caught a corner able to back away.
- **Already in a wall:** a car found overlapping a wall moves to the nearest clear spot, looking up to 24 pixels
  away in 16 directions. It is never let through. If there is no room it stops.

Traffic follows its lanes on rails and is not held by these rules. It may poke a pixel past the map edge while
turning there. The moment it leaves its lane (it is hit, or the player takes it), the rules apply, starting with
the "already in a wall" step.

## Heat and the police

Heat is in `js/heat.js`, and the police in `js/spawner.js` and `js/cars.js`.

**Heat** is a number of points, shown as a level from 0 to 5. The points cap at 230.

| Level | From | Announced |
|---|---|---|
| 1 | 8 | A STERN LETTER IS BEING DRAFTED |
| 2 | 25 | POLICE DISPATCHED. EVENTUALLY. |
| 3 | 60 | SHOOT FIRST, PAPERWORK NEVER |
| 4 | 110 | OVERTIME HAS BEEN APPROVED |
| 5 | 180 | THE HOMEOWNERS ASSOCIATION HAS BEEN NOTIFIED |

| Crime | Points |
|---|---|
| Killing a police officer | 28 |
| Killing anyone else | 6 |
| Taking a police car from its driver | 16 (heat 1) |
| Taking any other car from its driver | 4 |
| Ramming a police car with an officer in it | 9 |
| Ramming another car with a driver | 2 |
| Ramming an empty car | 0.5 |
| Hitting a police car with a shot | 5 |
| Hitting another car with a shot | 1 |
| Firing a shot | 1.5 |
| Stealing the limousine on that job | 10 |

**The police notice the player** when they come this close (`NOTICE` in `js/config.js`):

| Who | Distance |
|---|---|
| A police car already chasing | 150 |
| An officer on foot | 120 |
| A police car on patrol in ordinary traffic | 130 |

**Cooling down:** with heat above 0 and no chasing car or officer near, the heat drops one level every
9 seconds. Its points fall to that level's threshold.

**The siren:** with heat above 0 and the police near (a chasing car within 150, or an officer on foot within 120
who is not knocked down):
- **Sound:** it wails every 0.7 seconds, two square-wave notes of 0.33 seconds, 620 Hz then 830 Hz.
- **Border:** the screen border flashes red (2) and blue (6), changing every half second.
- **Only while they are near:** both stop the moment the police are out of range. The wail starts afresh when
  they come back.
- **Only in play:** not on the busted or flatlined screen, while paused, or behind the return-to-title dialog or
  the info page (`sirenFlash` in `js/state.js`).
- **The bug it fixes:** before mselin/gta-c64#18, the border kept flashing with no police about for as long as
  there was any heat, including after the player came back from the title screen.

> **C64 note.** The border is the VIC-II border colour (`$D020`): one write a frame, the colour changing every
> 25 frames on PAL. Two colour changes a second stays well below the three flashes a second that can set off
> photosensitive seizures.

**The response:**
- **Chasing cars:** while heat is above 0, the police keep up to `min(5, heat)` cars chasing, adding one every
  2.2 seconds.
- **Patrol cars join in:** a patrol car within 130 joins the chase.
- **Officers on foot:** when a chasing car and the player are both slower than 30 px/s within 36 pixels of
  each other, an officer gets out, up to four on foot at once.
- **Boxed in:** if the player's car is slower than 12 px/s with a chasing car within 24 pixels, the player is
  arrested after 2 seconds of it.

**A stolen police car.** The police know their own cruisers, and know the player is not one of them:
- **The rule:** driving a police car with heat below 2, the moment a chasing car, an officer on foot or a patrol
  car notices it (the distances above), the heat goes up to 2. The game says "THE COPS KNOW THAT CRUISER. THEY
  DO NOT KNOW YOU."
- **Higher heat** is left as it is.
- **Patrols count:** patrol cars notice it as well, so it is spotted even with no heat at all.
- **Cars that cannot notice:** an empty or wrecked police car notices nothing.
- **Only while driving it:** getting out of the cruiser ends it.
- **The rule repeats:** if the heat cools to 1 while the player is still driving it near the police, it goes
  straight back to 2.
- **Paint makes no difference:** the paint shop can repaint a police car, but it is still a police car.

> **C64 note.** The C64 version keeps few cars at once (six, by the sprite multiplexer). That leaves few patrol
> cars, so the cruiser is noticed less often there unless chasing cars spawn sooner.

## Banners

`bigText` in `js/state.js`, drawn by `drawWorld` in `js/render.js`.

Big text across the middle of the screen, with small text under it:

| Banner | Colour | Under it | Seconds |
|---|---|---|---|
| BUSTED | light blue (14) | the reason, or YOU HAVE THE RIGHT TO REMAIN BROKE | 3.2 |
| FLATLINED | red (2) | the reason, or THOUGHTS AND PRAYERS HAVE BEEN DISPATCHED | 3.2 |
| A job's title, when it starts | yellow (7) | REWARD $ and the pay | 2.5 |
| JOB DONE | light green (13) | +$ and the pay, (UNDECLARED) | 2.5 |
| JOB BOTCHED | red (2) | why, or TIME IS MONEY AND YOU HAVE NEITHER | 2.5 |

**Everything fits the screen.** The screen is 40 characters across (320 pixels in 8-pixel letters):
- **The title** is in double-size letters if it has at most 19 characters, with a margin; otherwise in
  ordinary letters. Every title the game has today fits in double size.
- **The text under it** is broken at spaces into lines of at most 38 characters, a character's margin each side.
  It uses as few lines as it can, and makes them as even as they go, so no word is left alone on a line
  (`wrapEven` in `js/util.js`). A word is cut only if it is longer than a line.
- **The box** is black, the width of the screen, with a line of the title's colour above and below. It grows down
  10 pixels for each line of text after the first. A test checks that every text the code puts in a banner takes
  at most 3 lines.
- **The bug it fixes:** before mselin/gta-c64#14, the text was not broken into lines, and anything over 40
  characters ran off both sides. THOUGHTS AND PRAYERS HAVE BEEN DISPATCHED is 41.

> **C64 note.** The C64 text screen is 40 columns, the same as the browser game's 320 pixels in 8-pixel letters,
> so the same limits hold: 38 characters a line under the title, and 19 for a title in double-size letters.

## Title screen and icon

**Title** (`drawTitle` in `js/render.js`):
- **The name:** "SLEAZEBURG" in the game's 5 × 7 letters at three times their size. Each pixel row is coloured
  from the raster-bar sequence, red 2, orange 8, yellow 7, light green 13, cyan 3, light blue 14, purple 4,
  light red 10, white 1, then back the same way, and the colours scroll down through it.
- **The bars:** six one-pixel bars above and six below run through the same colours.
- **"64":** yellow (7), sitting on the baseline at the end of the name.

**Icon** (`tools/make-icons.mjs`, drawn from the same letters and colours):
- **32 × 32:** the "S" at three times its size in the raster colours, a yellow "64" beside it, and a light
  blue and a purple bar above and below.
- **16 × 16:** the "S" alone at twice its size, since the "64" turns to mush that small.
- **Phones and the desktop app** use the 32 × 32 design scaled up by whole numbers.

## Only in the browser and desktop versions

These are not part of the game's design and are not expected on the C64:

- **Discord Rich Presence.** See `tools/presence-bridge/` and `desktop/`.
- **The touch controls** (`specs/touch-controls.md`).
- **The radio,** which streams from the High Voltage SID Collection. The C64 version has its own music; see
  its roadmap.
- **Skid marks and other decals** painted onto the map.
- **The browser check** (`js/compat.js`), on the loading screen. It is a classic script in ES5, so it runs even
  where the game's modules cannot.
  - **Fatal:** the game's place is taken by a `?BROWSER ERROR` box that lists what is missing, and suggests a
    current Firefox, Chrome, Edge or Safari, or updating a phone. The game cannot run without:
    - JavaScript modules;
    - JavaScript from 2022 (`Object.hasOwn`, `Array.prototype.at`);
    - a 2D canvas;
    - animation frames;
    - Pointer Events, on a touch-only device.
  - **A note** at the bottom of the loading screen, with OK, for what only part of the game needs:
    - no Web Audio: no sound;
    - no WebAssembly, AudioWorklet or 64-bit typed arrays: no radio music;
    - storage blocked: settings are not kept;
    - on a touch-only device that was not started from the home screen, no full screen.

    Once dismissed, the same note is not shown again. It also goes away once the game is under way.
  - **Did not start:** if the game has not started 3 seconds after the page has loaded, the box says so, with the
    first error, and offers a reload.
