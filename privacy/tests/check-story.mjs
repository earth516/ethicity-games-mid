// 스토리 그래프 검증: node privacy/tests/check-story.mjs
// - 연결 무결성(없는 장면·인물·플래그), 막다른 장면
// - 어떤 길로도 9개 사건을 건너뛸 수 없는지(정적 그래프)
// - 서로 다른 완주 경로 수(정확한 계산)
// - 무작위 완주 표본: 모든 장면·선택지·조건부 대사·사건 결과 문장이 실제로 나타나는지
// - 엔딩별 대표 경로(routes.js)가 의도한 엔딩에 도착하는지
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const story = require('../js/story.js');
const E = require('../js/engine.js');
const WORLD = require('../js/world.js');
story.triggers = WORLD.triggers; // 앱과 같은 연결: 트리거가 있는 장면 앞에 맵 단계

const errors = [];
const warn = [];
const err = (m) => errors.push(m);

// ── 1. 정적 검사 ─────────────────────────
const sceneIds = Object.keys(story.scenes);
const setFlags = new Set();
const knownStats = new Set(E.STAT_KEYS);
for (const s of Object.values(story.scenes)) for (const c of s.choices || []) Object.keys(c.set || {}).forEach((k) => setFlags.add(k));

function checkTarget(t, where) {
  const list = Array.isArray(t) ? t.map((x) => x.to) : [t];
  for (const x of list) {
    if (x == null) { err(`${where}: next 없음`); continue; }
    if (x === '@ending') continue;
    if (x.startsWith('@chapter:')) { if (!story.chapters[x.split(':')[1]]) err(`${where}: 없는 장 ${x}`); continue; }
    if (!story.scenes[x]) err(`${where}: 없는 장면 ${x}`);
  }
}
function condKeys(cond) {
  if (cond == null) return [];
  if (Array.isArray(cond)) return cond.flatMap(condKeys);
  return cond.split(/\|\||&&/).map((c) => c.trim().replace(/^!/, '').split(/>=|<=|!=|=|>|</)[0].trim())
    .flatMap((k) => k.split('+').map((x) => x.trim()));
}
function checkCond(cond, where) {
  for (const k of condKeys(cond)) {
    if (knownStats.has(k)) continue;
    if (k.startsWith('trust.')) { if (!story.trustable.includes(k.slice(6))) err(`${where}: 없는 신뢰 대상 ${k}`); continue; }
    if (!setFlags.has(k)) err(`${where}: 어디서도 설정하지 않는 플래그 '${k}'`);
  }
}
function checkLines(lines, where) {
  (lines || []).forEach((l, i) => {
    const n = E.normLine(l, story);
    if (typeof l === 'string' && n.who === 'narr' && !l.startsWith('narr: ')) err(`${where} 대사${i}: 인물 id 인식 실패 "${l.slice(0, 20)}"`);
    if (n.who && n.who !== 'narr' && n.who !== 'sys' && !story.characters[n.who]) err(`${where} 대사${i}: 없는 인물 ${n.who}`);
    checkCond(n.if, `${where} 대사${i}`);
  });
}
for (const [id, s] of Object.entries(story.scenes)) {
  if (s.event && !story.events[s.event]) err(`${id}: 없는 사건 ${s.event}`);
  if (!s.label) err(`${id}: label 없음`);
  checkLines(s.lines, id);
  const ids = new Set();
  for (const c of s.choices || []) {
    if (!c.id) err(`${id}: 선택지 id 없음`);
    if (ids.has(c.id)) err(`${id}: 선택지 id 중복 ${c.id}`);
    ids.add(c.id);
    checkTarget(c.next, `${id}#${c.id}`);
    checkCond(c.if, `${id}#${c.id}`);
    checkLines(c.react, `${id}#${c.id} react`);
  }
  if (!(s.choices || []).length) checkTarget(s.next, id);
  if (s.next) checkTarget(s.next, id);
}
for (const [eid, ev] of Object.entries(story.events)) ev.outcomes.forEach((o, i) => checkCond(o.if, `사건 ${eid} 결과${i}`));
story.endings.forEach((e) => checkCond(e.if, `엔딩 ${e.code}`));
if (story.endings[story.endings.length - 1].if != null) err('마지막 엔딩은 조건 없는 기본값이어야 함');

// ── 2. 정적 도달 그래프 ─────────────────
function targetsOf(t) {
  return (Array.isArray(t) ? t.map((x) => x.to) : [t])
    .map((x) => (x && x.startsWith('@chapter:') ? story.chapters[x.split(':')[1]].start : x))
    .filter((x) => x && x !== '@ending');
}
const succ = {};
for (const [id, sc] of Object.entries(story.scenes)) succ[id] = new Set([...(sc.choices || []).flatMap((c) => targetsOf(c.next)), ...targetsOf(sc.next)]);
const eventIds = Object.keys(story.events);
const endScenes = sceneIds.filter((id) => {
  const sc = story.scenes[id];
  return [...(sc.choices || []).map((c) => c.next), sc.next].flat().some((t) => t === '@ending' || (t && t.to === '@ending'));
});
// 어떤 사건의 장면을 모두 빼도 엔딩에 닿으면, 그 사건을 건너뛰는 길이 있다는 뜻
for (const e of eventIds) {
  const banned = new Set(sceneIds.filter((id) => story.scenes[id].event === e));
  const seen = new Set([story.start]), stack = [story.start];
  while (stack.length) { const x = stack.pop(); for (const y of succ[x]) if (!banned.has(y) && !seen.has(y)) { seen.add(y); stack.push(y); } }
  if (endScenes.some((x) => seen.has(x))) err(`사건 ${e}을 건너뛰고 엔딩에 닿는 길이 있음`);
}

// ── 3. 서로 다른 완주 경로 수(정확) ──────────
// 선택지 표시·분기에 쓰이는 조건의 참/거짓만 키로 삼으면, 같은 키에서 이어지는 경로 수는 같다.
function routingConds(sc) {
  const out = [];
  for (const c of sc.choices || []) { out.push(c.if); if (Array.isArray(c.next)) c.next.forEach((n) => out.push(n.if)); }
  if (Array.isArray(sc.next)) sc.next.forEach((n) => out.push(n.if));
  return out.filter((c) => c != null);
}
const routeAtoms = [...new Set(sceneIds.flatMap((id) => routingConds(story.scenes[id]))
  .flatMap((c) => [].concat(c).flatMap((x) => x.split(/\|\||&&/))).map((a) => a.trim()))];
const countMemo = new Map();
function countPaths(s, depth) {
  if (depth > 400) { err('무한 루프 의심: ' + s.scene); return 0; }
  if (s.screen === 'ending') return 1;
  // 신뢰값은 이후 증감이 문턱 판정에 영향을 주므로 원값 그대로 포함
  const k = JSON.stringify([s.screen, s.scene, s.reaction, s.nextChapter, routeAtoms.map((a) => (E.evalCond(a, s) ? 1 : 0)).join(''), s.trust]);
  if (countMemo.has(k)) return countMemo.get(k);
  let n = 0;
  if (s.screen === 'scene' && E.needsChoice(story, s)) {
    for (const c of E.visibleChoices(story, story.scenes[s.scene], s)) {
      const a = E.choose(story, s, c.id); a.history = [];
      n += countPaths(E.advance(story, a), depth + 1);
    }
  } else if (s.screen === 'scene' && E.pendingNext(story, s) == null) err('막다른 장면: ' + s.scene);
  else n = countPaths(E.advance(story, s), depth + 1);
  countMemo.set(k, n);
  return n;
}
const totalPaths = countPaths(E.createState(story), 0);
// 무대·맵 개편은 이야기 분기를 바꾸지 않는다
if (totalPaths !== 294840000) err('완주 경로 수가 바뀜: ' + totalPaths);

// ── 4. 무작위 완주 표본(실제 상태 그대로) ──────
const seenScene = new Set(), seenChoice = new Set(), seenLine = new Set(), seenOutcome = new Set();
const endingCount = {};
function markLines(s) {
  const scene = story.scenes[s.scene];
  (scene.lines || []).forEach((l, i) => { if (E.evalCond(E.normLine(l, story).if, s)) seenLine.add(`${s.scene}|${i}`); });
  if (s.reaction) {
    const c = scene.choices.find((c) => c.id === s.reaction);
    (c.react || []).forEach((l, i) => { if (E.evalCond(E.normLine(l, story).if, s)) seenLine.add(`${s.scene}#${c.id}|r${i}`); });
  }
}
let seed = 20261017;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const SAMPLES = Number(process.env.SAMPLES || 100000);
function play(pick) {
  let s = E.createState(story);
  const path = [];
  for (let step = 0; s.screen !== 'ending'; step++) {
    if (step > 400) { err('무한 루프 의심'); break; }
    if (s.screen === 'scene') {
      seenScene.add(s.scene); markLines(s);
      if (E.needsChoice(story, s)) {
        const cs = E.visibleChoices(story, story.scenes[s.scene], s);
        const c = pick(s, cs);
        if (!c) return { s, path, fail: s.scene };
        seenChoice.add(`${s.scene}#${c.id}`); path.push(`${s.scene}#${c.id}`);
        s = E.choose(story, s, c.id); s.history = []; markLines(s);
      }
    }
    s = E.advance(story, s);
  }
  return { s, path };
}
for (let i = 0; i < SAMPLES; i++) {
  const { s, path } = play((st, cs) => cs[Math.floor(rnd() * cs.length)]);
  endingCount[s.ending] = (endingCount[s.ending] || 0) + 1;
  for (const e of eventIds) {
    const outs = E.eventOutcomes(story, e, s);
    outs.forEach((t) => seenOutcome.add(e + '|' + t));
    if (!outs.length) err(`사건 ${e} 결과 문장이 없는 경로: ${path.join(' > ')}`);
  }
}

// ── 5. 엔딩별 대표 경로(결정적) ─────────────
const ROUTES = require('./routes.js');
const routeResult = {};
for (const [code, route] of Object.entries(ROUTES)) {
  let i = 0;
  const r = play((st, cs) => {
    const [sc, id] = (route[i] || '').split('#');
    if (sc !== st.scene) return null;
    i++;
    return cs.find((c) => c.id === id);
  });
  if (r.fail) err(`대표 경로 ${code}: ${r.fail}에서 예정된 선택(${route[i] || '없음'})을 고를 수 없음`);
  else if (i !== route.length) err(`대표 경로 ${code}: 선택 ${route.length - i}개가 남은 채 끝남`);
  else if (r.s.ending !== code) err(`대표 경로 ${code}가 엔딩 ${r.s.ending}에 도착함`);
  routeResult[code] = r;
}

// ── 6. 커버리지 ──────────────────────────
for (const id of sceneIds) if (!seenScene.has(id)) err('도달하지 않은 장면: ' + id);
for (const [id, sc] of Object.entries(story.scenes)) {
  for (const c of sc.choices || []) if (!seenChoice.has(`${id}#${c.id}`)) err(`한 번도 나타나지 않은 선택지: ${id}#${c.id}`);
  (sc.lines || []).forEach((l, i) => { if (!seenLine.has(`${id}|${i}`)) err(`한 번도 표시되지 않은 대사: ${id} 대사${i}`); });
  for (const c of sc.choices || []) (c.react || []).forEach((l, i) => { if (!seenLine.has(`${id}#${c.id}|r${i}`)) err(`한 번도 표시되지 않은 반응: ${id}#${c.id} 반응${i}`); });
}
for (const [eid, ev] of Object.entries(story.events)) ev.outcomes.forEach((o) => { if (!seenOutcome.has(eid + '|' + o.text)) err(`한 번도 나오지 않은 사건 결과: ${eid} "${o.text}"`); });
for (const e of story.endings) if (!endingCount[e.code] && routeResult[e.code]?.s.ending !== e.code) err('도달 불가 엔딩: ' + e.code);

// ── 6b. 맵 검사 ──────────────────────────
const TRIGGER_ORDER = ['pro_1', 'c1_e1_a', 'c1_e2_a', 'c1_e3_a', 'c2_e4_a', 'c2_e5_a', 'c2_e6_a', 'c3_e7_a', 'c3_e8_a', 'c3_e9_a', 'ep_1'];
for (const id of Object.keys(WORLD.triggers)) if (!story.scenes[id]) err('맵 트리거가 없는 장면을 가리킴: ' + id);
for (const id of TRIGGER_ORDER) if (!WORLD.triggers[id]) err('맵 트리거 누락: ' + id);
// 다른 사건(또는 장 시작)에서 넘어오는 장면 = 사건 입구 → 반드시 트리거가 있어야 걸어서 들어간다
for (const [id, sc] of Object.entries(story.scenes)) {
  for (const t of succ[id]) { const to = story.scenes[t]; if (to.event !== sc.event && to.event && !WORLD.triggers[t]) err('사건 입구인데 맵 트리거 없음: ' + t); }
}
for (const n of Object.values(story.chapters)) if (!WORLD.triggers[n.start]) err('장 시작 장면에 맵 트리거 없음: ' + n.start);
// 등교 오프닝: 시작 장면도 걸어서 들어간다
if (!WORLD.triggers[story.start]) err('시작 장면에 트리거 없음(등교 오프닝): ' + story.start);
{ const s0 = E.createState(story); if (s0.screen !== 'map' || s0.mapTarget !== story.start) err('createState가 오프닝 맵으로 시작하지 않음'); }
// 장면 무대가 플레이어를 옮기므로 모든 걷기 구간은 시작 위치를 명시한다
for (const [id, t] of Object.entries(WORLD.triggers)) if (!t.spawn || !WORLD.SPAWNS[t.spawn]) err('트리거 spawn 없음/잘못됨: ' + id);
for (const [id, t] of Object.entries(WORLD.triggers)) {
  if (Array.isArray(t.greet)) t.greet.forEach((g, i) => { if (!g.text || (g.who && !story.characters[g.who])) err(id + ': greet ' + i + ' 형식 오류'); });
  for (const w of Object.keys(t.castLines || {})) if (!t.cast.some((c) => c.who === w)) err(id + ': castLines 인물이 cast에 없음 ' + w);
}
let prevEnd = null;
const walkLengths = [];
for (const id of TRIGGER_ORDER) {
  const tr = WORLD.triggers[id];
  if (!tr) continue;
  const blocked = {};
  const seenAt = {};
  for (const c of tr.cast) {
    if (!story.characters[c.who]) err(id + ': 없는 인물 ' + c.who);
    if (!WORLD.walkable(c.x, c.y)) err(id + ': ' + c.who + '이 막힌 칸(' + c.x + ',' + c.y + ')에 서 있음');
    if (seenAt[c.x + ',' + c.y]) err(id + ': 두 인물이 같은 칸 ' + c.x + ',' + c.y);
    seenAt[c.x + ',' + c.y] = true; blocked[c.x + ',' + c.y] = true;
  }
  let contains;
  if (tr.target.npc) {
    const c = tr.cast.find((c) => c.who === tr.target.npc);
    if (!c) { err(id + ': 대상 인물 ' + tr.target.npc + '이 배치되지 않음'); continue; }
    contains = (x, y) => x === c.x && y === c.y;
  } else {
    const o = WORLD.object(tr.target.obj);
    if (!o) { err(id + ': 없는 사물 ' + tr.target.obj); continue; }
    contains = (x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h;
  }
  let start = tr.spawn ? WORLD.SPAWNS[tr.spawn] : prevEnd;
  if (!start) { err(id + ': 시작 위치를 알 수 없음(첫 트리거엔 spawn 필요)'); continue; }
  if (!WORLD.walkable(start.x, start.y, blocked)) { // 앱과 같은 규칙: 인물과 겹치면 가장 가까운 빈칸으로
    const p = WORLD.findPath({ x: start.x, y: start.y }, (x, y) => WORLD.walkable(x, y, blocked), {});
    if (!p) { err(id + ': 시작 위치 근처에 빈칸 없음'); continue; }
    let cur = { x: start.x, y: start.y }; for (const d of p) cur = WORLD.stepFrom(cur.x, cur.y, d, {});
    start = cur;
  }
  const path = WORLD.findPath({ x: start.x, y: start.y }, WORLD.adjacentTo({ contains }), blocked);
  if (!path) { err(id + ': 시작 위치에서 대상까지 걸어갈 수 없음'); continue; }
  walkLengths.push(id + ' ' + path.length + '칸');
  let cur = { x: start.x, y: start.y }; for (const d of path) cur = WORLD.stepFrom(cur.x, cur.y, d, blocked);
  prevEnd = cur;
}
{
  // 집 사건은 교문을 지나 걸어야만 닿는지: 교문 칸을 막으면 길이 없어야 함
  const gateBlocked = { '22,16': true, '22,17': true };
  const bed = WORLD.object('bed');
  const p = WORLD.findPath({ x: 8, y: 6 }, WORLD.adjacentTo({ contains: (x, y) => x === bed.x && y >= bed.y && y < bed.y + bed.h }), gateBlocked);
  if (p) err('교문을 지나지 않고 집에 갈 수 있는 길이 있음');
}

// ── 6d. 주택가·담장 검사 ─────────────────
{
  if (WORLD.W < 60 || WORLD.H < 30) err('마을이 확장되지 않음: ' + WORLD.W + '×' + WORLD.H);
  const NB = WORLD.NEIGHBORS || [];
  if (NB.length !== 3) err('이웃집 3채가 아님: ' + NB.length);
  if (new Set(NB.map((n) => n.art)).size !== NB.length) err('같은 집 그림을 복사해 씀');
  const road = WORLD.SPAWNS.road;
  const blockedAll = {};
  for (const n of NB) {
    const ob = WORLD.object(n.id);
    if (!ob) { err('이웃집 사물 없음: ' + n.id); continue; }
    for (let yy = ob.y; yy < ob.y + ob.h; yy++) for (let xx = ob.x; xx < ob.x + ob.w; xx++) if (WORLD.walkable(xx, yy)) err('이웃집을 뚫고 걸을 수 있음: ' + n.id + ' ' + xx + ',' + yy);
    const ap = n.approach;
    if (!WORLD.walkable(ap.x, ap.y)) err('이웃집 현관 앞이 막힘: ' + n.id);
    if (!(ap.y === ob.y + ob.h && ap.x >= ob.x && ap.x < ob.x + ob.w)) err('현관 앞 칸이 집 바로 아래가 아님: ' + n.id);
    if (!WORLD.findPath({ x: road.x, y: road.y }, (x, y) => x === ap.x && y === ap.y, {})) err('마을 길에서 이웃집 현관 앞까지 길이 없음: ' + n.id);
    if (WORLD.DOORS[ap.x + ',' + ap.y] || WORLD.DOORS[ap.x + ',' + (ap.y - 1)]) err('이웃집에 들어가는 문이 생김: ' + n.id);
    if (!ob.look) err('이웃집 조사 문구 없음: ' + n.id);
  }
  for (const t of Object.values(WORLD.triggers)) if (t.target.obj && NB.some((n) => n.id === t.target.obj)) err('이웃집이 사건 목적지가 됨');
  // 우리 집: 우편함은 현관 옆이되 현관과 그 주변 칸을 막지 않는다
  const mb = WORLD.object('mailbox');
  if (!mb) err('노란 우편함 없음');
  else {
    if (Math.abs(mb.x - 42) > 3 || Math.abs(mb.y - 18) > 2) err('우편함이 우리 집 현관 근처가 아님');
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]]) if (!WORLD.walkable(42 + dx, 18 + dy)) err('우리 집 현관 옆 칸이 막힘: ' + (42 + dx) + ',' + (18 + dy));
  }
  // 교문: 통로 2칸은 열리고 위·아래 기둥 칸은 막힘
  if (!WORLD.walkable(22, 16) || !WORLD.walkable(22, 17)) err('교문 통로가 막힘');
  if (WORLD.walkable(22, 15) || WORLD.walkable(22, 18)) err('교문 기둥 칸을 걸을 수 있음');
  // 맵 가장자리는 모두 막혀 있다(생울타리·나무·담장)
  for (let x = 0; x < WORLD.W; x++) for (const y of [0, WORLD.H - 1]) if (WORLD.walkable(x, y)) err('맵 가장자리가 열림: ' + x + ',' + y);
  for (let y = 0; y < WORLD.H; y++) for (const x of [0, WORLD.W - 1]) if (WORLD.walkable(x, y)) err('맵 가장자리가 열림: ' + x + ',' + y);
  // 생울타리 칸이 실제로 있다
  if (!WORLD.grid.some((row) => row.indexOf('e') >= 0)) err('생울타리(e) 칸 없음');
  // 내 방 가구에 닿을 수 있다(침대·컴퓨터·팬더)
  for (const id of ['bed', 'mypc', 'plush']) {
    const o = WORLD.object(id);
    if (!WORLD.findPath({ x: 34, y: 7 }, WORLD.adjacentTo({ contains: (x, y) => x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h }), {})) err('내 방 ' + id + '에 닿을 수 없음');
  }
}

// ── 6c. 장면 무대 검사 ─────────────────────
// 모든 장면은 맵 위 한 장소에서 벌어진다: 장소·인물 위치·말풍선 기준 줄이 실제로 맞는지
function sceneTexts(id) {
  const sc = story.scenes[id], out = [];
  const add = (l) => { const n = E.normLine(l, story); if (n && n.text) out.push(n.text); };
  (sc.lines || []).forEach(add);
  for (const c of sc.choices || []) { if (c.say) out.push(c.say); (c.react || []).forEach(add); }
  return out;
}
const STAGES = WORLD.STAGES || {}, PLACES = WORLD.PLACES || {};
for (const id of sceneIds) {
  const st = STAGES[id];
  if (!st) { err('무대 없음: ' + id); continue; }
  const pl = PLACES[st.place];
  if (!pl) { err('무대 장소 잘못됨: ' + id + ' ' + st.place); continue; }
  const me = st.me || pl.me;
  if (!WORLD.walkable(me.x, me.y)) err('무대에서 내가 막힌 칸: ' + id);
  if (['day', 'evening', 'night'].indexOf(st.tint) < 0) err('무대 시간대 잘못됨: ' + id);
  if (st.device && ['phone', 'monitor', 'none'].indexOf(st.device) < 0) err('무대 기기 잘못됨: ' + id);
  const dev = st.device || { group: 'phone', dm: 'phone', sns: 'phone', ai: 'monitor', pc: 'monitor', place: 'none' }[(story.scenes[id].view || {}).type];
  if (st.pcOn && dev !== 'monitor') err('컴퓨터가 켜진 무대인데 모니터가 아님: ' + id);
  const at = { [me.x + ',' + me.y]: 'me' };
  for (const c of st.cast) {
    if (!story.characters[c.who]) err('무대 인물 없음: ' + id + '/' + c.who);
    if (!WORLD.walkable(c.x, c.y)) err('무대 인물이 벽·가구 위: ' + id + '/' + c.who + ' ' + c.x + ',' + c.y);
    if (at[c.x + ',' + c.y]) err('무대에서 같은 칸에 둘: ' + id + ' ' + c.x + ',' + c.y);
    at[c.x + ',' + c.y] = c.who;
  }
  const texts = sceneTexts(id);
  for (const b of st.bubbles || []) {
    if (!texts.some((t) => t.indexOf(b.on) >= 0)) err('말풍선 기준 줄 없음: ' + id + ' "' + b.on + '"');
    if (b.who !== 'me' && !st.cast.some((c) => c.who === b.who)) err('말풍선 인물이 무대에 없음: ' + id + '/' + b.who);
  }
}

// ── 7. 보고 ──────────────────────────────
const decisionScenes = sceneIds.filter((id) => (story.scenes[id].choices || []).length);
const choiceTotal = sceneIds.reduce((n, id) => n + (story.scenes[id].choices || []).length, 0);
const lineTotal = sceneIds.reduce((n, id) => n + (story.scenes[id].lines || []).length
  + (story.scenes[id].choices || []).reduce((m, c) => m + (c.react || []).length, 0), 0);
console.log(`장면 ${sceneIds.length}개 · 선택 지점 ${decisionScenes.length}곳 · 선택지 ${choiceTotal}개 · 대사 ${lineTotal}줄 · 사건 ${eventIds.length}개 · 엔딩 ${story.endings.length}종`);
console.log(`서로 다른 완주 경로: ${totalPaths.toLocaleString()}가지`);
console.log('맵 이동 거리(최단): ' + walkLengths.join(' · '));
console.log(`무작위 완주 ${SAMPLES.toLocaleString()}회 엔딩 분포: ` + story.endings.map((e) => `${e.code} ${((endingCount[e.code] || 0) / SAMPLES * 100).toFixed(1)}%`).join(' · '));
for (const e of story.endings) {
  const r = routeResult[e.code];
  console.log(`\n[엔딩 ${e.code}] ${e.title}` + (r && !r.fail ? ` — 대표 경로(선택 ${r.path.length}번, 도착 ${r.s.ending})` : ''));
  if (r && !r.fail) console.log('  ' + r.path.join(' > '));
}
if (errors.length) {
  console.log(`\n✗ 오류 ${errors.length}건:\n- ` + [...new Set(errors)].slice(0, 60).join('\n- '));
  process.exit(1);
}
console.log('\n✓ 검증 통과: 끊긴 연결·막다른 장면 없음 / 사건을 건너뛰는 길 없음 / 모든 장면·선택지·조건부 대사·사건 결과 등장 / 엔딩 A~D 대표 경로 도착');

