/*
 * 주택가·학교 담장 그림 — 이웃집 3채·우편함·낮은 담장·열린 교문·생울타리.
 * 충돌·좌표는 world.js가 가진다(이 파일은 그리기만). 원본 PNG는 그대로 두고, 투명 여백 경계는 불러올 때 한 번만 잰다.
 *   collect(list, ctx, T, cam, view) : 담장·교문·생울타리를 앞뒤 정렬 목록(list)에 넣는다
 *   drawObject(ctx, ob, T, cam)      : ob.art(이웃집·우편함)를 그린다. 그림이 아직 없으면 false
 */
(function () {
  'use strict';
  var WD = window.PRIVACY_WORLD;
  var DIR = 'assets/neighborhood/';
  var assets = {};

  function alphaBox(im, x0, x1) {
    var box = [x0, 0, x1 - x0, im.naturalHeight];
    try {
      var c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      var g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      var d = g.getImageData(0, 0, c.width, c.height).data;
      var l = x1, t = c.height, r = -1, b = -1;
      for (var y = 0; y < c.height; y++) for (var x = x0; x < x1; x++) {
        if (d[(y * c.width + x) * 4 + 3] < 16) continue;
        if (x < l) l = x; if (y < t) t = y; if (x > r) r = x; if (y > b) b = y;
      }
      if (r >= l) box = [l, t, r - l + 1, b - t + 1];
    } catch (_) { /* file://에서 픽셀을 못 읽으면 전체 그림 */ }
    return box;
  }
  ['house-brick', 'house-sage', 'house-balcony', 'fence-front', 'fence-side', 'gate-parts', 'hedge', 'mailbox'].forEach(function (name) {
    var im = new Image();
    im.onload = function () {
      var w = im.naturalWidth;
      if (name === 'gate-parts') {
        // 한 그림에 기둥+열린 문짝 부품 두 개가 나란히 — 가운데를 기준으로 따로 잘라 위·아래 기둥으로 쓴다
        assets['gate-a'] = { image: im, box: alphaBox(im, 0, Math.floor(w / 2)) };
        assets['gate-b'] = { image: im, box: alphaBox(im, Math.floor(w / 2), w) };
      } else assets[name] = { image: im, box: alphaBox(im, 0, w) };
    };
    im.src = DIR + name + '.png';
  });

  // 그림 한 장을 칸 좌표(왼쪽 x, 아래 bottom, 폭·높이)에 그린다
  function put(ctx, name, x, bottom, width, height, T, cam) {
    var a = assets[name]; if (!a) return false;
    var b = a.box;
    ctx.drawImage(a.image, b[0], b[1], b[2], b[3],
      Math.round(x * T - cam.x), Math.round((bottom - height) * T - cam.y), Math.round(width * T), Math.round(height * T));
    return true;
  }
  function ratio(name) { var a = assets[name]; return a ? a.box[3] / a.box[2] : 1; }

  /* ── 담장 구간: 격자의 'f'에서 한 번만 계산(가로·세로 나눔, 교문 기둥 칸 제외) ── */
  var segs = null;
  function isF(x, y) { return WD.tile(x, y) === 'f'; }
  var GATE = { top: { x: 22, y: 15 }, bottom: { x: 22, y: 18 } };
  function isGatePost(x, y) { return (x === GATE.top.x && y === GATE.top.y) || (x === GATE.bottom.x && y === GATE.bottom.y); }
  function horiz(x, y) { return isF(x - 1, y) || isF(x + 1, y); }
  function buildSegs() {
    segs = [];
    var x, y, start, len, n, i;
    for (y = 0; y < WD.H; y++) { // 가로: 이어진 'f' 줄
      for (x = 0; x < WD.W; x++) {
        if (!isF(x, y) || !horiz(x, y) || isGatePost(x, y)) continue;
        start = x; while (isF(x + 1, y) && !isGatePost(x + 1, y)) x++;
        len = x - start + 1; n = Math.max(1, Math.round(len / 3.2));
        for (i = 0; i < n; i++) segs.push({ kind: 'h', x: start + i * len / n, y: y, len: len / n });
      }
    }
    for (x = 0; x < WD.W; x++) { // 세로: 가로 구간·교문 기둥을 뺀 'f' 열
      for (y = 0; y < WD.H; y++) {
        if (!isF(x, y) || horiz(x, y) || isGatePost(x, y)) continue;
        start = y; while (isF(x, y + 1) && !horiz(x, y + 1) && !isGatePost(x, y + 1)) y++;
        len = y - start + 1; n = Math.max(1, Math.round(len / 3.2));
        for (i = 0; i < n; i++) segs.push({ kind: 'v', x: x, y: start + i * len / n, len: len / n });
      }
    }
    segs.push({ kind: 'gate', part: 'gate-a', x: GATE.top.x, y: GATE.top.y });
    segs.push({ kind: 'gate', part: 'gate-b', x: GATE.bottom.x, y: GATE.bottom.y });
  }
  function fencesReady() { return !!(assets['fence-front'] && assets['fence-side'] && assets['gate-a'] && assets['gate-b']); }

  function drawSeg(ctx, s, T, cam) {
    if (s.kind === 'h') { // 낮은 벽돌 담장(허리 높이), 이웃 구간과 기둥이 겹치게 조금 넓게
      put(ctx, 'fence-front', s.x - 0.06, s.y + 1, s.len + 0.12, 0.85, T, cam);
    } else if (s.kind === 'v') { // 세로 담장은 세로 그림(가로 그림을 돌리지 않음)
      var h = s.len + 0.6, w = Math.min(0.75, h / ratio('fence-side'));
      put(ctx, 'fence-side', s.x + 0.5 - w / 2, s.y + s.len, w, h, T, cam);
    } else { // 교문 기둥 + 열린 문짝(마을 쪽으로 열림, 통로 칸은 비움)
      var gh = 1.7, gw = gh / ratio(s.part);
      put(ctx, s.part, s.x + 0.5 - gw * 0.32, s.y + 1, gw, gh, T, cam);
      if (s.part === 'gate-a') { // 학교 명패: 글자는 코드로
        var px = (s.x + 0.5) * T - cam.x, py = (s.y - 0.95) * T - cam.y;
        ctx.save();
        ctx.font = '600 ' + Math.max(11, Math.round(T * 0.24)) + 'px sans-serif';
        var tw = ctx.measureText('솔빛학교').width + 12;
        ctx.fillStyle = 'rgba(244,240,226,0.96)'; ctx.fillRect(px - tw / 2, py - T * 0.18, tw, T * 0.36);
        ctx.strokeStyle = '#7C8C7A'; ctx.lineWidth = 1; ctx.strokeRect(px - tw / 2 + 0.5, py - T * 0.18 + 0.5, tw - 1, T * 0.36 - 1);
        ctx.fillStyle = '#3F5A4C'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('솔빛학교', px, py);
        ctx.restore();
      }
    }
  }
  // 그림이 아직 없을 때: 낮은 담장 색 막대(충돌 칸이 보이도록)
  function fallbackFence(ctx, x, y, T, cam) {
    ctx.fillStyle = '#E3D7BC'; ctx.fillRect(x * T - cam.x, (y + 0.45) * T - cam.y, T + 1, T * 0.55);
    ctx.fillStyle = '#8FA48C'; ctx.fillRect(x * T - cam.x, (y + 0.4) * T - cam.y, T + 1, T * 0.08);
  }

  function collect(list, ctx, T, cam, v) {
    if (!segs) buildSegs();
    var fr = fencesReady();
    if (fr) {
      segs.forEach(function (s) {
        var x1 = s.kind === 'h' ? s.x + s.len : s.x + 1, y1 = s.kind === 'v' ? s.y + s.len : s.y + 1;
        if (x1 < v.x0 - 2 || s.x > v.x1 + 2 || y1 < v.y0 - 2 || s.y > v.y1 + 3) return;
        list.push({ y: s.kind === 'v' ? s.y + s.len - 1 : s.y, fn: function () { drawSeg(ctx, s, T, cam); } });
      });
    }
    for (var y = Math.max(0, v.y0 - 1); y <= Math.min(WD.H - 1, v.y1 + 1); y++) {
      for (var x = Math.max(0, v.x0 - 1); x <= Math.min(WD.W - 1, v.x1 + 1); x++) {
        var ch = WD.tile(x, y);
        if (ch === 'f' && !fr) list.push({ y: y, fn: (function (xx, yy) { return function () { fallbackFence(ctx, xx, yy, T, cam); }; })(x, y) });
        if (ch === 'e') list.push({ y: y, fn: (function (xx, yy) { return function () { hedge(ctx, xx, yy, T, cam); }; })(x, y) });
      }
    }
  }
  function hedge(ctx, x, y, T, cam) { // 관목을 조금씩 겹쳐 이어 붙임
    if (put(ctx, 'hedge', x - 0.18, y + 1, 1.36, 0.8, T, cam)) return;
    ctx.fillStyle = '#5E8F48'; ctx.beginPath();
    ctx.ellipse((x + 0.5) * T - cam.x, (y + 0.65) * T - cam.y, T * 0.62, T * 0.36, 0, 0, 7); ctx.fill();
  }

  function drawObject(ctx, ob, T, cam) {
    if (!ob.art || !assets[ob.art]) return false;
    if (ob.art === 'mailbox') { // 우리 집 표시: 노란 우편함(약 0.9칸 높이)
      var mh = 0.95, mw = mh / ratio('mailbox');
      return put(ctx, 'mailbox', ob.x + 0.5 - mw / 2, ob.y + 1, mw, mh, T, cam);
    }
    var w = ob.drawW || ob.w, h = w * ratio(ob.art);
    return put(ctx, ob.art, ob.x + (ob.w - w) / 2, ob.y + ob.h + 0.15, w, h, T, cam);
  }
  // 큰 그림이 위로 솟아 화면 안으로 들어오는 높이(칸) — 화면 밖 컬링 여유
  function rise(ob) { return ob.art && ob.art.indexOf('house') === 0 ? Math.ceil((ob.drawW || ob.w) * ratio(ob.art) - ob.h) + 1 : 1; }

  window.PrivacyNeighborhood = {
    collect: collect, drawObject: drawObject, rise: rise, fencesReady: fencesReady,
    ready: function (name) { return !!assets[name]; }
  };
}());
