/* The Max for Live device, run in Node on a pretend Max and a pretend Live.
 *   python3 ableton/kit/build.py ableton/device.json && node --test ableton/tests/ */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const suite = require('../kit/test/generator_suite.js');
require('../kit/test/palette_suite.js')();

const { device } = suite({ bundle: path.join(__dirname, '..', 'StartingBlocksNotation.js'), name: 'Starting Blocks Notation', varies: false, width: 1240 });

test('every block is engraved, and fits the device', () => {
  const d = device({ width: 1240 });
  for (const cat of [1, 2, 3, 4]) {
    d.ctx.setSetting('cat', cat);
    for (let k = 0; k < d.ctx.S.results.length; k++) {
      d.ctx.S.chosen = k;
      const sc = d.ctx.engraving();
      assert.ok(!sc.error, sc.error);
      assert.ok(sc.ops.length > 6, 'block ' + cat + '/' + k + ' drew ' + sc.ops.length);
      assert.ok(sc.ops.some((o) => o[0] === 'poly'), 'glyphs drawn');
    }
  }
});

test('the score follows the key: F# major has six sharps', () => {
  const d = device({ width: 1240 });
  d.ctx.setKey(9, 1);
  const sharps = d.ctx.engraving().ops.filter((o) => o[0] === 'poly').length;
  d.ctx.setKey(1, 1);
  const plain = d.ctx.engraving().ops.filter((o) => o[0] === 'poly').length;
  assert.ok(sharps >= plain + 6, 'F# major draws its key signature: ' + sharps + ' against ' + plain);
});
