/* School art and roof visibility; gameplay grid/objects remain in world.js. */
(function () {
  'use strict';
  var assets = {}, wood = null;
  var names = ['exterior', 'desk', 'teacher-desk', 'bookcase', 'locker', 'board', 'window', 'pc', 'wood'];
  function contains(x, y) { return x >= 0 && x < 22 && y >= 0 && y < 11; }
  names.forEach(function (name) {
    var im = new Image();
    im.onload = function () {
      var b = [0, 0, im.naturalWidth, im.naturalHeight];
      try {
        var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
        var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
        if (name !== 'wood') {
          var p = g.getImageData(0, 0, c.width, c.height).data, l = c.width, t = c.height, r = -1, d = -1;
          for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) {
            if (p[(y * c.width + x) * 4 + 3] < 16) continue;
            l = Math.min(l, x); t = Math.min(t, y); r = Math.max(r, x); d = Math.max(d, y);
          }
          if (r >= l) b = [l, t, r - l + 1, d - t + 1];
        } else {
          wood = document.createElement('canvas'); wood.width = 1056; wood.height = 528;
          // One continuous flooring surface, no per-cell image borders.
          var wg = wood.getContext('2d'), unit = 384;
          for (var yy = 0; yy < 2; yy++) for (var xx = 0; xx < 3; xx++) {
            wg.save(); wg.translate((xx + (xx % 2)) * unit, (yy + (yy % 2)) * unit);
            wg.scale(xx % 2 ? -1 : 1, yy % 2 ? -1 : 1); wg.drawImage(im, 0, 0, unit, unit); wg.restore();
          }
        }
      } catch (_) { /* Full-image fallback for file:// pixel restrictions. */ }
      assets[name] = { image: im, box: b };
    };
    window.PrivacyImg.load(im, 'assets/school/' + name + '.png');
  });
  function sprite(ctx, name, x, y, w, h, tile, cam) {
    var a = assets[name]; if (!a) return false;
    var b = a.box;
    ctx.drawImage(a.image, b[0], b[1], b[2], b[3], Math.round(x * tile - cam.x), Math.round(y * tile - cam.y), Math.round(w * tile), Math.round(h * tile));
    return true;
  }
  function cell(ctx, ch, x, y, tile, cam, room) {
    if (!contains(x, y)) return false;
    var px = Math.round(x * tile - cam.x), py = Math.round(y * tile - cam.y);
    var w = Math.round((x + 1) * tile - cam.x) - px, h = Math.round((y + 1) * tile - cam.y) - py;
    ctx.save(); ctx.translate(px, py);
    if (ch === 'c' || ch === 'l') {
      ctx.fillStyle = '#ddcfb2'; ctx.fillRect(0, 0, w, h);
      if (wood) ctx.drawImage(wood, x * 48, y * 48, 48, 48, 0, 0, w, h);
      if (ch === 'l') { ctx.fillStyle = 'rgba(233,237,219,0.14)'; ctx.fillRect(0, 0, w, h); }
    } else if (ch === 'h') {
      ctx.fillStyle = '#e4e7df'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d2d8ce'; ctx.fillRect(0, h - 1, w, 1);
      if (x % 2 === 0) ctx.fillRect(0, 0, 1, h);
      ctx.fillStyle = '#b7c9bf'; ctx.fillRect(0, y === 8 ? 0 : h - 3, w, 3);
    } else if (ch === '#') {
      if ((x === 0 || x === 9 || x === 11 || x === 21) && y !== 0 && y !== (room ? 6 : 7) && y !== 10) {
        // Continuous vertical wall cap: never repeat a horizontal skirting each cell.
        ctx.fillStyle = '#e4e8dc'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f8f7ed'; ctx.fillRect(w * 0.12, 0, w * 0.66, h);
        ctx.fillStyle = '#a7b9a9'; ctx.fillRect(w * 0.78, 0, w * 0.16, h);
        ctx.fillStyle = '#7c9183'; ctx.fillRect(w - 2, 0, 2, h);
        ctx.restore(); return true;
      }
      // Plaster wall with a warm timber skirting and sage lower panel.
      ctx.fillStyle = '#eceee6'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#fffdf4'; ctx.fillRect(0, 0, w, Math.max(2, tile * 0.06));
      ctx.fillStyle = '#c2d0c3'; ctx.fillRect(0, tile * 0.61, w, tile * 0.3);
      ctx.fillStyle = '#a58a65'; ctx.fillRect(0, h - tile * 0.09, w, tile * 0.07);
      ctx.fillStyle = '#697f71'; ctx.fillRect(0, h - 2, w, 2);
    } else if (ch === 'd') {
      ctx.fillStyle = '#c0a681'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f1f0e6'; ctx.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.84);
      ctx.fillStyle = '#9bbbc0'; ctx.fillRect(w * 0.17, h * 0.15, w * 0.66, h * 0.43);
      ctx.fillStyle = '#d7e9e7'; ctx.fillRect(w * 0.2, h * 0.18, w * 0.09, h * 0.35);
      ctx.fillStyle = '#526968'; ctx.fillRect(w * 0.74, h * 0.65, w * 0.06, h * 0.14);
      ctx.fillStyle = '#697f71'; ctx.fillRect(0, h - 2, w, 2);
    } else { ctx.restore(); return false; }
    ctx.restore(); return true;
  }
  // 학생 책상: 원본은 의자가 책상 뒤(교탁과 같은 방향)라, 책상과 의자 등받이를 잘라 의자를 앞(아래)에 놓는다
  // → 학생이 칠판·교탁을 보고 앉은 모습. 원본 PNG는 그대로.
  function studentDesk(ctx, x, bottom, tile, cam) {
    var a = assets.desk; if (!a) return false;
    var im = a.image, W = im.naturalWidth, H = im.naturalHeight, b = a.box;
    var kx = 1 / b[2], ky = 1.15 / b[3];            // 예전과 같은 크기 비율(폭 1칸·높이 1.15칸)
    var dy0 = Math.round(H * 0.26);                    // 책상 부분: 의자 등받이 아래부터
    var dh = (b[1] + b[3] - dy0) * ky;
    ctx.drawImage(im, b[0], dy0, b[2], b[1] + b[3] - dy0,
      Math.round(x * tile - cam.x), Math.round((bottom - dh) * tile - cam.y), Math.round(tile), Math.round(dh * tile));
    var cx0 = Math.round(W * 0.3), cw = Math.round(W * 0.4), cy0 = b[1], ch = Math.round(H * 0.235) - b[1];
    var w = cw * kx, h = ch * ky;                      // 의자 등받이(뒤에서 본 모습)를 책상 앞쪽에 겹쳐
    ctx.drawImage(im, cx0, cy0, cw, ch,
      Math.round((x + (1 - w) / 2) * tile - cam.x), Math.round((bottom + 0.08 - h) * tile - cam.y), Math.round(w * tile), Math.round(h * tile));
    return true;
  }
  function object(ctx, ob, tile, cam, pcOn) {
    if (!contains(ob.x, ob.y)) return false;
    var bottom = ob.y + ob.h, name, width = ob.w, height;
    if (/^desk\d/.test(ob.id)) return studentDesk(ctx, ob.x, bottom, tile, cam);
    else if (ob.id === 'tdesk') { name = 'teacher-desk'; height = 1.2; }
    else if (ob.id === 'board') { name = 'board'; height = 0.92; }
    else if (ob.id === 'locker') { name = 'locker'; height = 1.8; }
    else if (ob.id === 'shelf') {
      if (!assets.bookcase) return false;
      for (var i = 0; i < ob.w; i += 3) sprite(ctx, 'bookcase', ob.x + i, bottom - 1.45, 3, 1.45, tile, cam);
      return true;
    } else if (/^pc[123]$/.test(ob.id)) { name = 'pc'; height = 1.18; }
    else if (ob.id === 'notice') {
      var sx = ob.x * tile - cam.x, sy = ob.y * tile - cam.y;
      ctx.fillStyle = '#a58964'; ctx.fillRect(sx + 3, sy + 5, tile * 2 - 6, tile - 10);
      ctx.fillStyle = '#d6b78b'; ctx.fillRect(sx + 6, sy + 8, tile * 2 - 12, tile - 16);
      ['#f7f2df', '#dbe9de', '#f2d8bd'].forEach(function (color, index) {
        ctx.fillStyle = color; ctx.fillRect(sx + tile * (0.18 + index * 0.55), sy + tile * 0.24, tile * 0.43, tile * 0.49);
        ctx.fillStyle = '#658378'; ctx.fillRect(sx + tile * (0.36 + index * 0.55), sy + tile * 0.21, 3, 3);
      });
      return true;
    } else return false;
    if (!sprite(ctx, name, ob.x, bottom - height, width, height, tile, cam)) return false;
    if (name === 'pc') {
      if (ob.id !== 'pc3' || !pcOn) {
        ctx.fillStyle = '#263e48';
        ctx.fillRect((ob.x + 0.18) * tile - cam.x, (bottom - height + height * 0.035) * tile - cam.y, tile * 0.64, tile * height * 0.18);
      }
      var cx = (ob.x + 0.5) * tile - cam.x, cy = (bottom - 0.1) * tile - cam.y;
      ctx.fillStyle = '#334c50'; ctx.fillRect(cx - tile * 0.25, cy - tile * 0.16, tile * 0.5, tile * 0.24);
      ctx.fillStyle = '#fff'; ctx.font = 'bold ' + Math.max(10, Math.round(tile * 0.19)) + 'px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ob.id.slice(2) + '번', cx, cy - tile * 0.04);
      if (ob.id === 'pc3' && pcOn) { ctx.fillStyle = '#5bd5bc'; ctx.fillRect(cx + tile * 0.29, cy - tile * 0.16, 4, 4); }
    }
    return true;
  }
  function details(ctx, tile, cam) {
    [[8.2,0.1,2.45,0.75],[13,0.08,3,0.8],[17.3,0.08,3,0.8],[2,10.06,2.5,0.77],[6,10.06,2.5,0.77],[14,10.06,2.5,0.77],[18,10.06,2.5,0.77]].forEach(function (r) {
      sprite(ctx, 'window', r[0], r[1], r[2], r[3], tile, cam);
    });
    ctx.save(); ctx.font = '600 ' + Math.max(11, Math.round(tile * 0.22)) + 'px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    [[6.2,7.48,'2학년 3반'],[12.7,7.48,'도서관']].forEach(function (r) {
      var x = r[0] * tile - cam.x, y = r[1] * tile - cam.y;
      ctx.fillStyle = '#416e65'; ctx.fillRect(x - 4, y - tile * 0.18, tile * 1.55, tile * 0.36);
      ctx.fillStyle = '#fff'; ctx.fillText(r[2], x, y);
    }); ctx.restore();
  }
  function exterior(ctx, tile, cam) {
    if (sprite(ctx, 'exterior', 0, 0, 22, 11, tile, cam)) return;
    // Opaque fallback also hides the interior while the image loads/fails.
    ctx.fillStyle = '#526a74'; ctx.fillRect(-cam.x, -cam.y, 22 * tile, 11 * tile);
    ctx.fillStyle = '#e9e7dc'; ctx.fillRect(-cam.x, 8 * tile - cam.y, 22 * tile, 3 * tile);
    ctx.fillStyle = '#759da3'; ctx.fillRect(10 * tile - cam.x, 9 * tile - cam.y, 2 * tile, 2 * tile);
  }
  window.PrivacySchool = { contains: contains, cell: cell, sprite: sprite, object: object, details: details, exterior: exterior,
    ready: function () { return names.every(function (n) { return !!assets[n]; }); } };
}());
