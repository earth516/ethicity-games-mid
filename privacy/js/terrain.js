/* Continuous outdoor ground. World/collision data remains owned by world.js. */
(function () {
  'use strict';
  var world = window.PRIVACY_WORLD, size = 48, ground = null, images = {};
  function canvas(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  // Mirroring joins the exact same edge pixels, even for non-seamless source art.
  function pattern(ctx, image) {
    var n = size * 8, c = canvas(n * 2, n * 2), p = c.getContext('2d');
    for (var y = 0; y < 2; y++) for (var x = 0; x < 2; x++) {
      p.save(); p.translate(x ? n * 2 : 0, y ? n * 2 : 0);
      p.scale(x ? -1 : 1, y ? -1 : 1); p.drawImage(image, 0, 0, n, n); p.restore();
    }
    return ctx.createPattern(c, 'repeat');
  }
  function road(x, y) {
    var c = world.grid[y] && world.grid[y][x];
    return c === 'p' || c === 'y' || c === 'o' || (c === 'd' && x === 22);
  }
  function build() {
    if (!images.grass || !images.path) return;
    ground = canvas(world.W * size, world.H * size);
    var c = ground.getContext('2d');
    c.fillStyle = pattern(c, images.grass); c.fillRect(0, 0, ground.width, ground.height);
    var mask = canvas(ground.width, ground.height), m = mask.getContext('2d');
    m.fillStyle = '#fff';
    for (var y = 0; y < world.H; y++) for (var x = 0; x < world.W; x++) {
      if (!road(x, y)) continue;
      var top = road(x, y - 1), right = road(x + 1, y), bottom = road(x, y + 1), left = road(x - 1, y);
      m.beginPath();
      m.roundRect(x * size, y * size, size, size,
        [!top && !left ? 16 : 0, !top && !right ? 16 : 0,
          !bottom && !right ? 16 : 0, !bottom && !left ? 16 : 0]);
      m.fill();
    }
    m.globalCompositeOperation = 'source-in';
    m.fillStyle = pattern(m, images.path); m.fillRect(0, 0, mask.width, mask.height);
    c.drawImage(mask, 0, 0);
    // Small, deterministic edge blades soften straight road boundaries; no moving noise.
    for (var yy = 0; yy < world.H; yy++) for (var xx = 0; xx < world.W; xx++) {
      if (!road(xx, yy)) continue;
      [[0,-1],[1,0],[0,1],[-1,0]].forEach(function (d, side) {
        if (road(xx + d[0], yy + d[1])) return;
        for (var i = 0; i < 4; i++) {
          var offset = 12 + i * 8 + ((xx * 7 + yy * 3 + i) % 5);
          var bx = xx * size + (side === 1 ? size : side === 3 ? 0 : offset);
          var by = yy * size + (side === 0 ? 0 : side === 2 ? size : offset);
          c.strokeStyle = i % 2 ? '#7eaa4e' : '#91b757'; c.lineWidth = 1.5;
          c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - d[0] * 3 + 1, by - d[1] * 3 - 2); c.stroke();
        }
      });
    }
  }
  ['grass', 'path'].forEach(function (name) {
    var im = new Image(); im.onload = function () { images[name] = im; build(); };
    im.src = 'assets/terrain/' + name + '.png';
  });
  window.PrivacyTerrain = {
    drawCell: function (ctx, ch, x, y, tile, cam) {
      if (!ground || !('gpyoHTfe'.indexOf(ch) >= 0 || (ch === 'd' && x === 22))) return false;
      var dx = Math.round(x * tile - cam.x), dy = Math.round(y * tile - cam.y);
      ctx.drawImage(ground, x * size, y * size, size, size, dx, dy,
        Math.round((x + 1) * tile - cam.x) - dx, Math.round((y + 1) * tile - cam.y) - dy);
      return true;
    }
  };
}());
