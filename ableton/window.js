// The picture in the README: `node ableton/window.js` redraws ableton/window.png.
// An arpeggio over two octaves, engraved.
require('./kit/test/picture.js')(__dirname, { bundle: 'StartingBlocksNotation.js', w: 1240, h: 169,
  go(d) { d.ctx.setSetting('cat', 2); d.ctx.setSetting('octaves', 2); } });
