/*
 * 「공유한 순간」 맵 데이터 + 길찾기(순수 로직, 브라우저·Node 겸용)
 * ------------------------------------------------------------
 * 맵: 솔빛학교(교실·도서관·복도·매점 앞·운동장 부스) → 교문 → 마을 길 → 우리 집(내 방)
 * 좌표는 타일 단위(x: 왼→오, y: 위→아래). 그림은 app/map.js가 그린다.
 *
 * ▸ 사건 트리거(triggers): 사건의 첫 장면 id → 맵에서 그 장면을 여는 조건
 *   { time, mission, target:{ npc:'hayun' } 또는 { obj:'bed' }, spawn?:'gate'|'classroom', tint?, cast:[{who,x,y,dir,pose?}] }
 *   - spawn이 있으면 그 위치에서 시작(다음 날 등교 등). 없으면 직전 위치에서 이어 걷는다.
 *   - 대상(❗)에게 말을 걸거나 조사하면 해당 장면이 열린다.
 * ▸ idle: ❗가 아닌 인물에게 말 걸 때 한 줄(조건은 story.js와 같은 문법, 위에서부터 첫 일치)
 * ▸ objects[].look: 조사 문구
 */
(function (root) {
  'use strict';

  var W = 48, H = 23;
  var grid = [];
  var y, x;
  for (y = 0; y < H; y++) { grid.push([]); for (x = 0; x < W; x++) grid[y].push('g'); }
  function rect(x0, y0, w, h, ch) {
    for (var yy = y0; yy < y0 + h; yy++) for (var xx = x0; xx < x0 + w; xx++) grid[yy][xx] = ch;
  }
  function at(xx, yy, ch) { grid[yy][xx] = ch; }

  /* 타일 종류: 통행 가능 여부와 임시 색(스프라이트가 없을 때) */
  var TILES = {
    '#': { walk: false, name: '벽' },
    'c': { walk: true, name: '교실 바닥' },
    'l': { walk: true, name: '도서관 바닥' },
    'h': { walk: true, name: '복도' },
    'd': { walk: true, name: '문' },
    'g': { walk: true, name: '풀밭' },
    'p': { walk: true, name: '흙길' },
    'y': { walk: true, name: '운동장' },
    'f': { walk: false, name: '울타리' },
    'T': { walk: false, name: '나무' },
    'w': { walk: false, name: '연못' },
    'H': { walk: false, name: '집 벽' },
    'o': { walk: true, name: '우리 집 문' },
    'r': { walk: true, name: '방 바닥' },
    'x': { walk: true, name: '방문' }
  };

  /* ── 지형 ───────────────────────── */
  rect(22, 0, 26, 11, 'T');                 // 학교 오른쪽 위 숲(방은 이 안에 따로 있음)
  // 학교 건물
  rect(0, 0, 22, 11, '#');
  rect(1, 1, 10, 6, 'c');                   // 2학년 3반 교실
  rect(12, 1, 9, 6, 'l');                   // 도서관
  rect(1, 8, 20, 2, 'h');                   // 복도
  at(8, 7, 'd'); at(15, 7, 'd');            // 교실·도서관 문
  at(10, 10, 'd'); at(11, 10, 'd');         // 건물 현관
  // 운동장(울타리 안)
  rect(0, 11, 1, 12, 'f'); rect(0, 22, 23, 1, 'f'); rect(22, 0, 1, 23, 'f');
  rect(10, 11, 2, 6, 'p'); rect(10, 16, 13, 2, 'p');  // 현관 → 교문 길
  rect(1, 12, 7, 3, 'p');                   // 매점 앞
  rect(12, 18, 9, 3, 'y');                  // 축제 부스 운동장
  at(22, 16, 'd'); at(22, 17, 'd');         // 교문
  // 마을
  rect(23, 11, 25, 1, 'T'); rect(23, 22, 25, 1, 'T'); rect(47, 11, 1, 12, 'T');
  rect(23, 16, 18, 2, 'p');                 // 마을 길
  rect(27, 19, 4, 2, 'w');                  // 연못
  [[25, 13], [29, 12], [33, 13], [36, 20], [38, 12], [24, 20], [44, 20], [45, 12]].forEach(function (p) { at(p[0], p[1], 'T'); });
  // 우리 집(바깥)
  rect(41, 13, 5, 5, 'H');
  at(41, 16, 'o');
  // 내 방(숲 속 따로 떨어진 실내 — 문으로만 오간다)
  rect(30, 2, 10, 7, '#');
  rect(31, 3, 8, 5, 'r');
  at(34, 8, 'x');

  /* 문 이동: 이 칸에 들어서면 다른 칸으로 옮겨진다 */
  var DOORS = {
    '41,16': { to: [34, 7], dir: 'up', label: '집 안으로' },
    '34,8': { to: [40, 16], dir: 'left', label: '밖으로' }
  };

  /* 구역 이름(화면 위 표시용) */
  var AREAS = [
    { name: '2학년 3반 교실', x: 1, y: 1, w: 10, h: 6 },
    { name: '도서관', x: 12, y: 1, w: 9, h: 6 },
    { name: '복도', x: 1, y: 7, w: 20, h: 4 },
    { name: '매점 앞', x: 1, y: 11, w: 8, h: 4 },
    { name: '운동장 축제 부스', x: 11, y: 18, w: 11, h: 4 },
    { name: '교문', x: 19, y: 15, w: 4, h: 4 },
    { name: '마을 길', x: 23, y: 12, w: 16, h: 10 },
    { name: '우리 집 앞', x: 39, y: 12, w: 8, h: 10 },
    { name: '내 방', x: 31, y: 3, w: 8, h: 5 },
    { name: '운동장', x: 1, y: 11, w: 21, h: 11 }
  ];

  /* ── 가구·사물 (w×h = 바닥을 차지하는 칸, 0이면 벽에 걸림) ── */
  var OBJECTS = [
    { id: 'board', name: '칠판', x: 3, y: 0, w: 5, h: 1, icon: '📋', wall: true, look: '칠판: “축제 D-day · 2학년 3반 레트로 사진관 📸”' },
    { id: 'notice', name: '게시판', x: 1, y: 0, w: 2, h: 1, icon: '📌', wall: true, look: '게시판: 축제 부스 배치도. 우리 반은 운동장 왼쪽 천막이다.' },
    { id: 'tdesk', name: '교탁', x: 5, y: 2, w: 2, h: 1, icon: '🗂', look: '교탁 위에 출석부와 분필이 놓여 있다.' },
    { id: 'desk1', name: '책상', x: 2, y: 3, w: 1, h: 1, icon: '▭' }, { id: 'desk2', name: '책상', x: 4, y: 3, w: 1, h: 1, icon: '▭' },
    { id: 'desk3', name: '책상', x: 7, y: 3, w: 1, h: 1, icon: '▭' }, { id: 'desk4', name: '책상', x: 9, y: 3, w: 1, h: 1, icon: '▭' },
    { id: 'desk5', name: '책상', x: 2, y: 5, w: 1, h: 1, icon: '▭' }, { id: 'desk6', name: '책상', x: 4, y: 5, w: 1, h: 1, icon: '▭' },
    { id: 'desk7', name: '민준이 책상', x: 7, y: 5, w: 1, h: 1, icon: '▭' }, { id: 'desk8', name: '내 책상', x: 9, y: 5, w: 1, h: 1, icon: '▭', look: '내 책상. 축제 소품 상자가 올려져 있다.' },
    { id: 'locker', name: '사물함', x: 10, y: 1, w: 1, h: 2, icon: '🗄', look: '내 사물함. 축제 소품이 들어 있다.' },
    { id: 'shelf', name: '책장', x: 12, y: 1, w: 9, h: 1, icon: '📚', look: '도서관 책장. ‘개인정보, 어디까지 괜찮을까?’라는 책이 눈에 띈다.' },
    { id: 'pc1', name: '공용 PC 1번', x: 13, y: 4, w: 1, h: 1, icon: '🖥', look: '공용 PC 1번. 꺼져 있다.' },
    { id: 'pc2', name: '공용 PC 2번', x: 15, y: 4, w: 1, h: 1, icon: '🖥', look: '공용 PC 2번. 검색 전용이라고 붙어 있다.' },
    { id: 'pc3', name: '공용 PC 3번', x: 17, y: 4, w: 1, h: 1, icon: '🖥', label: '3', look: '공용 PC 3번.' },
    { id: 'store', name: '매점 진열대', x: 2, y: 12, w: 4, h: 1, icon: '🧃', look: '매점. 오늘은 컵떡볶이가 제일 잘 팔린다.' },
    { id: 'tent1', name: '레트로 사진관 천막', x: 13, y: 18, w: 3, h: 1, icon: '⛺', look: '우리 반 부스 ‘레트로 사진관’. 1컷 500원.' },
    { id: 'tent2', name: '옆 반 천막', x: 17, y: 18, w: 3, h: 1, icon: '⛺', look: '옆 반 부스. 솜사탕 냄새가 난다.' },
    { id: 'sign', name: '안내 표지판', x: 24, y: 15, w: 1, h: 1, icon: '🪧', look: '← 솔빛학교 · 우리 집 →' },
    { id: 'bench', name: '벤치', x: 32, y: 14, w: 2, h: 1, icon: '🪑', look: '마을 벤치. 집까지 조금만 더 가면 된다.' },
    { id: 'lamp', name: '가로등', x: 37, y: 15, w: 1, h: 1, icon: '💡', look: '가로등이 막 켜졌다.' },
    { id: 'bed', name: '침대', x: 31, y: 3, w: 1, h: 2, icon: '🛏', look: '내 침대. 아직 잘 시간은 아니다.' },
    { id: 'mypc', name: '내 책상 컴퓨터', x: 36, y: 3, w: 2, h: 1, icon: '💻', look: '내 책상과 컴퓨터.' },
    { id: 'mybook', name: '책꽂이', x: 38, y: 5, w: 1, h: 1, icon: '📚', look: '교과서와 만화책이 섞여 꽂혀 있다.' }
  ];

  /* 실내(내 방): 밖에 있을 땐 숲으로 가려 그리고, ❗는 집 문에 띄운다 */
  var INDOOR = { x: 30, y: 2, w: 10, h: 7, entrance: { x: 41, y: 16 } };

  var SPAWNS = {
    classroom: { x: 8, y: 6, dir: 'up' },
    gate: { x: 21, y: 16, dir: 'left' }
  };

  /* ── 사건 트리거 ─────────────────── */
  var schoolDay = function (extra) {
    return [
      { who: 'hayun', x: 5, y: 4, dir: 'down' }, { who: 'dohyun', x: 8, y: 2, dir: 'left' },
      { who: 'seoa', x: 3, y: 1, dir: 'down' }, { who: 'minjun', x: 9, y: 6, dir: 'up' }
    ].filter(function (c) { return !extra || extra.indexOf(c.who) < 0; });
  };
  var TRIGGERS = {
    c1_e1_a: { time: 'D-4 · 방과 후', mission: '교실에서 하윤이에게 말 걸기', target: { npc: 'hayun' }, spawn: 'classroom', tint: 'day',
      cast: schoolDay(), greet: '하윤: 정산은 이따 저녁에 단톡방에 올릴게! 확인해 줘~' },
    c1_e2_a: { time: 'D-3 · 방과 후', mission: '교실에서 엎드려 자는 민준이 살펴보기', target: { npc: 'minjun' }, spawn: 'gate', tint: 'day',
      cast: [{ who: 'minjun', x: 7, y: 6, dir: 'up', pose: 'sleep' }, { who: 'dohyun', x: 6, y: 6, dir: 'right' },
        { who: 'hayun', x: 6, y: 1, dir: 'down' }, { who: 'seoa', x: 2, y: 1, dir: 'down' }] },
    c1_e3_a: { time: 'D-2 · 하교 시간', mission: '집에 가서 쉬기 — 교문을 지나 마을 길 끝 우리 집으로', target: { obj: 'bed' }, tint: 'evening',
      cast: [{ who: 'hayun', x: 15, y: 8, dir: 'down' }, { who: 'dohyun', x: 4, y: 13, dir: 'down' }, { who: 'minjun', x: 14, y: 19, dir: 'down' }],
      enterLine: '하루 종일 부스를 꾸몄더니 피곤하다. 침대에 눕자 휴대폰이 울렸다.' },
    c2_e4_a: { time: 'D-1 · 오후', mission: '매점 앞에서 손짓하는 도현이에게 가기', target: { npc: 'dohyun' }, spawn: 'gate', tint: 'day',
      cast: [{ who: 'dohyun', x: 4, y: 13, dir: 'right' }, { who: 'seoa', x: 14, y: 19, dir: 'up' },
        { who: 'minjun', x: 16, y: 19, dir: 'up' }, { who: 'hayun', x: 6, y: 9, dir: 'down' }] },
    c2_e5_a: { time: 'D-1 · 저녁', mission: '집에 가서 부스 안내문 쓰기 — 내 방 컴퓨터', target: { obj: 'mypc' }, tint: 'night',
      cast: [{ who: 'seoa', x: 14, y: 19, dir: 'up' }, { who: 'minjun', x: 16, y: 19, dir: 'up' }] },
    c2_e6_a: { time: '축제 당일 · 아침', mission: '도서관 공용 PC 3번에서 안내문 출력하기', target: { obj: 'pc3' }, spawn: 'gate', tint: 'day',
      cast: [{ who: 'friend', x: 18, y: 5, dir: 'left' }, { who: 'hayun', x: 13, y: 19, dir: 'up' }, { who: 'seoa', x: 15, y: 19, dir: 'up' }] },
    c3_e7_a: { time: '축제 당일 · 오후', mission: '운동장 부스 뒤 도현이네에게 가기', target: { npc: 'dohyun' }, tint: 'day',
      cast: [{ who: 'dohyun', x: 17, y: 20, dir: 'left' }, { who: 'friend', x: 18, y: 20, dir: 'left' },
        { who: 'minjun', x: 13, y: 19, dir: 'down' }, { who: 'hayun', x: 15, y: 19, dir: 'down' }, { who: 'seoa', x: 20, y: 19, dir: 'left' }] },
    c3_e8_a: { time: '축제 당일 · 저녁', mission: '집에 가서 쉬기 — 내 방 컴퓨터', target: { obj: 'mypc' }, tint: 'evening',
      cast: [{ who: 'dohyun', x: 18, y: 19, dir: 'down' }, { who: 'teacher', x: 11, y: 12, dir: 'down' }] },
    c3_e9_a: { time: '축제 다음 날 · 오전', mission: '교실에서 하윤이에게 말 걸기', target: { npc: 'hayun' }, spawn: 'gate', tint: 'day',
      cast: schoolDay() },
    ep_1: { time: '다음 주 월요일', mission: '교실에서 담임 선생님께 가기', target: { npc: 'teacher' }, spawn: 'gate', tint: 'day',
      cast: [{ who: 'teacher', x: 6, y: 1, dir: 'down' }].concat(schoolDay()) }
  };

  /* ── ❗가 아닌 인물에게 말 걸 때 ─────── */
  var IDLE = {
    hayun: [
      { if: 'e9b=calm|del', text: '그때 말려 줘서… 고마워.' },
      { if: 'e4b=blame', text: '…괜찮아. 신경 쓰지 마.' },
      { if: 'trust.hayun>=1', text: '요즘 네 덕분에 든든해.' },
      { if: 'e4', text: '합성 사진… 아직도 돌고 있는 것 같아.' },
      { text: '역할표 아직 정리 중이야!' }
    ],
    dohyun: [
      { if: 'e6=logout', text: '그때 로그아웃해 준 거 진짜 고마웠다.' },
      { if: 'e6=post|leave', text: '내 계정에 이상한 거 올린 사람 아직도 못 찾았어 ㅡㅡ' },
      { if: 'trust.dohyun<0', text: '…뭐.' },
      { text: '축제 때 사진 많이 찍자 ㅋㅋ' }
    ],
    seoa: [
      { if: 'trust.seoa<0', text: '(서아는 대답 없이 고개를 돌렸다.)' },
      { if: 'trust.seoa>=1', text: '꾸미기 재료 같이 고를래?' },
      { text: '반짝이 스티커 더 사야 해.' }
    ],
    minjun: [
      { if: 'trust.minjun<0', text: '(민준이는 눈을 피했다.)' },
      { if: 'trust.minjun>=1', text: '…고마웠어. 그때.' },
      { text: '…소품 거의 다 됐어.' }
    ],
    teacher: [{ text: '준비 잘 되어 가니? 무슨 일 있으면 언제든 말해.' }],
    friend: [{ text: '너 몇 반이야? 우리 반 부스도 놀러 와~' }]
  };

  /* ── 길찾기 ─────────────────────── */
  function tile(xx, yy) { return xx < 0 || yy < 0 || xx >= W || yy >= H ? '#' : grid[yy][xx]; }
  function objectAt(xx, yy) {
    for (var i = 0; i < OBJECTS.length; i++) {
      var o = OBJECTS[i];
      if (!o.wall && xx >= o.x && xx < o.x + o.w && yy >= o.y && yy < o.y + o.h) return o;
    }
    return null;
  }
  // blocked: 'x,y' → true (인물 등 추가로 막힌 칸)
  function walkable(xx, yy, blocked) {
    var t = TILES[tile(xx, yy)];
    if (!t || !t.walk) return false;
    if (objectAt(xx, yy)) return false;
    return !(blocked && blocked[xx + ',' + yy]);
  }
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  function stepFrom(xx, yy, dir, blocked) {
    var d = DIRS[dir], nx = xx + d[0], ny = yy + d[1];
    if (!walkable(nx, ny, blocked)) return null;
    var door = DOORS[nx + ',' + ny];
    return door ? { x: door.to[0], y: door.to[1], door: true, dir: door.dir } : { x: nx, y: ny };
  }
  // from에서 goal(x,y)→true 인 칸까지 방향 목록(문 이동 포함). 못 가면 null
  function findPath(from, goal, blocked) {
    var key = function (p) { return p.x + ',' + p.y; };
    var prev = {}, q = [from], seen = {};
    seen[key(from)] = true;
    while (q.length) {
      var cur = q.shift();
      if (goal(cur.x, cur.y)) {
        var dirs = [], k = key(cur);
        while (prev[k]) { dirs.unshift(prev[k].dir); k = prev[k].from; }
        return dirs;
      }
      for (var d in DIRS) {
        var n = stepFrom(cur.x, cur.y, d, blocked);
        if (!n || seen[key(n)]) continue;
        seen[key(n)] = true;
        prev[key(n)] = { from: key(cur), dir: d };
        q.push({ x: n.x, y: n.y });
      }
    }
    return null;
  }
  // 대상(인물 칸 또는 사물 footprint)에 붙어 설 수 있는 칸인가
  function adjacentTo(target) {
    return function (xx, yy) {
      for (var d in DIRS) {
        var nx = xx + DIRS[d][0], ny = yy + DIRS[d][1];
        if (target.contains(nx, ny)) return true;
      }
      return false;
    };
  }
  function areaName(xx, yy) {
    for (var i = 0; i < AREAS.length; i++) {
      var a = AREAS[i];
      if (xx >= a.x && xx < a.x + a.w && yy >= a.y && yy < a.y + a.h) return a.name;
    }
    return '';
  }

  var WORLD = {
    W: W, H: H, grid: grid, TILES: TILES, DOORS: DOORS, OBJECTS: OBJECTS, SPAWNS: SPAWNS, INDOOR: INDOOR,
    indoor: function (xx, yy) { return xx >= INDOOR.x && xx < INDOOR.x + INDOOR.w && yy >= INDOOR.y && yy < INDOOR.y + INDOOR.h; },
    triggers: TRIGGERS, idle: IDLE, DIRS: DIRS,
    tile: tile, objectAt: objectAt, walkable: walkable, stepFrom: stepFrom,
    findPath: findPath, adjacentTo: adjacentTo, areaName: areaName,
    object: function (id) { return OBJECTS.filter(function (o) { return o.id === id; })[0]; }
  };
  root.PRIVACY_WORLD = WORLD;
  if (typeof module !== 'undefined' && module.exports) module.exports = WORLD;
})(typeof window !== 'undefined' ? window : globalThis);
