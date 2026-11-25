# Sleazeburg 64: game design

The rules and the look of the game, in one place, for everyone who builds a version of it:

- the browser game (this folder);
- the desktop app (`desktop/`), which runs the same code;
- the Commodore 64 version in [mselin/Sleazeburg64](https://github.com/mselin/Sleazeburg64), written in
  assembly, which follows this document.

The numbers here come from the code, and each section names the file to look in. When the game changes, this
document changes in the same pull request.

**Units.**
- Distances are in city pixels. The city is 98 × 98 tiles of 16 pixels, 1568 pixels square. The city is drawn
  2 screen pixels to a city pixel by default (see [The scale](#the-scale)); people keep their size on screen.
- Speeds are in city pixels a second. On a PAL C64 at 50 frames a second, divide by 50 for pixels a frame, so
  150 px/s is 3 px a frame.
- The screen is 320 × 200: a 320 × 176 view of the city and a 24-pixel status panel.

**C64 notes** in this document point out where the hardware forces a choice. They do not make it: that is for
the C64 version's own documents.

## The scale

`ZOOM`, `PERSON` and `setZoom` in `js/config.js`; `js/scale.js`.

People are drawn at the size that reads well on screen, about 12 screen pixels across. Cars and the city are
drawn larger, so that a person is nearer their real size beside a car.

- **The zoom** (`ZOOM`): the map, the cars, bullets, sparks and skid marks are drawn ZOOM screen pixels to a city
  pixel, in blocks of ZOOM × ZOOM, and so are pickups and the job markers (J, P, X), letters and all, so they stay
  as big beside the streets as they were before the zoom. People, the other text and the status panel keep their
  size on screen.
- **A person is PERSON = 1 / ZOOM of their old size in the city.** Everything about a person's body is in city
  pixels times PERSON, so on screen it looks and plays the same at any zoom:
  - how big a target they are (the hit distances below);
  - how far a fist or a knife reaches;
  - their footprint against walls, and how close the police get to arrest them;
  - their pace: walking, swimming, fleeing, and passers-by and police on foot;
  - how near they must come to a pickup (from its edge, which is in city pixels), and how near a finger on a
    touch screen counts as on them.

  A car's numbers stay in city pixels (its size, speed, grip, getting in and out), and so do places (jobs,
  crossings). A scooter's speed is the scooter's.
- **The view** is 320 / ZOOM × 176 / ZOOM city pixels. The camera looks ahead of a moving car by 0.3 × its
  speed, but no further than keeps the car 24 pixels inside the view across and 16 up and down. The police notice
  the player from 150, 120 and 130 screen pixels, as before: those distances are divided by ZOOM in the city.
- **The choices:**

  | Zoom | A person beside a sedan | The view | Notes |
  |---|---|---|---|
  | 1 | wider than it (12 screen pixels against 11) | 320 × 176 | the old look |
  | **2** (the default) | a little over half its width | 160 × 88 | about half a second of road ahead flat out |
  | 3 | about a third, true to life (0.6 m against 1.8 m) | 107 × 59 | a short view for driving |

  The player changes it with **Z**, or the SCALE button on the info page. It is remembered.
- **Changing it in play** keeps everyone where they are. People already about keep their pace on screen, a
  scooter its speed, and the view centres on the player.

> **C64 note.** The C64 version has one scale, its own choice. At 2, a car is an X- and Y-expanded sprite (a 24 ×
> 21 sprite drawn 48 × 42, enough for a 40 × 22 car) and a tile is 4 × 4 characters. But the view scrolls a
> character a frame at most, so top speeds in city pixels would halve unless the scrolling goes faster. At 1, it
> stays as it is, with people as big as cars.

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
  - 12 screen pixels across, hands included: 8 of shoulders and a hand each side. Add the outline to that. In
    the city that is 12 × PERSON pixels: 6 at the default scale.
  - Each frame is 24 × 24 screen pixels, with room for an arm held out and two outlines at any angle.
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
distance is measured from the person's middle, in city pixels. The person's part goes by PERSON (see
[The scale](#the-scale)).

| What | Distance | At the default scale |
|---|---|---|
| A bullet hits a person | 5 × PERSON + 1 | 3.5 |
| A moving car runs someone over, from the car's middle | 5 + 5 × PERSON | 7.5 |
| …or from the point 6 pixels ahead of its middle | 4 + 5 × PERSON | 6.5 |
| A car hurts the player | 5 + 5 × PERSON | 7.5 |
| Traffic brakes for someone this far either side of its line… | 5.5 + 3.5 × PERSON | 7.25 |
| …and up to this far ahead of its middle | 26 | 26 |

**Against walls**, a person's footprint stays small: four points 3 × PERSON pixels either side of their middle
(`footClear` in `js/world.js`). Doorways and pavements stay easy to walk, and shoulders may overlap a wall by a
pixel or two. The police arrest from 7 × PERSON.

**Cars are solid for anyone on foot**, stopped or moving (`carBodyAt` in `js/state.js`). A car's body is its length
and width, turned with it, and a person may come no nearer than their footprint. A car on the bottom of the canal
is out of the way. (A moving car still runs people over, as under Hit distances.)

- **A passer-by or a scooter rider** with a car in the way stops just short of it and waits 0.4 seconds
  (`ROUND_CAR`). Then they step sideways, away from the car's middle, so round its nearer end, until their way is
  clear. Then they carry on the way they were going. With no way round, or after 3 seconds, they turn another way.
- **The police on foot, and anyone fleeing**, go round the same way: blocked by a car, they step to the side away
  from its middle and keep to it until the way to where they are going is clear.
- **The player on foot** is stopped at a car's side and slides along it, and can get in from there.
- **Someone a car has stopped on top of** can walk out from under it, but never into another car or through a
  wall. Someone caught in a wall likewise walks out of the wall, but not into a car.

> **C64 note.** A figure at this size is larger than a character cell: 2 × 2 characters at least, or a
> sprite. In 2 × 2 blocks a standing figure is 6 blocks across, and with the arm out it reaches 5 blocks
> ahead of its middle. A multicolour sprite (12 double-wide pixels by 21 lines) is about 12 × 10 such blocks,
> each block one double-wide pixel two lines tall, which holds a figure at most angles. It has three colours
> plus transparent, so the player's yellow, black and white, or a police officer's light blue, blue and white
> cap, are what to keep. A figure has nine poses for each direction the C64 version keeps: five walking, the arm
> out with a gun, a fist or a knife, and lying knocked down. The C64 player on foot (mselin/Sleazeburg64#34)
> draws the five walking poses in eight directions with this figure, from the same shapes, in its
> `tools/assets.mjs`.

## Fighting on foot

`js/player.js` (fire), `js/peds.js` (`knockDown`), `MELEE`, `KO`, `KNIFE` and `AMMO_MAX` in `js/config.js`.

Fire on foot uses the gun while there is ammo. Out of ammo, the player fights hand to hand: with the knife if
they have one, otherwise with their fists. Nobody fires in the water.

| | Gun | Knife | Fists |
|---|---|---|---|
| When | ammo left | no ammo, knife | no ammo, no knife |
| Reach (screen pixels; × PERSON in the city) | a bullet | the first person within 7 of the point 10 ahead | the first person within 7 of the point 7 ahead |
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

## Pickups

`placePickup` in `js/spawner.js`, `updPickups` in `js/items.js`, drawn by `drawWorld` in `js/render.js`.

- **On the map:** 34 at once, each in the middle of a pavement, grass or plaza tile picked at random.
  - **Never where the player appears:** none within 32 pixels of the hospital or the police station
    (`SPAWN_CLEAR`). Those two points sit between two tile middles, 8 pixels from each, so a pickup there used to
    be picked up the moment the player started or came back (in about 1 game in 27).
  - **Drawn** at the city's scale: a square 8 city pixels across in its colour with a black edge 1 city pixel
    wide, and its letter filling it (a letter of the font, ZOOM screen pixels to its pixel). It bobs up and down a
    city pixel. Cash or a knife that someone drops lasts 20 seconds, and blinks in its last 4.
  - **Picked up** when the player comes within 4 + 7 × PERSON of its middle: its half width, 4 city pixels, plus
    7 screen pixels of the player. The car they drive picks it up within 11 city pixels.
  - **The bug it fixes** (mselin/gta-c64#40): after mselin/gta-c64#37, pickups and markers were drawn their old
    size on screen, which at the zoom made them half as big beside the streets, and the markers lost their letter.
  - **Back** 40 to 70 seconds later, somewhere else.

| Kind | Share | Letter (colours) | Does |
|---|---|---|---|
| Ammo | 34 % | `A` (yellow on orange) | up to 12 more, to at most 99 |
| Cash | 28 % | `$` (light green on green) | $50 to $300, in steps of $50 |
| Donut | 18 % | `O` (white on light red) | one level of heat less, or nothing with no heat |
| Bandage | 14 % | `+` (red on white) | 40 health back, to at most 100, and costs $20 |
| Knife | 6 % | `K` (black on light grey) | see [Fighting on foot](#fighting-on-foot) |

- **Dropped by people the player kills** (except scooter riders, which pay $0): cash 40 % of the time
  ($10 to $90 in steps of $10), or a knife 8 % if the player has none. A dropped pickup lasts 20 seconds and
  flashes in its last 4.

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

The rules are in `js/cars.js`, the kinds in `KIND` and their grip in `GRIP` in `js/config.js`, and the rest of
the handling in `HANDLING` there.

| Kind | Length × width | Top speed | Acceleration | Strength (hp) | Mass | Grip |
|---|---|---|---|---|---|---|
| Sedan | 20 × 11 | 150 | 120 | 100 | 1 | 450 |
| Sports car | 20 × 10 | 215 | 180 | 80 | 0.85 | 490 |
| Van | 22 × 12 | 120 | 85 | 150 | 1.6 | 370 |
| Taxi (yellow) | 20 × 11 | 150 | 120 | 100 | 1 | 450 |
| Police (white) | 20 × 11 | 188 | 165 | 140 | 1.1 | 510 |
| Limousine (white) | 28 × 11 | 140 | 100 | 170 | 1.5 | 350 |

### Handling

Speeds are split into forward (along the car) and sideways. Each frame, in this order:

- **Steering.**
  - Below 55 px/s the car turns at 3 × speed / 55 radians a second, so it goes round its tightest circle, about
    18 pixels from its middle, whatever the speed. From 55 it turns at 3 radians a second. Going backwards,
    steering is reversed.
  - **Never sharper than the tyres hold.** Turning at w radians a second at speed v asks the tyres for v × w
    sideways. Without the handbrake the turn is kept to grip / v, so a fast car takes a wider line. This touches
    only the fastest:
    - the sports car above 163;
    - the police car above 170;
    - the limousine above 117;
    - the sedan only at its very top speed.

    At its top speed of 215 the sports car turns at 2.3 radians a second, on a line of radius 94, and holds its
    speed round the bend. (Before, it turned at 3 regardless, slid, and dropped to about 177.)
  - **The handbrake** lets the back go: the car turns 1.3 times as fast, with no grip limit, and slides.
  - **Settling on a straight line.** A car someone is driving (the player's, or a police car), going faster than
    5 either way, not spinning, not on the handbrake and with the wheel straight, that points within 0.2 radians
    (about 11°, one step of its 32-direction picture) of one of the eight ways, the axes and the diagonals, turns
    onto it at half the rate its steering would, and then keeps exactly to it (`snap`, `settle`). Otherwise a car
    let go of a little off a street's line, looking straight in its picture, would drift across the street. Turning
    is as smooth as before, and a car pointing further off any of the eight keeps the way it points.
- **Throttle:** forward speed rises by the acceleration. Top speed is 0.7 of the table's below 40 hp; backwards,
  0.4 of top speed.
- **Braking** (pulling back while going forward faster than 5) takes off 2.2 × the acceleration; once stopped,
  it reverses at 0.6 × the acceleration.
- **Drag:** 0.5 × the speed a second, always, and 45 px/s² more with no throttle. A sedan coasts from 150 to a stop
  in 122 pixels.
- **Handbrake:** takes off 1.2 × the acceleration a second.
- **Grip:** the sideways speed falls by the grip (the table's, in px/s²) and by 1.2 × itself a second. Grip is
  multiplied by:
  - 0.28 on the handbrake;
  - 0.6 braking;
  - 0.85 below 40 hp;
  - 1 − 0.5 w wading (see Water);
  - 0.55 on grass.
- **Grass** is hard going as well as slippery: 0.8 × the forward speed a second more drag. A sedan tops out at
  about 91 on grass, and coasts from 150 to a stop in 69 pixels.
- **Skid marks** when sliding faster than 26, braking above 75, on the handbrake above 30, spinning the wheels (a
  car faster off the line than 150 px/s², below 45), or spinning round faster than 2 radians a second.

The same driving comes out the same at 30, 60 or 144 frames a second, to within 3 pixels.

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

### Water

`wetness`, `flood` and `sinkStep` in `js/cars.js`; `sinkStage` in `js/entities.js`; the pictures in `submerge`
in `js/sprites.js`.

The canal and the fountain pools are water. Water is not a wall: a car drives into it, and pays for it.

- **How wet:** three points along the car, its middle and `length/2 − 3` ahead of and behind it, are each over
  water or not, so a car is 0, ⅓, ⅔ or wholly in the water. Call that w.
- **Wading:**
  - acceleration × (1 − 0.6 w);
  - the car loses 4 w times its forward speed a second, on top of the usual drag;
  - top speed × (1 − 0.7 w), and backwards 0.4 of that, as always;
  - grip × (1 − 0.5 w), so it slides more;
  - braking is as on land;
  - spray flies up from it while it goes faster than 20.

  Wholly in the water a sedan could do at most 45, and it gets nowhere near that.
- **Flooding:** a car wholly in the water after it moves floods, once and for good.
  - The engine dies: no more throttle or steering. It drifts to a stop, its speed falling by 4 times itself a
    second.
  - A fire goes out, and a wreck floods like any other car.
  - It splashes.
  - Traffic, a parked car or a police car is no one's any more: its driver has gone.
  - **The player** in it is left in the water where it went down, swimming, with the message
    `THE CAR IS GONE. SWIM FOR IT. THE WARRANTY DOES NOT COVER THIS.` If it was a job's car, the job fails.
  - Nobody can get into it again.
- **Sinking:** it goes down over 4 seconds, with bubbles rising, drawn in three stages:
  1. for the first 30 %, awash to the sills: the waterline laps round its edge in light blue (14);
  2. to 75 %, water over the bodywork: every other pixel is blue (6), light colours show through in light
     blue, and its rim is gone;
  3. then on the bottom: a dark shape in black and blue, with only the glass catching the light and ripples
     across it. It stays there.

  Smoke stops once it is 30 % down.
- **On the bottom** it is out of the way: other cars pass over it, and bullets cannot reach it.

> **C64 note.** The sinking pictures are the car's picture redrawn three ways in every direction it keeps: for
> a car in 16 directions, 48 more sprite frames. Changing only the sprite's colour for each stage costs no
> frames, and nor does putting it behind the water's characters, though the water's own colour then hides it.

### Car against car

Two cars meet when their ends touch: each car is two circles of radius 5.5, 5 pixels ahead of and behind its
middle. Cars that overlap are pushed apart. Then, if they are closing:

- **Weight.** They part with 0.3 of the speed they closed at (`bounce`), and the heavier car is pushed the less:
  car A's speed changes by 1.3 × the closing speed × m_B / (m_A + m_B). Two cars of the same weight each take 0.65
  of it, as before cars had weights. Just after a van at 150 hits a still sports car, the sports car is doing
  about 96 and the van 62. The other way round, the van is doing about 64 and the sports car 21.
- **Traffic on its rails** is not moved by a soft touch, and the other car takes 0.65 of the closing speed alone,
  as off a wall. A hard knock (closing faster than 35) knocks traffic off its rails, and the rule above applies.
- **Damage**, when closing faster than 40: (closing − 40) × 0.22, the lighter car taking more, × 2 m_other /
  (m_A + m_B). Two of the same weight take the same.
- **Spin.** The push lands where they touch: half way between each pair of ends that meet, weighted by how far
  they overlap. A push off a car's middle turns it as well, by (r × Δv) / (3.5 × (L² + W²) / 12) radians a
  second, where r runs from its middle to where it was hit (`spinInertia` is the 3.5).
  - A sedan T-boned at 150 just behind its middle turns about 0.9 radians, its tail going the way it was pushed.
  - Hit square in the middle, it hardly turns.
  - The tyres stop a spin at grip / 80 radians a second each second (`spinGrip`): a sedan spinning at 4 stops
    in 0.7 seconds.
  - A spin that would swing the car into a wall stops. A flooded car does not spin.

> **C64 note.** Weight is a number for each kind, and the shares for each pair of kinds can be a 6 × 6 table, so
> a crash needs no division. Spin is one multiplication a crash and one subtraction a frame; with traffic on
> rails and few cars, the C64 version can leave it until there are crashes to spin. Steering held to the grip
> is a table of the most turn for each speed.

### Cursed driver assistance

`js/adas.js`; the numbers are `ADAS` in `js/config.js`.

Some cars come with driver assistance, all of it cursed. It works only while the player drives: the city's own
drivers switched it off long ago. Nothing shows which a car has until it acts.

- **Which cars** (`fitAssists`): each car, as it is parked at the start or appears in traffic, has each of these by
  its share, each rolled on its own: lane assist 20 %, emergency braking 25 %, anti-theft 20 %. Sports cars twice
  as often. Never the job's limo or the car beside the hospital at the start. A police car never has lane assist
  or emergency braking, but every one has anti-theft, on the same timer as any other car.
- **Cursed lane assist.** After 6 to 14 seconds (at random) of driving faster than 50, it takes the wheel for 0.8
  seconds: hard one way, then every 0.2 seconds hard one way or the other, changing its mind 2 times in 3. The
  player's steering does nothing meanwhile; the throttle and brakes still work. Then it gives the wheel back and
  waits again. The status line says `CURSED LANE ASSIST TOOK OVER`, with a chime.
- **Emergency braking**, going forward faster than 30 or reversing faster than 10.
  - **How far it looks:** going forward, 2 car lengths, or as far as the car needs to stop if that is more. That
    is braking 1.5 times as hard as its own brakes, with 0.06 seconds to notice and 4 pixels to spare:
    v² / (2 × 3.3 × acceleration) + 0.06 v + 4. A sedan looks 40 pixels ahead up to about 147, a sports car at 215
    56. Reversing, it looks 1 car length behind its back bumper.
  - **What it looks for:** people in the car's way, within HIT.car + 1 of the line it drives along; ahead, counted
    from where it would run them over, and behind, from its back bumper. Also other cars' bodies, at the corners
    and the middle of the bumper it is going towards, and walls.
  - **What it sees:** people walking or riding, and cars moving faster than 10, every time. Things standing still
    (walls, parked cars and wrecks, someone knocked down or waiting at a car, a cultist in their ring) only 35 % of
    the time. That is decided once for each thing as the car comes up to it, and kept until nothing has been in
    the way for a second.
  - **Seen:** it brakes hard, whatever the throttle, to a full stop, even if the way clears. Steering still works.
    The status line says `EMERGENCY BRAKING ENGAGED`, with three quick beeps.
  - **Stopped:** holding the gas the way it was going does nothing. The player has to let go of it and press it
    again. Still holding it, the status line says `LIFT OFF THE GAS, THEN PRESS AGAIN`. The other way works at
    once: after a stop going forward, the car reverses straight away.
  - Below 30 going forward it does not look out, so the player can creep up to anything; and a car going slower
    than 30 runs nobody over.
- **Anti-theft.** After 10 to 25 seconds (at random) with the player at the wheel, it stops the car for good: no
  engine, and no engine sound, and the brakes on until it has stopped. The status line says
  `ANTI-THEFT ENGAGED: ENGINE IMMOBILISED`. Getting back in says `THE IMMOBILISER SAYS NO`, and it still will not
  go.
  - **The alarm** sounds for 20 seconds: a high note (1250 Hz) and a low one (850 Hz) in turn, each 0.25 seconds,
    in square waves, quieter the further away the player is and unheard from 300 pixels. With each high note its
    hazard lights flash: 3 × 3 city pixels in yellow (7), at its four corners. It stops if the car burns out or
    floods. Nobody comes to see.
  - **Its status line** (`ALARM_SAYS`): 7 seconds in, once the anti-theft message has had its time, if the player
    can hear the alarm, one of these, at random: `BWEEP BWEEP. NOBODY LOOKS UP.`,
    `THE CAR ALARM WAILS. NOBODY CARES.`, `CAR ALARM: SLEAZEBURG'S CITY ANTHEM`, `THE ALARM REPORTS YOU TO NO ONE`,
    `CAR ALARMS: IGNORED SINCE 1987` or `CAR ALARM: WHAT DID YOU EXPECT?`. A stolen police car's alarm always says
    `CAR ALARM: WHAT DID YOU EXPECT?` (`ALARM_COP`).

> **C64 note.** The alarm takes a SID voice for its 20 seconds. Emergency braking is one look along the car's way
> each frame: how far, from a table for each kind and speed (never under 2 car lengths ahead), the few people and
> cars about, and a few steps of the wall test. Letting go of the gas and pressing it again is one bit.

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

**The police notice the player** when they come this close (`NOTICE` in `js/config.js`), in city pixels: the
same screen distance at any scale, about the edge of the view (75, 60 and 65 at the default 2):

| Who | Distance |
|---|---|
| A police car already chasing | 150 / ZOOM |
| An officer on foot | 120 / ZOOM |
| A police car on patrol in ordinary traffic | 130 / ZOOM |

**Cooling down:** with heat above 0 and no chasing car or officer near, the heat drops one level every
9 seconds. Its points fall to that level's threshold.

**The siren:** with heat above 0 and the police near (a chasing car within `NOTICE.car`, or an officer on foot within `NOTICE.foot`
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

**GAGGLE cameras** (`js/cams.js`; the numbers are `CAM` in `js/config.js`): the city's surveillance network, on
poles at a scattering of crossings.

- **Where:** at each crossing where 3 × avenue + 2 × street (counting from 0) is a multiple of 5, 17 in all, on
  the pavement at the first corner, going round from the south-east, that is pavement or plaza: 22 pixels each
  way from the middle of the crossing.
- **What one sees:** anything within 90 pixels with no building, tree or fountain in the way. One that is going
  off or has been put out of action sees nothing.
- **A crime it sees** (the player where it is when they commit it): any crime counts half again. Its light flashes
  for a second, and the next police car comes at once rather than in its turn. At most every 6 seconds the status
  line says one of `CAM_SEEN`, at random:
  `GAGGLE CAM: SHARED WITH 3,000 AGENCIES`, `GAGGLE CAM SAW THAT. SO DID THE COPS.`,
  `GAGGLE CAM: SMILE. THIS IS EVIDENCE.`, `GAGGLE CAM: YOUR GOOD SIDE, REPORTED`,
  `GAGGLE CAM: CRIME LOGGED. AND SOLD.`, `GAGGLE CAM: TRENDING AT PRECINCT 64`.
- **Reckless driving it sees** is a crime of 2: faster than 125 on the road, or faster than 60 on a pavement or
  plaza. Each camera reports it at most every 4 seconds.
- **Watching:** while a camera sees the player with heat above 0, the heat does not cool, police near or not.
- **Putting one out of action:** the player's car going faster than 15 into it (its pole within the car's body
  and 1.5 pixels), or one of the player's bullets within 6 pixels of a point 5 pixels up its pole.
  - **The alarm first:** for 3 seconds it warbles, a square wave at 1700 Hz and 1300 Hz in turn, every 0.15
    seconds, quieter the further away the player is and unheard from 300 pixels, its light flashing with the
    high note. Sparks fly. The tampering is a crime of 4, and the next police car comes at once. The status line
    says one of `CAM_TAMPER`: `GAGGLE CAM: TAMPERING DETECTED. HELP!`, `GAGGLE CAM: THIS INCIDENT IS LOGGED!`,
    `GAGGLE CAM: YOU CANNOT DELETE THE CLOUD`.
  - **Then it goes dark,** and the status line says one of `CAM_DOWN`: `GAGGLE CAM OFFLINE. PRIVACY, BRIEFLY.`,
    `GAGGLE CAM DOWN. A PIGEON APPLAUDS.`, `GAGGLE CAM: 404 CRIME NOT FOUND`, `GAGGLE CAM DOWN. THE GEESE APPROVE.`
  - **Back up:** the city puts it back up 120 seconds later, once it is off the screen.
- **The look,** at the city's scale: a dark grey (11) pole 1 × 8 pixels with a black camera 5 × 3 on top, and a
  light 2 × 2 at its front, light red (10): on for a third of every 2 seconds as it records, flashing 4 times a
  second after a report, and with the alarm's high note while it goes off. Out of action, the pole lies on the
  ground, 8 × 1, with the camera 3 × 3 at its end.

> **C64 note.** The cameras are fixed: a table of 17 places, and one character, or two, for each, in the
> city's own characters. What a camera sees can be a list of the characters it watches, worked out ahead,
> rather than a line of sight each frame.

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

## The status panel

The 24 pixels under the city (`drawWorld` in `js/render.js`): three lines of text, 40 characters each, on
black, under a dark grey (11) line. Positions are in pixels from the left; a character is 8.

**Line 1: money, heat, health, the car and what fire does.**

| What | At | Shown | Colour |
|---|---|---|---|
| Money | 0 | `$` and six digits, `$000000` | light green (13) |
| Heat | 64 | `HEAT`, then five `*` from 100, 8 apart | the word light grey (15); a star for each level flashes red (2) and yellow (7), the rest dark grey (11) |
| Health | 148 | `HP`, then a bar from 168, 42 wide | green (5), red (2) at 30 or below |
| The car, only in one | 214 | `CAR`, then a bar from 240, 28 wide | cyan (3), red (2) under 40 |
| What fire does | right-aligned | `AMMO` and two digits (`AMMO12`), else `KNIFE` or `FIST` | yellow (7), light grey (15) or light red (10) |

`AMMO99` takes the last 48 pixels, from 272. Ammo stops at 99, so it is always two digits. See
[Fighting on foot](#fighting-on-foot).

**Line 2: the job.** Its title (the first 24 characters) in yellow (7). At 216 its progress in white: `2/3` for
kills and wrecks, the seconds held and the target for surviving (`12/30S`), or the player's own crossing for the
cult. At 280 the time left as `m:ss`, white, flashing red under 15 seconds. With no job:
`NO JOB. FOLLOW THE ARROW TO A "J".` in grey (12).

**Line 3: messages.**
- **The latest message,** in white. One longer than 40 characters scrolls left after a second, at 70 pixels a
  second, and stops at its end.
- **Otherwise, in a car with the radio on,** `RADIO`, the station and what is playing, in light blue (14),
  scrolling round when it is too long.
- **Otherwise** `ELECTION FUND: $` and the money ` / $25000`, in dark grey (11).

> **C64 note.** The panel is three rows of 40 characters, the same as the C64 version's panel under its raster
> split. Some of the browser game's positions fall between character columns (the stars from 100, `HP` at 148,
> `CAR` at 214), so the C64 version rounds them to whole columns. It draws the bars with characters filled a
> pixel column at a time. `AMMO99` is columns 34-39.

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
- **Choosing the scale** (Z, or the SCALE button on the info page): see [The scale](#the-scale). The C64 version has
  one scale.
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
