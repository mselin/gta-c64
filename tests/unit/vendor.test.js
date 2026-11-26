// SPDX-License-Identifier: GPL-2.0-or-later
// The vendored SID player is exactly the build its README records: each file's SHA-256 matches the table there,
// so a changed or swapped file is caught.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const dir = new URL('../../usbsid-player/', import.meta.url);

test('the vendored SID player files match the SHA-256 sums in its README', () => {
  const readme = readFileSync(new URL('README.md', dir), 'utf8'),
    rows = [...readme.matchAll(/^\| `([\w.-]+)` \| `([0-9a-f]{64})` \|$/gm)];
  assert.deepEqual(rows.map((r) => r[1]).sort(), [
    'usbsid.esm.js',
    'usbsid.wasm',
    'usplayer-audio.js',
    'usplayer-web.js',
  ]);
  for (const [, file, sum] of rows)
    assert.equal(
      createHash('sha256')
        .update(readFileSync(new URL(file, dir)))
        .digest('hex'),
      sum,
      file,
    );
});
