// SPDX-License-Identifier: GPL-2.0-or-later
// The browser check on the loading screen (js/compat.js), run against made-up browsers: what it calls fatal, what
// it only warns about, and that a complete browser gets neither.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// compat.js is a classic script, not a module: run it as the browser would, in a context of its own.
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../../js/compat.js', import.meta.url), 'utf8'), context);
const { check } = context.sleazeburgCompat;

/** A browser with everything the game uses. `touch` makes it a phone; `change` takes things away. */
function browser({ touch = false, change = () => {} } = {}) {
  const storage = new Map();
  const w = {
    Object,
    Array,
    BigInt64Array,
    WebAssembly: {},
    AudioContext: function () {},
    AudioWorkletNode: function () {},
    PointerEvent: function () {},
    requestAnimationFrame: () => 0,
    navigator: {},
    localStorage: {
      setItem: (k, v) => storage.set(k, String(v)),
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      removeItem: (k) => storage.delete(k),
    },
    matchMedia: (q) => ({
      matches: q === '(pointer: coarse)' ? touch : q === '(any-pointer: fine)' ? !touch : false,
    }),
    document: {
      fullscreenEnabled: true,
      documentElement: { requestFullscreen: () => {} },
      createElement: (tag) =>
        tag === 'script'
          ? { noModule: false }
          : { getContext: () => ({ createImageData: () => {}, drawImage: () => {} }) },
    },
  };
  change(w);
  return w;
}
// Arrays made in the script's own context: copied into this one, so they compare equal.
const ids = (items) => Array.from(items, (i) => i.id).sort();

test('a complete browser, desktop or phone, gets no warnings and nothing fatal', () => {
  for (const touch of [false, true]) {
    const r = check(browser({ touch }));
    assert.deepEqual([ids(r.fatal), ids(r.warn)], [[], []], touch ? 'phone' : 'desktop');
  }
});

test('what the game cannot run without is fatal', () => {
  const fatal = (change, touch = false) => ids(check(browser({ touch, change })).fatal);
  assert.deepEqual(
    fatal(
      (w) => (w.document.createElement = (t) => (t === 'script' ? {} : browser().document.createElement(t))),
    ),
    ['modules'],
  );
  assert.deepEqual(
    fatal((w) => (w.Object = { ...Object, hasOwn: undefined })),
    ['js'],
  );
  assert.deepEqual(
    fatal((w) => (w.Array = { prototype: {} })),
    ['js'],
  );
  assert.deepEqual(
    fatal(
      (w) =>
        (w.document.createElement = (t) =>
          t === 'script' ? { noModule: false } : { getContext: () => null }),
    ),
    ['canvas'],
  );
  assert.deepEqual(
    fatal((w) => delete w.requestAnimationFrame),
    ['frames'],
  );
  // Touch controls need pointer events, on a phone; with a mouse or keyboard they are not needed.
  assert.deepEqual(
    fatal((w) => delete w.PointerEvent, true),
    ['touch'],
  );
  assert.deepEqual(
    fatal((w) => delete w.PointerEvent, false),
    [],
  );
  // A check that throws counts as missing, not as a crash.
  assert.deepEqual(
    fatal((w) => {
      w.document.createElement = () => {
        throw new Error('no');
      };
    }),
    ['canvas', 'modules'],
  );
});

test('what only part of the game needs is a warning', () => {
  const warn = (change, touch = false) => {
    const r = check(browser({ touch, change }));
    assert.equal(r.fatal.length, 0);
    return ids(r.warn);
  };
  assert.deepEqual(
    warn((w) => delete w.AudioContext),
    ['sound'],
  );
  assert.deepEqual(
    warn((w) => {
      delete w.AudioContext;
      w.webkitAudioContext = function () {};
    }),
    [],
    'the old Safari name will do',
  );
  assert.deepEqual(
    warn((w) => delete w.WebAssembly),
    ['music'],
  );
  assert.deepEqual(
    warn((w) => delete w.AudioWorkletNode),
    ['music'],
  );
  assert.deepEqual(
    warn((w) => delete w.BigInt64Array),
    ['music'],
  );
  assert.deepEqual(
    warn((w) => {
      delete w.AudioContext;
      delete w.WebAssembly;
    }),
    ['sound'],
    'no sound at all says so once',
  );
  assert.deepEqual(
    warn((w) => {
      w.localStorage.setItem = () => {
        throw new Error('QuotaExceededError');
      };
    }),
    ['storage'],
  );
  assert.deepEqual(
    warn((w) => delete w.localStorage),
    ['storage'],
  );
});

test('no full screen is worth a warning on a phone only, and not when started from the home screen', () => {
  const noFull = (w) => (w.document.fullscreenEnabled = false);
  const warn = (change, touch) => ids(check(browser({ touch, change })).warn);
  assert.deepEqual(warn(noFull, true), ['fullscreen']);
  assert.deepEqual(
    warn((w) => delete w.document.documentElement.requestFullscreen, true),
    ['fullscreen'],
  );
  assert.deepEqual(warn(noFull, false), [], 'a desktop browser has its own full-screen key');
  assert.deepEqual(
    warn((w) => {
      noFull(w);
      w.navigator.standalone = true;
    }, true),
    [],
    'an iPhone web app is full screen already',
  );
  assert.deepEqual(
    warn((w) => {
      noFull(w);
      const mm = w.matchMedia;
      w.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true } : mm(q));
    }, true),
    [],
  );
});

test('every message says what is missing in plain words, and none is empty', () => {
  const nothing = browser({
    touch: true,
    change: (w) => {
      for (const k of ['AudioContext', 'requestAnimationFrame', 'PointerEvent', 'localStorage']) delete w[k];
      w.document = { createElement: () => ({}) };
      w.Object = {};
    },
  });
  const r = check(nothing);
  assert.deepEqual(ids(r.fatal), ['canvas', 'frames', 'js', 'modules', 'touch']);
  assert.deepEqual(ids(r.warn), ['fullscreen', 'sound', 'storage']);
  for (const item of [...r.fatal, ...r.warn]) {
    assert.ok(typeof item.text === 'string' && item.text.length > 10 && item.text.length < 160, item.id);
    assert.doesNotMatch(item.text, /undefined|null|NaN/);
  }
});

test('the script is a classic script that runs anywhere: no import or export, nothing shown without a page', () => {
  const src = readFileSync(new URL('../../js/compat.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /^\s*(import|export)\b/m);
  assert.equal(context.sleazeburgCompat.result, null, 'with no document it only defines check()');
  assert.ok(context.sleazeburgCompat.START_WAIT >= 2000);
});
