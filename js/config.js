// SPDX-License-Identifier: GPL-2.0-or-later
// Constants: palette, screen and map sizes, tile types, car types and all the game's text tables.

export const PAL = [
  '#000000',
  '#ffffff',
  '#68372b',
  '#70a4b2',
  '#6f3d86',
  '#588d43',
  '#352879',
  '#b8c76f',
  '#6f4f25',
  '#433900',
  '#9a6759',
  '#444444',
  '#6c6c6c',
  '#9ad284',
  '#6c5eb5',
  '#959595',
];
export const RGB = PAL.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);
export const SW = 320,
  SH = 200,
  VH = 176,
  BX = 32,
  BY = 36,
  PI = Math.PI;
/**
 * The scale. The map, the cars and everything else in the city are drawn ZOOM screen pixels to a city pixel,
 * while people keep their size on screen: so in the city a person is PERSON of what they were, closer to their
 * real size beside a car. Everything about a person's body (how big a target, how far a fist reaches, the
 * footprint, the pace) is in city pixels times PERSON, so it looks and plays on screen as before. VIEW_W and
 * VIEW_H are how much of the city the view shows, in city pixels.
 */
export let ZOOM = 2,
  PERSON = 1 / 2,
  VIEW_W = 320 / 2,
  VIEW_H = 176 / 2;
/**
 * The scales a player can choose, in the browser and desktop versions (Z, or the info page): 1, the old look,
 * people as big as cars; 2, the default; 3, true to scale but a short view for driving. The C64 version has one.
 */
export const ZOOMS = [1, 2, 3],
  DEFAULT_ZOOM = 2;
/** The kinds of car. `m` is the mass, a sedan's being 1: it decides who pushes whom in a crash. */
/**
 * The boot, in seconds from the start: LOADING appears at `loading`; from `picture` the screen goes black and the
 * sunset picture loads in a character row at a time, the border flashing, until it has all arrived at `loaded`;
 * then READY. and RUN, and the title screen at `end`.
 */
export const BOOT = { loading: 3.3, picture: 3.6, loaded: 6.2, ready: 6.6, end: 7.4 };
/** The title screen shows its two pages in turn: the text for `text` seconds, then the sunset picture. */
export const TITLE_PAGES = { text: 10, picture: 8 };
export const KIND = {
  sedan: { n: 'sedan', L: 20, W: 11, max: 150, acc: 120, hp: 100, m: 1 },
  sports: { n: 'sports', L: 20, W: 10, max: 215, acc: 180, hp: 80, m: 0.85 },
  van: { n: 'van', L: 22, W: 12, max: 120, acc: 85, hp: 150, m: 1.6 },
  taxi: { n: 'taxi', L: 20, W: 11, max: 150, acc: 120, hp: 100, m: 1, col: 7 },
  police: { n: 'police', L: 20, W: 11, max: 188, acc: 165, hp: 140, m: 1.1, col: 1 },
  limo: { n: 'limo', L: 28, W: 11, max: 140, acc: 100, hp: 170, m: 1.5, col: 1 },
};
export const CCOLS = [2, 4, 5, 8, 10, 13, 14, 3, 15];
export const T = 16,
  NB = 8,
  PB = 12,
  MW = NB * PB + 2,
  WPX = MW * T,
  BLK = PB * T;
/**
 * Big Honk, Sleazeburg's crime boss, a goose. He lives on The Moat: its banks and the canal between them, x0 to
 * x1, the whole length of the city. Where a new game finds him, his speed waddling and running off (px/s), how
 * long he flaps when something would have hurt anyone else (s), and how often he will cross a road.
 */
export const HONK = {
  x0: (4 * PB + 2) * T,
  x1: 5 * PB * T,
  x: (4 * PB + 2) * T + 8,
  y: (4 * PB + 4) * T + 8,
  spd: 0, // walking and running: 18 and 44 screen pixels a second, set by setZoom
  run: 0,
  flapT: 1.2,
  jay: 0.3,
};
export const ROAD = 0,
  WALK = 1,
  BLD = 2,
  GRASS = 3,
  WATER = 4,
  LOT = 5,
  PLAZA = 6,
  TREE = 7,
  FOUNT = 8;
export const SPECIAL = {
  '1,1': { col: 1, txt: 'ST. INVOICE', tc: 2, cross: 1 },
  '6,2': { col: 6, txt: 'PRECINCT 64', tc: 1 },
  '2,5': { col: 15, txt: 'CITY HALL', tc: 0 },
  '6,6': { col: 9, txt: 'CHOP SHOP', tc: 7 },
  '1,6': { col: 4, txt: 'PAINT & PRAY', tc: 1 },
};
export const SHOPS = [
  'VAPE & PRAY',
  'CRYPTO PAWN',
  'KALE HUT',
  'GYM (CLOSED)',
  'LOANS 4 U',
  'RENT: LOL',
  'ARTISAN ICE',
  'NFT OUTLET',
  'BANK OF OOPS',
  'DISCOUNT LAW',
  'WEWONTWORK',
  'AVOCADO BANK',
  'SYNERGY LTD',
  'BAIL BONDS',
  'LUXURY FLATS',
  'OAT MILK DEPOT',
  'TOTALLY A SPA',
  'HEDGE FUN',
  'PODCAST HQ',
  'THOUGHTS&PRAYERS',
];
/**
 * How close things must come to someone on foot to hit them, from the middle of the person, in city pixels.
 * People are drawn about 10 screen pixels across, 5 × PERSON city pixels either side of their middle (see
 * figures.js), so these match what is on screen. Their footprint against walls (footClear in world.js) stays
 * smaller, so doorways and pavements stay easy.
 */
export const HIT = {}; // shot, car, nose, lane, ahead: set by setZoom
//  shot: a bullet: the shoulder, and half the 2 px bullet
//  car: a moving car's middle: (about) half its 11 px width and the shoulder
//  nose: the point 6 px ahead of a moving car's middle: its front bumper and the shoulder past it
//  lane: traffic brakes for someone this far either side of the line it drives along
//  ahead: and up to this far ahead of its middle, so it stops before its bumper gets there
/** A person's pace, in city pixels a second: the player walking and swimming, and passers-by and police on foot. */
export const PACE = {}; // walk, swim, civ (and up to civMore more), cop, flee, wade: set by setZoom
/** How near a pickup the player on foot must come, and the player's car. */
export const PICKUP = {}; // foot, car: set by setZoom
/**
 * Hand to hand, when the player is out of ammo: a blow lands at the point `ahead` px in front of the player and
 * hits the first person within `r` of it; `cd` is the wait before the next. A punch knocks someone down; a stab
 * kills, and reaches farther.
 */
export const MELEE = { fist: { cd: 0.35 }, knife: { cd: 0.28 } }; // ahead and r: set by setZoom
/** Knocked down: how long someone stays down, in seconds, and the heat for it, half of what a kill brings. */
export const KO = { t: 4, crime: 3, copCrime: 14 };
/** The most ammo the player can carry: two digits, as the HUD shows it (AMMO99). */
export const AMMO_MAX = 99;
/** How often a pickup on the map is a knife, and how often someone the player kills drops one. */
export const KNIFE = { map: 0.06, drop: 0.08 };
/** The numerology cult: which crossing they meet at (counting avenues from the west and streets from the north, from 1) and how many turn up. */
export const CULT = { ave: 6, st: 7, members: 7 };
/** The districts of the city: the id used in code and saved data, and the name shown on screen. */
export const DISTRICTS = {
  gentrifia: 'GENTRIFIA',
  debt_valley: 'DEBT VALLEY',
  hoa_heights: 'HOA HEIGHTS',
  crypto_docks: 'CRYPTO DOCKS',
  the_moat: 'THE MOAT',
};
export const GOAL = 25000,
  HT = [0, 8, 25, 60, 110, 180];
/**
 * How close the police must be to notice the player, in city pixels from the player (or the player's car).
 * Noticing keeps the heat from cooling, puts a patrol car in traffic onto the chase, and spots a stolen cruiser.
 * About the edge of the view, which is 1 / ZOOM of what it was: the police notice no one they are not on screen
 * with.
 */
export const NOTICE = {}; // car (chasing), foot (an officer), patrol: set by setZoom
/** Driving a police car where the police can see it: the heat goes up to at least this. */
export const STOLEN_CRUISER_HEAT = 2;
export const HEATMSG = [
  '',
  'HEAT 1: A STERN LETTER IS BEING DRAFTED',
  'HEAT 2: POLICE DISPATCHED. EVENTUALLY.',
  'HEAT 3: SHOOT FIRST, PAPERWORK NEVER',
  'HEAT 4: OVERTIME HAS BEEN APPROVED',
  'HEAT 5: THE HOMEOWNERS ASSOCIATION HAS BEEN NOTIFIED',
];
export const NEWS = [
  'NEWS: MAYOR DENIES EXISTENCE OF POTHOLES, FALLS INTO ONE',
  'NEWS: RENT UP 40%. LANDLORDS CITE "VIBES"',
  "NEWS: CITY BUDGET FOUND. IT WAS IN THE MAYOR'S OTHER JACKET",
  'NEWS: NEW BIKE LANE OPENS, IS IMMEDIATELY A PARKING SPACE',
  'NEWS: LOCAL MAN STILL ON HOLD WITH THE BANK SINCE 1986',
  'NEWS: POLICE SEIZE LEMONADE STAND, CITE "ORGANISED CITRUS"',
  'NEWS: CRYPTO DOCKS FLOODED. COINS STILL NOT LIQUID',
  'NEWS: E-SCOOTER COUNT NOW EXCEEDS POPULATION',
  'NEWS: COUNCIL VOTES 9-0 TO GIVE COUNCIL A RAISE',
  'AD: SID FM - ALL THREE VOICES, ALL THE TIME',
  'AD: PAINT & PRAY - NEW COLOUR, SAME SINS. $200',
  'NEWS: TRAFFIC TODAY IS "A PERSONAL CHOICE" SAYS TRANSPORT CHIEF',
  'NEWS: HOSPITAL INTRODUCES PREMIUM OXYGEN TIER',
  'TIP: DONUTS REDUCE HEAT. DO NOT ASK HOW.',
];
export const JACK = [
  'DRIVER: "I\'M LEAVING ONE STAR."',
  'DRIVER: "IT\'S A LEASE ANYWAY."',
  'DRIVER: "FINALLY, A REASON TO WALK."',
  'DRIVER: "MY PODCAST WILL HEAR ABOUT THIS."',
  'DRIVER: "JOKE\'S ON YOU, IT NEEDS A SERVICE."',
];
/**
 * GAGGLE cameras (js/cams.js, and specs/design.md under Heat and the police): the city's surveillance network, on
 * poles at the crossings where (3 × avenue + 2 × street) is a multiple of `every`. In city pixels and seconds:
 * - see: how far one sees, where no building is in the way;
 * - boost: a crime one sees counts this much more; while one sees the player with heat, the heat does not cool;
 * - speeding, pavement: driving faster than these, on the road or on a pavement or plaza, one reports, as a
 *   crime of `reckless`, at most once each `again` seconds;
 * - knock, hit: the player's car going faster than `knock` into one, or a bullet within `hit` of it, sets off its
 *   alarm for `alarm` seconds (a note every `beat`, heard up to `heard` away), reporting tampering as a crime of
 *   `tamper`; then it goes dark, until the city puts it back up `fix` seconds later, out of sight;
 * - sayGap: the least time between two of its messages about crimes it saw.
 */
export const CAM = {
  name: 'GAGGLE',
  every: 5,
  see: 90,
  boost: 0.5,
  speeding: 125,
  pavement: 60,
  reckless: 2,
  again: 4,
  knock: 15,
  hit: 4,
  alarm: 3,
  beat: 0.15,
  heard: 300,
  tamper: 4,
  fix: 120,
  sayGap: 6,
};
const CN = CAM.name;
/** What the status line says when a camera sees a crime, at random. */
export const CAM_SEEN = [
  `${CN} CAM: SHARED WITH 3,000 AGENCIES`,
  `${CN} CAM SAW THAT. SO DID THE COPS.`,
  `${CN} CAM: SMILE. THIS IS EVIDENCE.`,
  `${CN} CAM: YOUR GOOD SIDE, REPORTED`,
  `${CN} CAM: CRIME LOGGED. AND SOLD.`,
  `${CN} CAM: TRENDING AT PRECINCT 64`,
];
/** When the player rams or shoots one, and its alarm starts. */
export const CAM_TAMPER = [
  `${CN} CAM: TAMPERING DETECTED. HELP!`,
  `${CN} CAM: THIS INCIDENT IS LOGGED!`,
  `${CN} CAM: YOU CANNOT DELETE THE CLOUD`,
];
/** When its alarm has run out and it goes dark. */
export const CAM_DOWN = [
  `${CN} CAM OFFLINE. PRIVACY, BRIEFLY.`,
  `${CN} CAM DOWN. A PIGEON APPLAUDS.`,
  `${CN} CAM: 404 CRIME NOT FOUND`,
  `${CN} CAM DOWN. THE GEESE APPROVE.`,
];
/**
 * What the status line says about a car alarm the player can hear, a while into it (js/adas.js): one of
 * ALARM_SAYS at random, or ALARM_COP, always, for a stolen police car.
 */
export const ALARM_COP = 'CAR ALARM: WHAT DID YOU EXPECT?';
export const ALARM_SAYS = [
  'BWEEP BWEEP. NOBODY LOOKS UP.',
  'THE CAR ALARM WAILS. NOBODY CARES.',
  "CAR ALARM: SLEAZEBURG'S CITY ANTHEM",
  'THE ALARM REPORTS YOU TO NO ONE',
  'CAR ALARMS: IGNORED SINCE 1987',
  ALARM_COP,
];
export const JOBS = [
  {
    t: 'PIZZA? SURE.',
    type: 'go',
    time: 70,
    pay: 1500,
    txt: 'DELIVER THE "PIZZA". DO NOT OPEN THE "PIZZA".',
  },
  {
    t: 'SCOOTER SEASON',
    type: 'kill',
    n: 3,
    time: 110,
    pay: 2000,
    txt: 'FLATTEN 3 E-SCOOTER BROS. THE PAVEMENT THANKS YOU.',
  },
  {
    t: 'EXECUTIVE TRANSPORT',
    type: 'steal',
    time: 160,
    pay: 4000,
    txt: "BORROW THE MAYOR'S LIMO. BRING IT TO THE CHOP SHOP.",
  },
  {
    t: 'PARKING DISPUTE',
    type: 'wreck',
    n: 3,
    time: 130,
    pay: 3000,
    txt: 'BLOW UP 3 CARS. THE INSURANCE LOBBY SENDS REGARDS.',
  },
  {
    // No arrow for this one: the player has to count streets. Timer and reward are in the cult's own numbers.
    t: 'THE CULT OF 6-7',
    type: 'find',
    time: 167,
    pay: 6700,
    txt: 'FIND THE NUMEROLOGY CULT. NO ARROW: THEY MEET WHERE AVENUE 6 CROSSES STREET 7. YOUR OWN CROSSING SHOWS NEXT TO THE TIMER.',
  },
  {
    t: 'CONSULTING FEE',
    type: 'go',
    time: 60,
    pay: 2500,
    txt: 'BRING THE ENVELOPE TO THE DROP. NO, THE OTHER ENVELOPE.',
  },
  {
    t: 'GOING VIRAL',
    type: 'survive',
    n: 30,
    time: 160,
    pay: 3500,
    txt: 'A STREAMER WANTS CONTENT: HOLD HEAT 2+ FOR 30 SECONDS.',
  },
  {
    t: 'MICROMOBILITY AUDIT',
    type: 'kill',
    n: 5,
    time: 140,
    pay: 3500,
    txt: '5 MORE SCOOTER BROS. THEY RESPAWN FASTER THAN POTHOLES.',
  },
  {
    t: 'ASSET RELOCATION',
    type: 'steal',
    time: 150,
    pay: 4500,
    txt: 'THE MAYOR BOUGHT A NEW LIMO. YOU KNOW WHAT TO DO.',
  },
];
export const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export const GRIP = { sedan: 450, sports: 490, van: 370, taxi: 450, police: 510, limo: 350 };
/**
 * The rest of the handling (js/cars.js, and specs/design.md under Cars):
 * - grass: what is left of the grip there, and the extra drag that slows a car on it, per second;
 * - spin: how much a knock off the middle turns a car (bigger is less), and how fast its tyres stop the spin, in
 *   radians a second each second for each unit of grip;
 * - bounce: what share of the closing speed two cars part with after a crash;
 * - snap, settle: a car someone is driving, with the wheel straight, within `snap` radians of one of the eight
 *   ways (the axes and the diagonals), turns onto it at `settle` of the rate its steering would, and keeps to it.
 */
export const HANDLING = {
  grassGrip: 0.55,
  grassDrag: 0.8,
  spinInertia: 3.5,
  spinGrip: 1 / 80,
  bounce: 0.3,
  snap: 0.2,
  settle: 0.5,
};
/**
 * Cursed driver assistance (js/adas.js, and specs/design.md under Cars). What share of cars has each, sports cars
 * `sports` times as many; and how each behaves while the player drives. Speeds in city pixels a second, times in
 * seconds.
 * - lane: lane assist takes the wheel after `swerveEvery` seconds driven faster than `swerveFrom`, holds it for
 *   `swerveFor`, turning it hard one way or the other for `swerveJerk` at a time, and changing its mind `flip` of
 *   the time;
 * - brake: emergency braking looks out ahead faster than `brakeFrom`, and behind reversing faster than
 *   `reverseFrom`. Ahead it looks `lookAhead` car lengths, or further if the car needs more to stop, braking
 *   `brakeHard` times as hard as its own brakes, `gap` short, with `react` seconds to notice; behind,
 *   `lookBehind` car lengths. It sees people and cars on the move every time, and things standing still
 *   `brakeStill` of the time. It brakes just as hard as it must to come to rest `stopGap` short of what it saw;
 * - theft: anti-theft stops the car after `stealAfter` seconds of the player driving it; its alarm sounds for
 *   `alarmFor`, a note every `alarmBeat`, heard up to `alarmHeard` away. `alarmSay` seconds in, once the
 *   anti-theft message has had its time, the status line says one of ALARM_SAYS, if the player can hear it.
 */
export const ADAS = {
  lane: 0.2,
  brake: 0.25,
  theft: 0.2,
  sports: 2,
  swerveFrom: 50,
  swerveEvery: [6, 14],
  swerveFor: 0.8,
  swerveJerk: 0.2,
  flip: 2 / 3,
  brakeFrom: 30,
  reverseFrom: 10,
  lookAhead: 2,
  lookBehind: 1,
  brakeHard: 1.5,
  brakeStill: 0.35,
  gap: 4,
  stopGap: 3,
  react: 0.06,
  stealAfter: [10, 25],
  alarmFor: 20,
  alarmBeat: 0.25,
  alarmHeard: 300,
  alarmSay: 7,
};

/**
 * Set the scale, and everything worked out from it. Positions in the city stay where they are; a person becomes
 * PERSON of their old size in the city, so they keep their size on screen, and so do their pace and reach.
 */
export function setZoom(z) {
  ZOOM = z;
  PERSON = 1 / z;
  VIEW_W = 320 / z;
  VIEW_H = 176 / z;
  Object.assign(HIT, {
    shot: 5 * PERSON + 1,
    car: 5 + 5 * PERSON,
    nose: 4 + 5 * PERSON,
    lane: 5.5 + 3.5 * PERSON,
    ahead: 26,
  });
  Object.assign(PACE, {
    walk: 58 * PERSON,
    swim: 22 * PERSON,
    civ: 15 * PERSON,
    civMore: 8 * PERSON,
    cop: 47 * PERSON,
    flee: 48 * PERSON,
    wade: 45 * PERSON,
  });
  // A pickup is 8 city pixels square, drawn at the city's scale: reached from its edge, 4 from its middle, by
  // a person's 7 screen pixels.
  Object.assign(PICKUP, { foot: 4 + 7 * PERSON, car: 11 });
  Object.assign(MELEE.fist, { ahead: 7 * PERSON, r: 7 * PERSON });
  Object.assign(MELEE.knife, { ahead: 10 * PERSON, r: 7 * PERSON });
  // About the edge of the view: the police notice no one they are not on screen with.
  Object.assign(NOTICE, { car: 150 / z, foot: 120 / z, patrol: 130 / z });
  HONK.spd = 18 * PERSON;
  HONK.run = 44 * PERSON;
}
setZoom(DEFAULT_ZOOM);
