/*
 * 맵 화면 — 타일맵을 걸어 다니다 ❗ 대상에게 말을 걸면 사건 장면이 열린다.
 * 그림: assets/sprites/char_<인물>.png(32×48 칸, 가로 4프레임 × 세로 아래·왼·오·위)가 있으면 쓰고,
 *       없으면 임시 도형(원+머리글자+이름표)으로 그린다. 타일·가구도 지금은 임시 색 블록.
 * 조작: 방향키/WASD 이동, Space/Enter 말 걸기·조사, 화면 탭 = 그 칸까지 걸어가기(인물·사물을 탭하면 가서 말 걸기)
 */
(function () {
  'use strict';

  var WD = window.PRIVACY_WORLD;
  var STEP_MS = 150;
  var SPRITE_DIR = 'assets/sprites/';
  var ROW = { down: 0, left: 1, right: 2, up: 3 };
  var KEY_DIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
  var TILE_COLOR = {
    '#': '#9AA5A6', c: '#EADCBD', l: '#E3D8C6', h: '#DADFE0', d: '#C9A66B', g: '#A9D48C', p: '#E4CC98',
    y: '#ECDDB4', f: '#A9D48C', T: '#A9D48C', w: '#7FC3E4', H: '#C98F6B', o: '#7A4E2E', r: '#E9D4A3', x: '#7A4E2E'
  };
  var CHAR_COLOR = { me: '#0F766E', hayun: '#4E6FC9', dohyun: '#D06A2E', seoa: '#B04F8C', minjun: '#3F7F5C', teacher: '#6E6150', friend: '#7B808A' };
  var TINT = { day: null, evening: 'rgba(255,140,60,0.13)', night: 'rgba(25,35,90,0.30)' };

  var o = null;                 // init 옵션
  var canvas, ctx, wrap;
  var active = false, raf = null, tmr = null, lastT = 0;
  var run = null, trig = null, targetId = null;
  var cast = [], blocked = {};
  var me = { x: 0, y: 0, dir: 'down', fx: 0, fy: 0, moving: false, t: 0, from: null, to: null, door: null, frame: 0 };
  var held = [], path = null, actOnArrive = false, busy = false;
  var bubble = null, T = 40, viewW = 0, viewH = 0, cam = { x: 0, y: 0 }, dpr = 1;
  var sprites = {}, lastArea = '', lastLook = null;
  var srcTile = 48; // 스프라이트 원본 한 칸(px). 시트를 읽으면 자동으로 바뀐다

  /* ── 타일·가구 아틀라스(assets/sprites/tiles.png + tiles.json) ──
   * tiles.json을 읽지 못하는 환경(file:// 등)에선 아래 내장 좌표를 쓴다(납품 v2 기준).
   * 그림이 없으면 임시 색 블록으로 그린다. */
  var ATLAS = { img: null, size: 48, t: {"floor_class":[0,0,48,48],"floor_hall":[48,0,48,48],"floor_library":[96,0,48,48],"floor_sand":[144,0,48,48],"floor_dirt":[192,0,48,48],"floor_grass":[240,0,48,48],"floor_room":[288,0,48,48],"wall_school":[336,0,48,48],"wall_room":[384,0,48,48],"door_school":[432,0,48,48],"gate":[480,0,48,96],"fence":[528,0,48,48],"tree":[576,0,48,96],"water":[624,0,48,48],"house_wall":[672,0,48,48],"house_door":[720,0,48,48],"sign":[0,96,48,48],"lamp":[48,96,48,96],"desk_student":[96,96,48,48],"desk_teacher":[144,96,96,48],"blackboard":[240,96,240,48],"noticeboard":[480,96,96,48],"locker":[576,96,48,96],"bookshelf":[624,96,48,48],"pc_public_off":[672,96,48,48],"pc_public_on":[720,96,48,48],"store_counter":[0,192,192,48],"tent_booth_a":[192,192,144,96],"tent_booth_b":[336,192,144,96],"bench":[480,192,96,48],"bed":[576,192,48,96],"desk_pc_off":[624,192,96,48],"desk_pc_on":[0,288,96,48],"bookcase_room":[96,288,48,48]} };
  function loadAtlas() {
    if (ATLAS.img !== null) return;
    ATLAS.img = false;
    var im = new Image();
    im.onload = function () { ATLAS.img = im; };
    im.src = SPRITE_DIR + 'tiles.png';
    if (window.fetch && location.protocol !== 'file:') {
      fetch(SPRITE_DIR + 'tiles.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j || !j.tiles) return;
        var t = {};
        Object.keys(j.tiles).forEach(function (k) { var v = j.tiles[k]; t[k] = [v.x, v.y, v.width, v.height]; });
        ATLAS.t = t; ATLAS.size = j.tileSize || ATLAS.size;
      }).catch(function () { /* 내장 좌표 사용 */ });
    }
  }
  // 바닥 타일 문자 → 아틀라스 이름
  var FLOOR = { c: 'floor_class', l: 'floor_library', h: 'floor_hall', g: 'floor_grass', p: 'floor_dirt', y: 'floor_sand', r: 'floor_room', w: 'water', H: 'house_wall', o: 'house_door', x: 'door_school', f: 'floor_grass', T: 'floor_grass' };
  // 사물 id → 아틀라스 이름(함수면 상황에 따라)
  var OBJ_ART = {
    board: 'blackboard', notice: 'noticeboard', tdesk: 'desk_teacher', locker: 'locker', store: 'store_counter',
    tent1: 'tent_booth_a', tent2: 'tent_booth_b', sign: 'sign', bench: 'bench', lamp: 'lamp', bed: 'bed', mybook: 'bookcase_room',
    pc1: 'pc_public_off', pc2: 'pc_public_off',
    pc3: function () { return trig && trig.target.obj === 'pc3' ? 'pc_public_on' : 'pc_public_off'; },
    mypc: function () { return trig && trig.target.obj === 'mypc' ? 'desk_pc_on' : 'desk_pc_off'; }
  };
  function artFor(ob) {
    if (ob.id.indexOf('desk') === 0 && ob.id !== 'desk') return 'desk_student';
    if (ob.id === 'shelf') return 'bookshelf';
    var a = OBJ_ART[ob.id];
    return typeof a === 'function' ? a() : a;
  }
  // 아틀라스 한 조각을 '왼쪽 아래 기준점 = 타일 (tx, tyBottom)의 아래 모서리'에 그린다
  function blit(name, tx, tyBottom, repeatW) {
    var r = ATLAS.t[name];
    if (!r || !ATLAS.img) return false;
    var z = T / ATLAS.size, w = r[2] * z, h = r[3] * z;
    var bx = Math.round(tx * T - cam.x), by = Math.round((tyBottom + 1) * T - cam.y);
    for (var i = 0; i < (repeatW || 1); i++) ctx.drawImage(ATLAS.img, r[0], r[1], r[2], r[3], bx + i * w, by - h, w, h);
    return true;
  }
  // 임시 도형의 머리 모양(색이 아니라 실루엣으로도 구분)
  var HAIR = { hayun: 'long', seoa: 'pony', dohyun: 'short', minjun: 'short', teacher: 'short', friend: 'short' };

  function $(id) { return document.getElementById(id); }

  /* ── 스프라이트(있으면) ─────────── */
  function loadSprite(key, file) {
    if (sprites[key] !== undefined) return;
    sprites[key] = null;
    var im = new Image();
    im.onload = function () {
      sprites[key] = im;
      // 시트 크기에서 원본 칸 크기를 알아낸다(가로 4프레임): 32×48이든 48×72든 그대로 맞춤
      if (key !== 'minjun_sleep' && im.naturalWidth % 4 === 0) {
        var w = im.naturalWidth / 4;
        if (w !== srcTile) { srcTile = w; resize(); }
      }
    };
    im.onerror = function () { sprites[key] = false; };
    im.src = SPRITE_DIR + file;
  }

  /* ── 대상 ─────────────────────── */
  function targetBox() {
    if (trig.target.npc) {
      var c = cast.filter(function (k) { return k.who === trig.target.npc; })[0];
      return { x: c.x, y: c.y, w: 1, h: 1, who: c.who, name: o.story.characters[c.who].name };
    }
    var ob = WD.object(trig.target.obj);
    return { x: ob.x, y: ob.y, w: ob.w, h: ob.h, obj: ob, name: ob.name };
  }
  function boxContains(b) { return function (x, y) { return x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h; }; }
  function routeToTarget() { return WD.findPath({ x: me.x, y: me.y }, WD.adjacentTo({ contains: boxContains(targetBox()) }), blocked); }

  /* ── 열기·닫기 ─────────────────── */
  function show(r) {
    run = r;
    targetId = r.mapTarget;
    trig = WD.triggers[targetId];
    cast = trig.cast.slice();
    blocked = {};
    cast.forEach(function (c) { blocked[c.x + ',' + c.y] = true; loadSprite(c.who, 'char_' + c.who + '.png'); });
    var look = o.playerLook();
    if (look !== lastLook) { delete sprites.me; lastLook = look; }
    loadSprite('me', 'char_player_' + look + '.png');
    loadSprite('minjun_sleep', 'minjun_sleep.png');
    loadAtlas();

    var pos = o.loadPos();
    var newDay = false;
    if (pos && pos.for === targetId) place(pos);
    else if (trig.spawn) { place(WD.SPAWNS[trig.spawn]); newDay = true; }
    else if (pos) place(pos);
    else place(WD.SPAWNS.classroom);
    nudgeFree();
    savePos();

    $('m-time').textContent = trig.time;
    $('m-mission').textContent = trig.mission;
    held = []; path = null; actOnArrive = false; busy = false; bubble = null;
    lastArea = '';
    updateArea();
    say('');
    active = true;
    resize();
    if (newDay) dayCard(trig.time);
    updateHint();
    lastT = performance.now();
    schedule();
  }
  function hide() { active = false; held = []; path = null; if (raf) cancelAnimationFrame(raf); clearTimeout(tmr); raf = null; }
  // 화면 갱신은 rAF, 탭이 가려지거나 rAF가 멈춘 환경에선 타이머가 대신 진행시킨다
  function schedule() {
    if (!active) return;
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(tmr);
    raf = requestAnimationFrame(loop);
    tmr = setTimeout(function () { loop(performance.now()); }, 50);
  }
  function place(p) { me.x = p.x; me.y = p.y; me.dir = p.dir || 'down'; me.fx = p.x; me.fy = p.y; me.moving = false; }
  function nudgeFree() {
    if (WD.walkable(me.x, me.y, blocked)) return;
    var p = WD.findPath({ x: me.x, y: me.y }, function (x, y) { return WD.walkable(x, y, blocked); }, {});
    if (!p) return;
    var cur = { x: me.x, y: me.y };
    p.forEach(function (d) { cur = WD.stepFrom(cur.x, cur.y, d, {}); });
    place({ x: cur.x, y: cur.y, dir: me.dir });
  }
  function savePos() { o.savePos({ x: me.x, y: me.y, dir: me.dir, for: targetId }); }

  function dayCard(text) {
    var c = $('m-daycard');
    c.textContent = text;
    c.hidden = false;
    setTimeout(function () { c.hidden = true; }, o.instant() ? 0 : 1400);
  }

  /* ── 이동 ─────────────────────── */
  function tryStep(dir) {
    me.dir = dir;
    var d = WD.DIRS[dir], nx = me.x + d[0], ny = me.y + d[1];
    if (!WD.walkable(nx, ny, blocked)) return false;
    me.moving = true; me.t = 0;
    me.from = { x: me.x, y: me.y }; me.to = { x: nx, y: ny };
    me.door = WD.DOORS[nx + ',' + ny] || null;
    return true;
  }
  function finishStep() {
    me.moving = false;
    me.x = me.to.x; me.y = me.to.y;
    if (me.door) { me.x = me.door.to[0]; me.y = me.door.to[1]; me.dir = me.door.dir; say(me.door.label === '집 안으로' ? '우리 집에 들어왔다.' : '밖으로 나왔다.'); }
    me.fx = me.x; me.fy = me.y;
    me.frame = (me.frame + 1) % 4;
    savePos();
    updateArea();
    updateHint();
    if (path && path.length) { tryStep(path.shift()) || (path = null); return; }
    if (path && !path.length) {
      path = null;
      if (actOnArrive) { actOnArrive = false; act(); }
      return;
    }
    if (held.length) tryStep(held[held.length - 1]);
  }
  function updateArea() {
    var a = WD.areaName(me.x, me.y);
    if (a !== lastArea) { lastArea = a; $('m-area').textContent = a ? '📍 ' + a : ''; }
  }

  /* ── 상호작용 ───────────────────── */
  function neighbors() {
    var list = [], order = [me.dir, 'up', 'down', 'left', 'right'];
    order.forEach(function (dir) {
      var d = WD.DIRS[dir], x = me.x + d[0], y = me.y + d[1];
      cast.forEach(function (c) { if (c.x === x && c.y === y) list.push({ type: 'npc', c: c, dir: dir }); });
      WD.OBJECTS.forEach(function (ob) {
        if (x >= ob.x && x < ob.x + ob.w && y >= ob.y && y < ob.y + ob.h) list.push({ type: 'obj', ob: ob, dir: dir });
      });
    });
    return list;
  }
  function isTarget(n) { return trig.target.npc ? n.type === 'npc' && n.c.who === trig.target.npc : n.type === 'obj' && n.ob.id === trig.target.obj; }
  function nearTarget() { return neighbors().some(isTarget); }

  function act() {
    if (busy || me.moving) return;
    var ns = neighbors();
    if (!ns.length) { say('가까이 가서 눌러 보세요. ❗가 다음 목적지예요.'); return; }
    var t = ns.filter(isTarget)[0];
    if (t) {
      me.dir = t.dir;
      busy = true;
      var line = trig.greet ? trig.greet : '';
      if (line) say(o.fill(line), t.type === 'npc' ? t.c : null);
      setTimeout(function () { busy = false; if (active) o.onEnter(); }, line && !o.instant() ? 900 : 0);
      return;
    }
    var n = ns[0];
    me.dir = n.dir;
    if (n.type === 'npc') {
      var lines = WD.idle[n.c.who] || [{ text: '…' }];
      var hit = lines.filter(function (l) { return o.evalCond(l.if); })[0];
      say(o.story.characters[n.c.who].name + ': ' + o.fill(hit.text), n.c);
    } else {
      say(n.ob.look || n.ob.name);
    }
  }
  function say(text, speaker) {
    bubble = text ? { text: text, who: speaker || null, until: performance.now() + 3200 } : null;
    $('m-say').textContent = text || '';
  }
  function updateHint() {
    var near = nearTarget();
    var btn = $('btn-map-act');
    btn.textContent = near ? '❗ ' + targetBox().name + (trig.target.npc ? '에게 말 걸기' : ' 조사하기') : '말 걸기 · 조사하기';
    btn.classList.toggle('primary', near);
  }

  function skipToTarget() {
    if (busy) return;
    var p = routeToTarget();
    if (!p) { say('지금은 그곳으로 갈 수 없어요.'); return; }
    var cur = { x: me.x, y: me.y };
    p.forEach(function (d) { var n = WD.stepFrom(cur.x, cur.y, d, blocked); cur = { x: n.x, y: n.y }; });
    path = null; held = [];
    place({ x: cur.x, y: cur.y, dir: me.dir });
    var b = targetBox();
    // 대상을 바라보게
    ['up', 'down', 'left', 'right'].forEach(function (dir) {
      var d = WD.DIRS[dir];
      if (boxContains(b)(me.x + d[0], me.y + d[1])) me.dir = dir;
    });
    savePos(); updateArea(); updateHint();
    say(b.name + ' 앞에 왔어요. 말 걸기를 눌러 보세요.');
    $('btn-map-act').focus();
  }

  /* ── 입력 ─────────────────────── */
  function overlayOpen() { return !$('menu').hidden || !$('confirm').hidden; }
  function onKeyDown(e) {
    if (!active || overlayOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (e.target && e.target.tagName) || '';
    var dir = KEY_DIR[e.key];
    if (dir) {
      e.preventDefault();
      path = null; actOnArrive = false;
      if (held.indexOf(dir) < 0) held.push(dir);
      if (!me.moving && !busy) tryStep(dir);
      return;
    }
    if ((e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON' && tag !== 'INPUT') { e.preventDefault(); act(); }
  }
  function onKeyUp(e) {
    var dir = KEY_DIR[e.key];
    if (dir) { var i = held.indexOf(dir); if (i >= 0) held.splice(i, 1); }
  }
  function onPointer(e) {
    if (!active || busy) return;
    var r = canvas.getBoundingClientRect();
    var tx = Math.floor((e.clientX - r.left + cam.x) / T), ty = Math.floor((e.clientY - r.top + cam.y) / T);
    var npc = cast.filter(function (c) { return c.x === tx && c.y === ty; })[0];
    var ob = WD.objectAt(tx, ty) || WD.OBJECTS.filter(function (b) { return tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h; })[0];
    var p;
    if (npc || ob) {
      var box = npc ? { x: npc.x, y: npc.y, w: 1, h: 1 } : ob;
      p = WD.findPath({ x: me.x, y: me.y }, WD.adjacentTo({ contains: boxContains(box) }), blocked);
      actOnArrive = true;
    } else {
      p = WD.findPath({ x: me.x, y: me.y }, function (x, y) { return x === tx && y === ty; }, blocked);
      actOnArrive = false;
    }
    if (!p) { actOnArrive = false; return; }
    held = [];
    if (!p.length) { if (actOnArrive) { actOnArrive = false; faceBox(npc ? { x: npc.x, y: npc.y, w: 1, h: 1 } : ob); act(); } return; }
    path = p;
    if (!me.moving) tryStep(path.shift());
  }
  function faceBox(b) {
    ['up', 'down', 'left', 'right'].forEach(function (dir) { var d = WD.DIRS[dir]; if (boxContains(b)(me.x + d[0], me.y + d[1])) me.dir = dir; });
  }

  /* ── 그리기 ─────────────────────── */
  function resize() {
    if (!active) return;
    var cssW = wrap.clientWidth;
    var cssH = Math.max(300, Math.min(Math.round(window.innerHeight * 0.56), 520));
    // 도트가 뭉개지지 않게 원본 칸 크기의 정수배(1배·2배…)로만 그린다. 가로 약 13칸이 보이도록 배율을 고름
    var k = Math.max(1, Math.round(cssW / (srcTile * 13)));
    T = srcTile * k;
    dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    viewW = cssW; viewH = cssH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  function loop(t) {
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(tmr);
    raf = null;
    if (!active) return;
    // 경과 시간을 걸음 단위로 소비(타이머가 느리게 와도 이동 속도는 일정)
    var dt = Math.max(0, Math.min(1000, t - lastT)); lastT = t;
    while (me.moving && dt > 0) {
      var need = (1 - me.t) * STEP_MS;
      if (dt >= need) { dt -= need; me.t = 1; finishStep(); }
      else { me.t += dt / STEP_MS; dt = 0; }
    }
    if (me.moving) { me.fx = me.from.x + (me.to.x - me.from.x) * me.t; me.fy = me.from.y + (me.to.y - me.from.y) * me.t; }
    draw(t);
    schedule();
  }
  function draw(t) {
    var mapW = WD.W * T, mapH = WD.H * T;
    cam.x = Math.max(0, Math.min(mapW - viewW, me.fx * T + T / 2 - viewW / 2));
    cam.y = Math.max(0, Math.min(mapH - viewH, me.fy * T + T / 2 - viewH / 2));
    if (mapW < viewW) cam.x = (mapW - viewW) / 2;
    ctx.fillStyle = '#5E8F55';
    ctx.fillRect(0, 0, viewW, viewH);
    var x0 = Math.max(0, Math.floor(cam.x / T)), y0 = Math.max(0, Math.floor(cam.y / T));
    var x1 = Math.min(WD.W - 1, Math.ceil((cam.x + viewW) / T)), y1 = Math.min(WD.H - 1, Math.ceil((cam.y + viewH) / T));
    var x, y, inside = WD.indoor(me.x, me.y);
    var art = !!ATLAS.img;
    var list = []; // 앞뒤 순서가 필요한 것들: { y: 아래쪽 행, fn }
    var tileAt = function (xx, yy) { return !inside && WD.indoor(xx, yy) ? 'T' : WD.grid[yy][xx]; };
    // 위로 키 큰 그림(나무 96px)이 화면 위쪽 밖에서 걸쳐 들어오도록 한 줄 더 본다
    for (y = y0; y <= Math.min(WD.H - 1, y1 + 1); y++) for (x = x0; x <= x1; x++) {
      var sx = x * T - cam.x, sy = y * T - cam.y;
      if (inside && !WD.indoor(x, y)) { ctx.fillStyle = '#1F2A29'; ctx.fillRect(sx, sy, T + 1, T + 1); continue; }
      var ch = tileAt(x, y);
      if (!art) { drawTile(ch, sx, sy); continue; }
      var base = ch === '#' ? (WD.indoor(x, y) ? 'wall_room' : 'wall_school') : ch === 'd' ? (x === 22 ? 'floor_dirt' : 'door_school') : FLOOR[ch];
      blit(base || 'floor_grass', x, y);
      if (ch === 'T') list.push({ y: y, fn: (function (xx, yy) { return function () { blit('tree', xx, yy); }; })(x, y) });
      if (ch === 'f') list.push({ y: y, fn: (function (xx, yy) { return function () { blit('fence', xx, yy); }; })(x, y) });
      if (ch === 'd' && x === 22 && y === 17) list.push({ y: y, fn: function () { blit('gate', 22, 17); } });
    }
    WD.OBJECTS.forEach(function (ob) {
      if (WD.indoor(ob.x, ob.y) !== inside) return;
      if (!(ob.x <= x1 + 1 && ob.x + ob.w >= x0 - 1 && ob.y <= y1 + 2 && ob.y + ob.h >= y0 - 1)) return;
      var name = art && artFor(ob);
      var bottom = ob.y + ob.h - 1;
      if (!name) { list.push({ y: ob.wall ? -1 : bottom, fn: function () { drawObject(ob); } }); return; }
      list.push({ y: ob.wall ? -1 : bottom, fn: function () {
        // 책장처럼 1칸짜리 그림을 여러 칸에 이어 붙이는 경우
        var r = ATLAS.t[name], cells = r ? Math.round(r[2] / ATLAS.size) : ob.w;
        blit(name, ob.x, bottom, Math.max(1, Math.round(ob.w / cells)));
        if (ob.id === 'pc1' || ob.id === 'pc2') pcLabel(ob);
      } });
    });
    cast.forEach(function (c) {
      list.push({ y: c.pose === 'sleep' ? c.y - 0.5 : c.y, fn: function () { drawPerson(c.who, o.story.characters[c.who].name, c.x, c.y, c.dir, 0, c.pose); } });
    });
    list.push({ y: me.fy + 0.01, fn: function () { drawPerson('me', o.playerName(), me.fx, me.fy, me.dir, me.moving ? Math.floor(me.t * 4) % 4 : 0); } });
    list.sort(function (a, b) { return a.y - b.y; });
    list.forEach(function (d) { d.fn(); });
    if (TINT[trig.tint] && !(WD.areaName(me.x, me.y) === '내 방' && trig.tint === 'day')) { ctx.fillStyle = TINT[trig.tint]; ctx.fillRect(0, 0, viewW, viewH); }
    drawMarker(t);
    drawBubble(t);
  }
  function drawTile(ch, sx, sy) {
    ctx.fillStyle = TILE_COLOR[ch] || '#A9D48C';
    ctx.fillRect(sx, sy, T + 1, T + 1);
    if (ch === '#' || ch === 'H') { ctx.fillStyle = ch === '#' ? '#7E898A' : '#A9714F'; ctx.fillRect(sx, sy, T + 1, Math.round(T * 0.3)); }
    else if (ch === 'T') { ctx.fillStyle = '#4C8F45'; ctx.beginPath(); ctx.arc(sx + T / 2, sy + T * 0.45, T * 0.42, 0, 7); ctx.fill(); ctx.fillStyle = '#7A5634'; ctx.fillRect(sx + T * 0.42, sy + T * 0.75, T * 0.16, T * 0.25); }
    else if (ch === 'f') { ctx.fillStyle = '#8C6A43'; ctx.fillRect(sx, sy + T * 0.35, T + 1, T * 0.12); ctx.fillRect(sx, sy + T * 0.65, T + 1, T * 0.12); ctx.fillRect(sx + T * 0.1, sy + T * 0.2, T * 0.12, T * 0.7); ctx.fillRect(sx + T * 0.7, sy + T * 0.2, T * 0.12, T * 0.7); }
    else if (ch === 'd' || ch === 'o' || ch === 'x') { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(sx + 2, sy + 2, T - 4, T - 4); }
    else if (ch === 'c' || ch === 'l' || ch === 'r' || ch === 'h') { ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.strokeRect(sx + 0.5, sy + 0.5, T, T); }
  }
  function pcLabel(ob) {
    var sx = ob.x * T - cam.x, sy = ob.y * T - cam.y;
    ctx.fillStyle = '#FFFFFF';
    roundRect(sx + T * 0.36, sy + T * 0.6, T * 0.28, T * 0.3, 3); ctx.fill();
    ctx.fillStyle = '#16201F'; ctx.font = 'bold ' + Math.round(T * 0.24) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ob.label || ob.name.replace(/\D/g, ''), sx + T / 2, sy + T * 0.76);
  }
  function drawObject(ob) {
    var sx = ob.x * T - cam.x, sy = ob.y * T - cam.y, w = ob.w * T, h = ob.h * T;
    var r = Math.round(T * 0.15);
    ctx.fillStyle = ob.wall ? '#3F5A4C' : (ob.id.indexOf('tent') === 0 ? '#F2F2EE' : '#B9895A');
    if (ob.id.indexOf('pc') === 0 || ob.id === 'mypc') ctx.fillStyle = '#C9CED1';
    if (ob.id === 'bed') ctx.fillStyle = '#9CC3E6';
    roundRect(sx + 3, sy + 3, w - 6, h - 6, r); ctx.fill();
    if (ob.id.indexOf('tent') === 0) { ctx.fillStyle = ob.id === 'tent1' ? '#0F766E' : '#C2410C'; for (var i = 0; i < ob.w * 2; i++) if (i % 2 === 0) ctx.fillRect(sx + 3 + i * (w - 6) / (ob.w * 2), sy + 3, (w - 6) / (ob.w * 2), h * 0.35); }
    ctx.font = Math.round(T * 0.5) + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#16201F';
    ctx.fillText(ob.icon || '', sx + w / 2, sy + h / 2 + 1);
    if (ob.label) { ctx.font = 'bold ' + Math.round(T * 0.3) + 'px sans-serif'; ctx.fillStyle = '#16201F'; ctx.fillText(ob.label, sx + w - T * 0.2, sy + T * 0.25); }
  }
  function drawPerson(who, name, fx, fy, dir, frame, pose) {
    var sx = fx * T - cam.x, sy = fy * T - cam.y;
    if (sx < -T * 2 || sy < -T * 2 || sx > viewW + T || sy > viewH + T) return;
    var sheet = pose === 'sleep' ? sprites.minjun_sleep : sprites[who];
    if (sheet) {
      // 칸 = 가로 1타일 × 세로 1.5타일, 발밑이 타일 아래쪽에 오도록
      var fw = sheet.naturalWidth / (pose === 'sleep' ? 1 : 4), fh = sheet.naturalHeight / (pose === 'sleep' ? 1 : 4);
      if (pose === 'sleep') ctx.drawImage(sheet, 0, 0, fw, fh, sx, sy - T * 1.5, T, T * 1.5); // 바로 위 책상 칸에 겹쳐 그림(납품 규칙: 책상 y - 0.5칸)
      else ctx.drawImage(sheet, frame * fw, ROW[dir] * fh, fw, fh, sx, sy + T - T * 1.5, T, T * 1.5);
    } else {
      var col = CHAR_COLOR[who] || '#777';
      var bob = frame % 2 ? -T * 0.04 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath(); ctx.ellipse(sx + T / 2, sy + T * 0.9, T * 0.3, T * 0.09, 0, 0, 7); ctx.fill();
      if (pose === 'sleep') {
        ctx.fillStyle = col; roundRect(sx + T * 0.15, sy - T * 0.15, T * 0.7, T * 0.5, T * 0.15); ctx.fill();
        ctx.fillStyle = '#F2D2B6'; ctx.beginPath(); ctx.arc(sx + T / 2, sy - T * 0.25, T * 0.22, 0, 7); ctx.fill();
        ctx.fillStyle = '#16201F'; ctx.font = Math.round(T * 0.32) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z', sx + T * 0.85, sy - T * 0.55);
      } else {
        ctx.fillStyle = col; roundRect(sx + T * 0.2, sy + T * 0.3 + bob, T * 0.6, T * 0.6, T * 0.18); ctx.fill();
        var hair = who === 'me' ? (o.playerLook() === 'f' ? 'pony' : 'short') : HAIR[who];
        var hx = sx + T / 2, hy = sy + T * 0.18 + bob, hr = T * 0.27;
        ctx.fillStyle = '#4A3426';
        if (hair === 'long') { roundRect(hx - hr * 1.05, hy - hr * 0.6, hr * 2.1, hr * 1.9, hr * 0.8); ctx.fill(); }
        if (hair === 'pony') { var px = dir === 'left' ? hr : dir === 'right' ? -hr : hr * 0.95; ctx.beginPath(); ctx.ellipse(hx + px, hy + hr * 0.15, hr * 0.35, hr * 0.66, 0, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#F2D2B6'; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7); ctx.fill();
        ctx.fillStyle = '#4A3426';
        ctx.beginPath(); ctx.arc(hx, hy, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.fill(); // 앞머리
        if (dir === 'up') { ctx.beginPath(); ctx.arc(hx, hy, hr, 0, 7); ctx.fill(); }
        // 바라보는 방향(눈)
        ctx.fillStyle = '#16201F';
        var ex = dir === 'left' ? -0.1 : dir === 'right' ? 0.1 : 0;
        if (dir !== 'up') { ctx.fillRect(sx + T * (0.4 + ex), sy + T * 0.16 + bob, T * 0.06, T * 0.08); ctx.fillRect(sx + T * (0.54 + ex), sy + T * 0.16 + bob, T * 0.06, T * 0.08); }
        ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold ' + Math.round(T * 0.3) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(who === 'me' ? '나' : (o.story.characters[who] || {}).initial || '?', sx + T / 2, sy + T * 0.62 + bob);
      }
    }
    // 이름표(색이 아니라 글자로 구분)
    var label = name.length > 8 ? name.slice(0, 8) + '…' : name;
    ctx.font = '600 ' + Math.max(11, Math.round(T * 0.26)) + 'px sans-serif';
    var tw = ctx.measureText(label).width + 8;
    ctx.fillStyle = who === 'me' ? 'rgba(15,118,110,0.92)' : 'rgba(22,32,31,0.72)';
    // 내 이름표는 머리 위, 다른 인물은 발밑 — 옆에 붙어 서도 겹치지 않게
    var ty = who === 'me' ? sy - T * 0.52 : sy + T * 0.98;
    roundRect(sx + T / 2 - tw / 2, ty, tw, T * 0.34, 4); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, sx + T / 2, ty + T * 0.17);
  }
  function drawMarker(t) {
    var b = targetBox();
    if (WD.indoor(b.x, b.y) && !WD.indoor(me.x, me.y)) b = { x: WD.INDOOR.entrance.x, y: WD.INDOOR.entrance.y, w: 1, h: 1 };
    var bob = o.reduceMotion() ? 0 : Math.sin(t / 220) * T * 0.08;
    var mx = (b.x + b.w / 2) * T - cam.x, my = b.y * T - cam.y - T * (b.who ? 0.55 : 0.2) + bob;
    var off = mx < 8 || mx > viewW - 8 || my < 8 || my > viewH - 8;
    if (off) { // 화면 밖이면 가장자리에 방향 표시
      mx = Math.max(22, Math.min(viewW - 22, mx));
      my = Math.max(22, Math.min(viewH - 22, my));
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(mx, my, T * 0.3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#B91C1C'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#B91C1C'; ctx.font = 'bold ' + Math.round(T * 0.4) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', mx, my + 1);
    if (off) {
      var ang = Math.atan2((b.y + b.h / 2) * T - cam.y - my, (b.x + b.w / 2) * T - cam.x - mx);
      ctx.save(); ctx.translate(mx + Math.cos(ang) * T * 0.45, my + Math.sin(ang) * T * 0.45); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  function drawBubble(t) {
    if (!bubble) return;
    if (t > bubble.until) { bubble = null; return; }
    var who = bubble.who;
    var cx = who ? who.x * T - cam.x + T / 2 : viewW / 2;
    var by = who ? who.y * T - cam.y - T * 0.3 : viewH - 16;
    var fs = Math.max(13, Math.round(T * 0.32));
    ctx.font = fs + 'px sans-serif';
    var lines = wrapText(bubble.text, Math.min(viewW - 40, T * 7));
    var w = Math.max.apply(null, lines.map(function (l) { return ctx.measureText(l).width; })) + 20;
    var h = lines.length * (fs + 4) + 14;
    var x = Math.max(8, Math.min(viewW - w - 8, cx - w / 2)), y = Math.max(8, by - h);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    roundRect(x, y, w, h, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(22,32,31,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#16201F'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lines.forEach(function (l, i) { ctx.fillText(l, x + 10, y + 7 + i * (fs + 4)); });
  }
  function wrapText(text, maxW) {
    var out = [], cur = '';
    Array.prototype.forEach.call(text, function (ch) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch; } else cur += ch;
    });
    if (cur) out.push(cur);
    return out.slice(0, 4);
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ── 초기화 ─────────────────────── */
  function init(options) {
    o = options;
    canvas = $('m-canvas'); wrap = $('m-wrap');
    ctx = canvas.getContext('2d');
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', function () { held = []; });
    canvas.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', resize);
    $('btn-map-act').addEventListener('click', act);
    $('btn-map-skip').addEventListener('click', skipToTarget);
  }

  window.PrivacyMap = {
    init: init, show: show, hide: hide,
    // 검증용(읽기 전용 + 경로 계산)
    debug: {
      me: function () { return { x: me.x, y: me.y, dir: me.dir, moving: me.moving, area: WD.areaName(me.x, me.y) }; },
      route: routeToTarget,
      nearTarget: nearTarget,
      tileToClient: function (tx, ty) { var r = canvas.getBoundingClientRect(); return { x: r.left + tx * T - cam.x + T / 2, y: r.top + ty * T - cam.y + T / 2 }; }
    }
  };
})();
