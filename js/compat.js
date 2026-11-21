// SPDX-License-Identifier: GPL-2.0-or-later
// The browser check on the loading screen. A classic script in plain old JavaScript (lint holds it to ES5), so it
// runs, and can say what is wrong, even in a browser far too old to load the game's modules.
//
// Before the game starts it looks for what the game needs:
// - what the game cannot run without: a full-screen message saying what is missing, in place of the game;
// - what only part of it needs, such as sound, music or full screen on a phone: a note on the loading screen,
//   which the player can dismiss, and which stays dismissed until the list changes.
// If the game has still not started a few seconds after the page has loaded, it says so, with the first error.
//
// tests/unit/compat.test.js runs check() against made-up browsers; tests/e2e/compat.test.cjs runs the page.
(function (root) {
  'use strict';

  /** How long after the page has loaded the game has to start before the check says it did not, in ms. */
  var START_WAIT = 3000;
  /** Where a dismissed note is remembered, with the list of what it was about. */
  var DISMISSED = 'sb64compat';

  /** True if f() returns something truthy without throwing. */
  function has(f) {
    try {
      return !!f();
    } catch (e) {
      return false;
    }
  }

  /**
   * What this browser lacks. `fatal` is what the game cannot run without; `warn` is what only part of it needs.
   * Each item has an id, for tests and for remembering a dismissed note, and the words shown to the player.
   */
  function check(w) {
    var d = w.document,
      fatal = [],
      warn = [];
    // A phone or tablet with no mouse or trackpad: it is played by touch alone.
    var touchOnly = has(function () {
      return w.matchMedia('(pointer: coarse)').matches && !w.matchMedia('(any-pointer: fine)').matches;
    });
    if (
      !has(function () {
        return 'noModule' in d.createElement('script');
      })
    )
      fatal.push({ id: 'modules', text: 'JavaScript modules, to load the game at all' });
    if (
      !has(function () {
        return typeof w.Object.hasOwn === 'function' && typeof w.Array.prototype.at === 'function';
      })
    )
      fatal.push({ id: 'js', text: 'JavaScript from 2022 or later' });
    if (
      !has(function () {
        var c = d.createElement('canvas').getContext('2d');
        return c && typeof c.createImageData === 'function' && typeof c.drawImage === 'function';
      })
    )
      fatal.push({ id: 'canvas', text: 'drawing on a canvas, for the picture' });
    if (typeof w.requestAnimationFrame !== 'function')
      fatal.push({ id: 'frames', text: 'animation frames, to run the game smoothly' });
    if (touchOnly && typeof w.PointerEvent !== 'function')
      fatal.push({ id: 'touch', text: 'pointer events, for the touch controls' });

    if (!w.AudioContext && !w.webkitAudioContext)
      warn.push({ id: 'sound', text: 'NO SOUND: this browser has no Web Audio.' });
    else if (
      !has(function () {
        return (
          typeof w.WebAssembly === 'object' &&
          typeof w.AudioWorkletNode === 'function' &&
          typeof w.BigInt64Array === 'function'
        );
      })
    )
      warn.push({
        id: 'music',
        text: 'NO RADIO MUSIC: the Commodore 64 music player needs WebAssembly and AudioWorklet. Sound effects still work.',
      });
    if (
      !has(function () {
        w.localStorage.setItem(DISMISSED + '-test', '1');
        w.localStorage.removeItem(DISMISSED + '-test');
        return true;
      })
    )
      warn.push({
        id: 'storage',
        text: 'SETTINGS NOT KEPT: this browser blocks storage (private browsing?), so the music setting resets every visit.',
      });
    // Already full screen when started from the home screen.
    var standalone =
      w.navigator.standalone === true ||
      has(function () {
        return (
          w.matchMedia('(display-mode: standalone)').matches ||
          w.matchMedia('(display-mode: fullscreen)').matches
        );
      });
    if (
      touchOnly &&
      !standalone &&
      !has(function () {
        return d.fullscreenEnabled && typeof d.documentElement.requestFullscreen === 'function';
      })
    )
      warn.push({
        id: 'fullscreen',
        text: "NO FULL SCREEN: this browser can't hide its address bar, so the picture is a little smaller. Turn the phone sideways for the biggest view.",
      });
    return { fatal: fatal, warn: warn };
  }

  var api = { check: check, result: null, START_WAIT: START_WAIT };
  root.sleazeburgCompat = api;
  // Under test there is no page to show anything on.
  if (!root.document || !root.document.addEventListener) return;

  var w = root,
    d = w.document,
    shown = null,
    errors = [];

  /** An element with text in it, never HTML: error messages come from outside. */
  function el(tag, cls, text) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.appendChild(d.createTextNode(text));
    return e;
  }
  function list(items) {
    var ul = el('ul');
    for (var i = 0; i < items.length; i++) ul.appendChild(el('li', '', items[i].text));
    return ul;
  }
  function clear() {
    if (shown && shown.parentNode) shown.parentNode.removeChild(shown);
    shown = null;
  }

  /** In place of the game: what is missing, or that it did not start. */
  function showFatal(items, error) {
    clear();
    var box = el('div', 'fatal');
    box.id = 'compat';
    box.setAttribute('role', 'alert');
    var inner = el('div', 'box');
    inner.appendChild(el('p', 'big', '?BROWSER ERROR'));
    if (items) {
      inner.appendChild(el('p', '', "Sleazeburg 64 can't run in this browser. It needs:"));
      inner.appendChild(list(items));
      inner.appendChild(
        el(
          'p',
          '',
          'Try a current Firefox, Chrome, Edge or Safari. On a phone or tablet, update its system and browser.'
        )
      );
    } else {
      inner.appendChild(el('p', '', 'Sleazeburg 64 did not start in this browser.'));
      if (error) inner.appendChild(el('p', 'small', error));
      inner.appendChild(
        el(
          'p',
          '',
          'Reload the page to try again. If it happens again, try a current Firefox, Chrome, Edge or Safari.'
        )
      );
      var again = el('button', '', 'RELOAD');
      again.type = 'button';
      again.addEventListener('click', function () {
        w.location.reload();
      });
      inner.appendChild(again);
    }
    box.appendChild(inner);
    d.body.appendChild(box);
    shown = box;
  }

  /** On the loading screen: what will not work, with OK to put it away. */
  function showWarn(items) {
    var key = items
      .map(function (i) {
        return i.id;
      })
      .join(',');
    var seen = has(function () {
      return w.localStorage.getItem(DISMISSED) === key;
    });
    if (seen) return;
    var box = el('div', 'warn');
    box.id = 'compat';
    box.setAttribute('role', 'status');
    box.appendChild(el('p', 'big', 'HEADS UP'));
    box.appendChild(list(items));
    var ok = el('button', '', 'OK');
    ok.type = 'button';
    ok.addEventListener('click', function () {
      try {
        w.localStorage.setItem(DISMISSED, key);
      } catch (e) {}
      clear();
    });
    box.appendChild(ok);
    d.body.appendChild(box);
    shown = box;
    // Out of the way once the game is under way.
    var timer = w.setInterval(function () {
      if (shown !== box) w.clearInterval(timer);
      else if (w.sleazeburg && w.sleazeburg.G.screen === 'play') {
        w.clearInterval(timer);
        clear();
      }
    }, 500);
  }

  var result = (api.result = check(w));
  if (result.fatal.length) {
    // Shown at once, before the game draws anything; there is no point waiting for it.
    if (d.body) showFatal(result.fatal);
    else
      d.addEventListener('DOMContentLoaded', function () {
        showFatal(result.fatal);
      });
    return;
  }
  if (result.warn.length) {
    if (d.body) showWarn(result.warn);
    else
      d.addEventListener('DOMContentLoaded', function () {
        showWarn(result.warn);
      });
  }

  // The game sets window.sleazeburg when it has started. Errors before then, from a script that would not load or
  // would not run, are kept to say what went wrong.
  w.addEventListener(
    'error',
    function (e) {
      if (w.sleazeburg) return;
      var t = e && e.target;
      if (t && t !== w && t.tagName) errors.push('Could not load ' + (t.src || t.href || t.tagName) + '.');
      else errors.push(String((e && e.message) || 'An error.'));
    },
    true
  );
  w.addEventListener('load', function () {
    w.setTimeout(function () {
      if (!w.sleazeburg) showFatal(null, errors[0]);
    }, START_WAIT);
  });
})(typeof window !== 'undefined' ? window : this);
