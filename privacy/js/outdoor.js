/* Outdoor replacement art. Transparent padding is trimmed only when drawing;
 * source files and the world's collision grid remain unchanged. */
(function () {
  'use strict';
  var assets = {};
  ['tree', 'lamp', 'bench', 'pond'].forEach(function (name) {
    var im = new Image();
    im.onload = function () {
      var box = [0, 0, im.naturalWidth, im.naturalHeight];
      try {
        var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        var ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(im, 0, 0);
        var data = ctx.getImageData(0, 0, c.width, c.height).data;
        var left = c.width, top = c.height, right = -1, bottom = -1;
        for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) {
          if (data[(y * c.width + x) * 4 + 3] < 16) continue;
          left = Math.min(left, x); top = Math.min(top, y);
          right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
        if (right >= left) box = [left, top, right - left + 1, bottom - top + 1];
      } catch (_) { /* file:// may block pixel reads; use the full image. */ }
      assets[name] = { image: im, box: box };
    };
    im.src = 'assets/outdoor/' + name + '.png';
  });
  function draw(ctx, name, x, bottom, width, height, tile, cam) {
    var a = assets[name]; if (!a) return false;
    var b = a.box;
    ctx.drawImage(a.image, b[0], b[1], b[2], b[3],
      Math.round(x * tile - cam.x), Math.round((bottom - height) * tile - cam.y),
      Math.round(width * tile), Math.round(height * tile));
    return true;
  }
  window.PrivacyOutdoor = { ready: function (name) { return !!assets[name]; }, draw: draw };
}());
