/* Bedroom interior: same material palette as school, separate furniture/art. */
(function () {
  'use strict';
  var assets = {};
  ['bed', 'plush'].forEach(function (name) {
    var im = new Image(); im.onload = function () {
      var b = [0, 0, im.naturalWidth, im.naturalHeight];
      try {
        var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
        var p = g.getImageData(0, 0, c.width, c.height).data, l = c.width, t = c.height, r = -1, d = -1;
        for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) {
          if (p[(y * c.width + x) * 4 + 3] < 16) continue;
          l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); d = Math.max(d, y);
        }
        if (r >= l) b = [l, t, r - l + 1, d - t + 1];
      } catch (_) { /* file:// fallback */ }
      assets[name] = { image: im, box: b };
    }; im.src = 'assets/room/' + name + '.png';
  });
  function sprite(ctx, name, x, y, w, h, tile, cam) {
    var a = assets[name]; if (!a) return false;
    var b = a.box;
    ctx.drawImage(a.image, b[0], b[1], b[2], b[3], Math.round(x * tile - cam.x), Math.round(y * tile - cam.y), w * tile, h * tile);
    return true;
  }
  window.PrivacyRoom = {
    ready: function () { return !!assets.bed && !!assets.plush; },
    cell: function (ctx, ch, x, y, tile, cam) {
      return window.PrivacySchool.cell(ctx, ch === 'r' ? 'c' : ch === 'x' ? 'd' : ch,
        x - 30, y - 2, tile, { x: cam.x - 30 * tile, y: cam.y - 2 * tile }, true);
    },
    details: function (ctx, tile, cam) {
      window.PrivacySchool.sprite(ctx, 'window', 33, 2.08, 3, 0.82, tile, cam);
      // Soft woven rug, safely walkable and visually separate from the room border.
      var x = 33 * tile - cam.x, y = 5 * tile - cam.y;
      ctx.fillStyle = '#bdcfc5'; ctx.beginPath(); ctx.roundRect(x, y, tile * 3, tile * 2, tile * 0.2); ctx.fill();
      ctx.strokeStyle = '#e6eade'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x + 6, y + 6, tile * 3 - 12, tile * 2 - 12, tile * 0.13); ctx.stroke();
    },
    object: function (ctx, ob, tile, cam) {
      if (ob.id === 'bed') return sprite(ctx, 'bed', ob.x, ob.y - 0.1, 1.1, 2.1, tile, cam);
      if (ob.id === 'plush') return sprite(ctx, 'plush', ob.x, ob.y, 2, 2, tile, cam);
      if (ob.id === 'mybook') return window.PrivacySchool.sprite(ctx, 'bookcase', ob.x, ob.y - 0.4, 1, 1.4, tile, cam);
      if (ob.id === 'mypc') return window.PrivacySchool.sprite(ctx, 'pc', ob.x + 0.35, ob.y - 0.4, 1.3, 1.4, tile, cam);
      return false;
    }
  };
}());
