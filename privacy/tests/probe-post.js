// 프로브(앱 뒤에 실행): 실제 화면 버튼을 눌러 플레이하고 결과를 <pre id="probe-out">에 남긴다.
(function () {
  var P = window.__probe;
  var carried = JSON.parse(sessionStorage.getItem('probe-carry') || '{"pass":[],"fail":[]}');
  var pass = carried.pass, fail = carried.fail;
  function carry() { sessionStorage.setItem('probe-carry', JSON.stringify({ pass: pass, fail: fail })); }
  function ok(cond, msg) { (cond ? pass : fail).push(msg); }
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms || 0); }); }
  function view() { return document.body.getAttribute('data-view'); }
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return '(blocked)'; } }
  function out() {
    var pre = document.createElement('pre');
    pre.id = 'probe-out';
    pre.textContent = JSON.stringify({ scenario: P.scenario, pass: pass, fail: fail, errors: P.errors });
    document.body.appendChild(pre);
  }
  function loadRoutes() {
    return new Promise(function (r) { var s = document.createElement('script'); s.src = 'tests/routes.js'; s.onload = r; document.head.appendChild(s); });
  }
  function confirmYes() { $('#confirm-yes').click(); }

  // route를 화면 조작으로 진행. upto: 이 개수만큼 선택하고 멈춤. keyboard: 숫자 키로 선택
  async function play(route, opts) {
    opts = opts || {};
    var i = opts.from || 0, guard = 0, badWords = 0;
    while (guard++ < 400) {
      await wait(opts.delay || 0);
      var v = view();
      if (v === 'v-ending') break;
      if (v === 'v-chapter') { $('#btn-chapter-go').click(); continue; }
      if (v === 'v-map') {
        if (opts.upto != null && opts.stopAtMap && i >= opts.upto) return i;
        if (opts.walk) await walkToTarget(opts);
        else { $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); }
        await wait(opts.delay || 0);
        continue;
      }
      if (v !== 'v-game') { fail.push('예상 밖 화면: ' + v); break; }
      var skip = $('.skip-btn');
      if (skip) { skip.click(); continue; }
      var choices = $$('#g-dock .choice');
      if (choices.length) {
        if (opts.upto != null && i >= opts.upto) return i;
        var want = route[i], sc = want.split('#')[0], id = want.split('#')[1];
        var st = PrivacyApp.state();
        if (st.scene !== sc) { fail.push('경로 어긋남: 현재 ' + st.scene + ', 예정 ' + want); break; }
        choices.forEach(function (b) { if (/정답|오답/.test(b.textContent)) badWords++; });
        var idx = choices.findIndex(function (b) { return b.getAttribute('data-choice') === id; });
        if (idx < 0) { fail.push('선택지 없음: ' + want); break; }
        if (opts.keyboard) document.dispatchEvent(new KeyboardEvent('keydown', { key: String(idx + 1), bubbles: true }));
        else choices[idx].click();
        i++;
        continue;
      }
      var next = $('#btn-next');
      if (next) { next.click(); continue; }
      fail.push('진행 버튼이 없음 @' + PrivacyApp.state().scene); break;
    }
    ok(badWords === 0, '선택지에 정답/오답 표시 없음');
    return i;
  }

  // 대화창이 열려 있으면 ▼를 눌러 끝까지 넘긴다
  async function passTalk(o) { var g = 0; while ($('#talk') && !$('#talk').hidden && g++ < 60) { if (o) o.talkLines = (o.talkLines || 0) + $$('#talk .talk-text p').length; $('#btn-talk-next').click(); await wait(20); } }
  function key(k, type) { document.dispatchEvent(new KeyboardEvent(type || 'keydown', { key: k, bubbles: true })); }
  var ARROW = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  async function walkToTarget(opts) {
    var M = PrivacyMap.debug, route = M.route();
    if (!route) { fail.push('맵: 대상까지 길 없음'); return; }
    opts.walked = (opts.walked || 0) + route.length;
    for (var k = 0; k < route.length; k++) {
      key(ARROW[route[k]]); key(ARROW[route[k]], 'keyup');
      var g = 0; await wait(16);
      while (M.me().moving && g++ < 100) await wait(16);
      var area = M.me().area;
      if (opts.areas && opts.areas[opts.areas.length - 1] !== area) opts.areas.push(area);
    }
    if (!M.nearTarget()) fail.push('맵: 걸어서 대상 옆에 도착하지 못함 ' + JSON.stringify(M.me()));
    key(' ');
    var g2 = 0; while (view() === 'v-map' && g2++ < 200) { await passTalk(opts); await wait(20); }
  }
  function checkOthersKept() {
    var same = Object.keys(P.OTHER).every(function (k) { return ls(k) === P.OTHER[k]; });
    ok(same, '다른 게임 저장 데이터 보존');
  }
  function checkResult(code) {
    var raw = ls('ethicity.result.privacy'), r = null;
    try { r = JSON.parse(raw); } catch (e) { /* */ }
    ok(!!r && r.game === 'privacy' && r.completed === true && r.ending === code && typeof r.card === 'string' && r.card.length > 0,
      '공통 결과 저장 ' + code + ' ' + raw);
    ok(!!r && Object.keys(r).sort().join(',') === 'card,completed,ending,game', '결과에 내부 상태를 추가하지 않음');
  }
  async function finishChecks(code, routeLen) {
    ok(view() === 'v-ending', '엔딩 화면 도착');
    ok($('#e-eyebrow').textContent === '엔딩 ' + code, '엔딩 코드 표시 ' + $('#e-eyebrow').textContent);
    ok($$('#e-events .event-card').length === 9, '사건별 결과 9개 표시');
    ok($$('#e-events .event-card li').length >= 9, '사건 결과 문장 존재');
    checkResult(code);
    ok(ls('ethicity.player') === P.PLAYER || P.scenario === 'no-player' || P.scenario === 'blocked', '공통 플레이어 정보를 덮어쓰지 않음');
    checkOthersKept();
    $('#btn-end-path').click(); await wait();
    ok(view() === 'v-path', '선택 경로 화면');
    ok($$('.path-opts li.mine').length === routeLen, '경로의 내 선택 수 = ' + routeLen + ' (표시 ' + $$('.path-opts li.mine').length + ')');
    ok($$('.path-opts li.other').length > 0, '고르지 않은 선택지도 표시');
    ok($$('.ending-chips li').length === 4, '엔딩 목록 4종');
    $('#btn-path-reflect').click(); await wait();
    ok(view() === 'v-reflect' && $$('#r-basic li').length === 5 && $$('#r-deep li').length === 5, '성찰 질문 5+5');
    $('#btn-reflect-back').click(); await wait();
    ok(view() === 'v-path', '성찰 → 경로로 돌아가기');
    $('#btn-path-back').click(); await wait();
    ok(view() === 'v-ending', '경로 → 엔딩으로 돌아가기');
  }

  async function run() {
    await loadRoutes();
    var R = window.PRIVACY_ROUTES;
    await wait(10);
    var s = P.scenario;

    if (/^route-[ABCD]$/.test(s) || s === 'route-B-key') {
      var code = s.charAt(6);
      ok(view() === 'v-start', '시작 화면');
      ok($('#player-name').textContent === '반짝이는 고래', '별명 표시');
      $('#btn-new').click();
      await play(R[code], { keyboard: s === 'route-B-key' });
      await finishChecks(code, R[code].length);
    }

    else if (s === 'walk-A') {
      $('#btn-new').click();
      var o = { walk: true, areas: [] };
      await play(R.A, o);
      ok(o.walked > 200, '방향키로 실제 걸은 칸 수 ' + o.walked);
      var seq = o.areas.join('>');
      ok(/교문>마을 길>우리 집 앞>내 방/.test(seq), '교문 → 마을 길 → 우리 집 → 내 방 순서로 이동');
      ok((seq.match(/내 방/g) || []).length >= 3, '집 사건 3번 모두 걸어서 귀가 (' + (seq.match(/내 방/g) || []).length + '회)');
      await finishChecks('A', R.A.length);
    }

    else if (s === 'tap') {
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      ok(view() === 'v-map', '첫 사건 전에 맵 화면');
      ok(/집/.test($('#m-mission').textContent), '지금 할 일 표시(하교): ' + $('#m-mission').textContent);
      var pt = PrivacyMap.debug.tileToClient(5, 4); // 하윤 자리
      $('#m-canvas').dispatchEvent(new PointerEvent('pointerdown', { clientX: pt.x, clientY: pt.y, bubbles: true }));
      var g = 0; while ($('#talk').hidden && g++ < 300) await wait(20);
      ok(!$('#talk').hidden && /하윤/.test($('#talk .talk-name').textContent), '하윤을 누르면 걸어가서 말 걸기 ' + JSON.stringify([pt, PrivacyMap.debug.me()]));
      await passTalk();
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait();
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_a', '침대에 가면 정산 장면 시작');
      // 맵에서 되돌리기: 다음 맵으로 간 뒤 되돌리면 이전 장면 선택 전으로
      await play(R.A, { from: 1, upto: 3, stopAtMap: true });
      ok(view() === 'v-map' && PrivacyApp.state().screen === 'map', '두 번째 사건 전 맵');
      $('#btn-undo').click(); await wait(); confirmYes(); await wait();
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_b' && !PrivacyApp.state().reaction, '맵에서 되돌리기 → 직전 선택 전으로');
      $('#btn-map-act');
      // 사물 조사·다른 인물 대사
      await play(R.A, { from: 2, upto: 3, stopAtMap: true });
      $('#btn-map-act').click(); await wait();
      ok(view() === 'v-map' && $('#m-say').textContent.length > 0, '대상이 아닌 곳에서 누르면 안내 문구');
    }

    else if (s === 'frame') {
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      ok(!!$('#stage') && $('#stage').contains($('#m-canvas')), '캔버스가 #stage 안에 있음');
      ok(view() === 'v-map' && !$('#stage').hidden && getComputedStyle($('#stage')).display !== 'none', '맵 화면에서 무대 보임');
      var cr = $('#m-canvas').getBoundingClientRect(), sr = { width: $('#stage').clientWidth, height: $('#stage').clientHeight };
      ok(Math.abs(cr.width - sr.width) < 2 && Math.abs(cr.height - sr.height) < 2, '캔버스가 무대를 채움 ' + [cr.width, cr.height, sr.width, sr.height].map(Math.round));
      // 하윤이 아닌 도현(8,2)을 누르면 걸어가서 말을 건다 → 대화창
      var pd = PrivacyMap.debug.tileToClient(8, 2);
      $('#m-canvas').dispatchEvent(new PointerEvent('pointerdown', { clientX: pd.x, clientY: pd.y, bubbles: true }));
      var gt = 0; while ((!$('#talk') || $('#talk').hidden) && gt++ < 300) await wait(20);
      ok(!!$('#talk') && !$('#talk').hidden && /\S/.test($('#talk .talk-text').textContent), '말 걸기 결과가 대화창에 나옴');
      ok(!!$('#talk .talk-name') && /도현/.test($('#talk .talk-name').textContent), '대화창 이름 탭');
      key(' '); await wait(30);
      ok($('#talk').hidden && view() === 'v-map', 'Space로 대화창 닫힘, 맵 그대로');
    }

    else if (s === 'opening') {
      $('#btn-new').click(); await wait(30);
      var st0 = PrivacyApp.state();
      ok(view() === 'v-map' && st0.screen === 'map' && st0.mapTarget === 'pro_1', '시작하면 바로 맵(등교)');
      ok(/내 방/.test($('#m-area').textContent), '내 방에서 시작: ' + $('#m-area').textContent);
      ok(/방향키/.test($('#m-say').textContent), '첫 걸음 안내: ' + $('#m-say').textContent);
      ok(/교실/.test($('#m-mission').textContent), '지금 할 일: ' + $('#m-mission').textContent);
      var ow = { walk: true, areas: [] };
      await walkToTarget(ow);
      var oseq = ow.areas.join('>');
      ok(/우리 집 앞.*마을 길.*교문.*복도.*2학년 3반 교실/.test(oseq), '집→마을 길→교문→복도→교실: ' + oseq);
      ok($('#m-say').textContent.indexOf('방향키') < 0, '걷기 시작하면 첫 안내가 사라짐');
      ok(ow.talkLines >= 4, '하윤의 친구 소개 ' + ow.talkLines + '줄');
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'pro_1', '소개 뒤 pro_1 장면');
    }

    else if (s === 'resume-old') {
      var E2 = window.PrivacyEngine, ST = window.PRIVACY_STORY, PK = 'ethicity.privacy.progress.v1';
      if (P.phase === 0) { // 개편 전 저장 1: 프롤로그 장면에서 바로 시작하던 형태
        var old = E2.createState(ST); old.screen = 'scene'; old.mapTarget = null; old.visited = ['pro_1'];
        localStorage.setItem(PK, JSON.stringify({ v: 1, run: old, explored: {}, endingsSeen: [] }));
        sessionStorage.setItem('probe-phase', '1'); carry(); location.reload(); return;
      }
      if (P.phase === 1) {
        ok(!$('#btn-continue').hidden, '개편 전 저장(프롤로그 장면) → 이어 하기');
        $('#btn-continue').click(); await wait();
        ok(view() === 'v-game' && PrivacyApp.state().scene === 'pro_1' && $$('#g-dock .choice').length > 0, 'pro_1 장면에서 그대로 이어짐');
        // 개편 전 저장 2: 1장 첫 맵, 교실 안 위치(6,4)
        var m = E2.createState(ST), gg = 0;
        while (!(m.screen === 'map' && m.mapTarget === 'c1_e1_a') && gg++ < 8) m = m.screen === 'scene' && E2.needsChoice(ST, m) ? E2.choose(ST, m, 'photo') : E2.advance(ST, m);
        m.history = [];
        localStorage.setItem(PK, JSON.stringify({ v: 1, run: m, explored: {}, endingsSeen: [], pos: { x: 6, y: 4, dir: 'left', for: 'c1_e1_a' } }));
        sessionStorage.setItem('probe-phase', '2'); carry(); location.reload(); return;
      }
      $('#btn-continue').click(); await wait();
      var mm = PrivacyMap.debug.me();
      ok(view() === 'v-map' && PrivacyApp.state().mapTarget === 'c1_e1_a' && mm.x === 6 && mm.y === 4, '개편 전 맵 저장 위치에서 이어짐 ' + JSON.stringify(mm));
      sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
    }

    else if (s === 'stage-mode') {
      $('#btn-new').click(); await wait(30);
      var SG = window.PRIVACY_WORLD.STAGES;
      var before = PrivacyMap.debug.me();
      await PrivacyMap.stage(SG.c1_e2_b, { card: '그날 밤 · 내 방' });
      var d = PrivacyMap.debug.stage();
      ok(d.mode === 'stage' && d.place === 'room' && d.tint === 'night', '무대 모드: 내 방·밤 ' + JSON.stringify(d));
      ok($('#cut').hidden, '컷 카드는 끝나면 사라짐');
      var m1 = PrivacyMap.debug.me();
      key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(300);
      var m2 = PrivacyMap.debug.me();
      ok(m1.x === m2.x && m1.y === m2.y, '무대 모드에선 방향키로 걷지 않음');
      await PrivacyMap.stage(SG.pro_1);
      ok(PrivacyMap.bubble('dohyun', '📱…') && PrivacyMap.bubble('seoa', '…'), '무대 인물 말풍선');
      ok(!PrivacyMap.bubble('teacher', 'x'), '무대에 없는 인물은 말풍선 없음');
      var b = PrivacyMap.debug.stage().bubbles;
      ok(b.indexOf('dohyun') >= 0 && b.indexOf('seoa') >= 0, '두 명 말풍선 동시: ' + b);
      PrivacyMap.clearBubbles();
      ok(PrivacyMap.debug.stage().bubbles.length === 0, '말풍선 지우기');
    }

    else if (s === 'map-resume') {
      if (P.phase === 0) {
        $('#btn-new').click();
        await play(R.A, { upto: 1, stopAtMap: true });
        key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(400);
        key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(400);
        var m0 = PrivacyMap.debug.me();
        sessionStorage.setItem('probe-saved', JSON.stringify(m0));
        await wait(600);
        sessionStorage.setItem('probe-phase', '1'); carry();
        location.reload();
        return;
      }
      var m0b = JSON.parse(sessionStorage.getItem('probe-saved'));
      ok(!$('#btn-continue').hidden, '맵에서 새로고침 → 이어 하기');
      $('#btn-continue').click(); await wait();
      var m1 = PrivacyMap.debug.me();
      ok(view() === 'v-map' && m1.x === m0b.x && m1.y === m0b.y && m0b.x === 6, '같은 위치에서 재개 (' + m1.x + ',' + m1.y + ')');
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait();
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_a', '재개 후 사건 시작');
      sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
    }

    else if (s === 'no-player' || s === 'damaged-player' || s === 'wrong-player') {
      ok($('#player-name').textContent === '플레이어', '기본 별명 ‘플레이어’');
      ok($('#player-avatar').getAttribute('src') === 'assets/avatar-default.svg', '기본 아바타');
      ok(!$('#player-note').hidden, '안내 문구 표시: ' + $('#player-note').textContent);
      ok(s === 'no-player' ? ls('ethicity.player') === null : ls('ethicity.player') !== null, '공통 플레이어 키를 만들거나 고치지 않음');
      $('#btn-new').click();
      await play(R.C);
      await finishChecks('C', R.C.length);
    }

    else if (s === 'xss') {
      var name = JSON.parse(P.PLAYER).nickname;
      ok($('#player-name').textContent === name, '별명이 글자 그대로 표시');
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      ok($('#g-log').textContent.indexOf(name) >= 0, '대사 속 {name} 치환은 텍스트로');
      $('#g-dock .choice').click(); await wait();
      var body = document.body;
      ok(!window.__xss, '별명 속 스크립트 실행 안 됨');
      ok($$('#v-game img, #v-start .player-chip img').length === 1, '별명이 이미지 태그로 해석되지 않음');
      ok(!$('#v-game b'), '별명이 굵게 태그로 해석되지 않음');
      var who = $$('.who').filter(function (w) { return w.textContent.indexOf('<img') === 0; })[0];
      ok(!!who && who.scrollWidth >= who.clientWidth, '긴 별명 줄임 처리 요소 존재');
      ok(document.documentElement.scrollWidth <= window.innerWidth + 1, '긴 별명으로 가로 넘침 없음');
      await play(R.A, { from: 1 });
      ok(!window.__xss, '완주 후에도 스크립트 실행 없음');
      await finishChecks('A', R.A.length);
    }

    else if (s === 'resume') {
      if (P.phase === 0) {
        $('#btn-new').click();
        var n = await play(R.D, { upto: 7 });
        var st = PrivacyApp.state();
        sessionStorage.setItem('probe-saved', JSON.stringify({ scene: st.scene, hist: st.history.length, flags: st.flags, stats: st.stats, n: n }));
        sessionStorage.setItem('probe-phase', '1'); carry();
        location.reload();
        return; // 새 페이지에서 계속
      }
      if (P.phase === 1) {
        var saved = JSON.parse(sessionStorage.getItem('probe-saved'));
        ok(view() === 'v-start' && !$('#btn-continue').hidden, '새로고침 뒤 시작 화면에 이어 하기');
        $('#btn-continue').click(); await wait();
        var st1 = PrivacyApp.state();
        ok(st1.scene === saved.scene && st1.history.length === saved.hist && JSON.stringify(st1.flags) === JSON.stringify(saved.flags), '같은 장면·기록으로 재개 ' + st1.scene);
        ok($$('#g-log li').length > 0 && $$('#g-dock .choice').length > 0, '재개 장면의 대사·선택지 표시');
        // 선택 → 되돌리기
        var before = JSON.stringify([st1.flags, st1.stats, st1.trust]);
        $$('#g-dock .choice')[0].click(); await wait();
        ok(PrivacyApp.state().history.length === saved.hist + 1, '선택하면 기록 +1');
        $('#btn-undo').click(); await wait();
        ok(!$('#confirm').hidden, '되돌리기 전 확인 창');
        confirmYes(); await wait();
        var st2 = PrivacyApp.state();
        ok(st2.history.length === saved.hist && JSON.stringify([st2.flags, st2.stats, st2.trust]) === before && st2.scene === saved.scene && !st2.reaction, '되돌리면 선택 전 상태로 정확히 복원');
        // 다른 선택 → 반응 표시 중 새로고침 없이 되돌리기 한 번 더(취소 버튼도 확인)
        $$('#g-dock .choice')[1].click(); await wait();
        $('#btn-undo').click(); await wait();
        $('#confirm-no').click(); await wait();
        ok(PrivacyApp.state().history.length === saved.hist + 1, '확인 창에서 취소하면 그대로');
        $('#btn-undo').click(); await wait(); confirmYes(); await wait();
        ok(PrivacyApp.state().history.length === saved.hist && view() === 'v-game', '되돌린 뒤에도 기록 수 일관');
        var left = await play(R.D, { from: saved.n });
        ok(left === R.D.length, '나머지 경로 완주');
        await finishChecks('D', R.D.length);
        sessionStorage.setItem('probe-phase', '2'); carry();
        location.reload();
        return;
      }
      if (P.phase === 2) {
        ok(view() === 'v-start' && $('#btn-continue').hidden, '완료 뒤 새로고침: 이어 하기 없음');
        ok(!$('#last-result').hidden && /엔딩 D/.test($('#last-result').textContent), '최근 결과 표시');
        ok(!$('#start-links').hidden && !$('#btn-start-path').hidden, '지난 선택 경로 링크');
        checkResult('D');
        sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
      }
    }

    else if (s === 'blocked') {
      ok(!$('#notice').hidden && /저장할 수 없/.test($('#notice').textContent), '저장소 불가 안내');
      ok(!$('#look-pick').hidden, '공통 캐릭터가 없으면 모습 고르기 표시');
      $('#btn-new').click(); await wait();
      ok(view() === 'v-start' && !$('#look-msg').hidden, '모습을 안 고르면 시작 전 안내');
      $$('input[name=look]')[1].click(); await wait();
      $('#btn-new').click();
      await play(R.C);
      ok(view() === 'v-ending' && $('#e-eyebrow').textContent === '엔딩 C', '저장소 없이도 엔딩까지 진행');
      $('#btn-end-path').click(); await wait();
      ok($$('.path-opts li.mine').length === R.C.length, '메모리 기록으로 경로 화면');
    }

    else if (s === 'corrupt-progress' || s === 'stale-progress') {
      ok(!$('#notice').hidden, '손상 기록 안내: ' + $('#notice').textContent);
      ok($('#btn-continue').hidden, '손상된 진행은 이어 하기 숨김');
      $('#btn-new').click();
      await play(R.A);
      await finishChecks('A', R.A.length);
      if (s === 'stale-progress') {
        ok($$('.ending-chips li.seen').length === 2, '이전 엔딩 기록(B)은 유지 + A');
        ok($$('.opt-note').length >= 1, '이전 플레이에서 고른 선택 표시');
      }
    }

    else if (s === 'wipe' || s === 'restart-keeps') {
      $('#btn-new').click();
      await play(R.B);
      await finishChecks('B', R.B.length);
      if (s === 'wipe') {
        $('#btn-end-replay').click(); await wait();
        $('#btn-menu').click(); await wait();
        $('#btn-menu-wipe').click(); await wait();
        confirmYes(); await wait();
        ok(ls('ethicity.privacy.progress.v1') === null && ls('ethicity.result.privacy') === null, '이 게임 진행·결과 삭제');
        ok(ls('ethicity.player') === P.PLAYER, '공통 플레이어 정보 유지');
        checkOthersKept();
        ok(view() === 'v-start' && $('#last-result').hidden, '시작 화면에 결과 없음');
      } else {
        $('#btn-end-replay').click(); await wait();
        var st3 = PrivacyApp.state();
        ok(st3.scene === 'pro_1' && st3.history.length === 0, '다시 하기: 새 진행');
        checkResult('B');
        var p = JSON.parse(ls('ethicity.privacy.progress.v1'));
        ok(p.endingsSeen.indexOf('B') >= 0 && Object.keys(p.explored).length > 5, '해금 기록 유지');
        // 중간에 처음부터 → 확인 창
        $('#btn-menu').click(); await wait(); $('#btn-menu-home').click(); await wait();
        $('#btn-new').click(); await wait();
        ok(!$('#confirm').hidden, '진행 중 새로 시작 시 확인');
        $('#confirm-no').click();
      }
    }

    else if (s === 'normal-speed') {
      $('#btn-new').click();
      await wait(100);
      var shown = $$('#g-log li').length;
      ok(shown >= 1 && shown < 6 && !!$('.skip-btn'), '대사가 차례로 나옴(100ms 뒤 ' + shown + '줄)');
      $('#g-log').click(); await wait();
      ok($$('#g-log li').length === 6 && $$('#g-dock .choice').length === 3, '화면 누르면 모두 보기 → 선택지');
      $$('#g-dock .choice')[0].click();
      await wait(3000);
      ok(!!$('#btn-next'), '반응 표시 뒤 계속 버튼');
      ok(document.activeElement === $('#btn-next'), '계속 버튼에 키보드 포커스');
      $('#btn-menu').click(); await wait();
      ok(!$('#menu').hidden, '메뉴 열림');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait();
      ok($('#menu').hidden, 'Esc로 메뉴 닫힘');
    }

    else if (s.indexOf('shot-') === 0) { // 스크린샷용: 특정 지점까지 진행 후 멈춤(결과 출력 없음)
      if (s === 'shot-map' || s === 'shot-road') {
        $('#btn-new').click();
        await play(R.A, { upto: s === 'shot-map' ? 1 : 5, stopAtMap: true });
        if (s === 'shot-road') {
          var rt = PrivacyMap.debug.route().slice(0, 30);
          for (var q = 0; q < rt.length; q++) { key(ARROW[rt[q]]); key(ARROW[rt[q]], 'keyup'); await wait(16); while (PrivacyMap.debug.me().moving) await wait(16); }
        } else { $('#btn-map-skip').click(); }
        await wait(300);
        return;
      }
      var stop = { 'shot-start': -1, 'shot-game': 9, 'shot-react': 9, 'shot-ending': null, 'shot-path': null }[s];
      if (stop === -1) return;
      $('#btn-new').click();
      await play(R.D, stop == null ? {} : { upto: stop });
      if (s === 'shot-react') { $$('#g-dock .choice')[1].click(); await wait(); }
      if (s === 'shot-path') { $('#btn-end-path').click(); }
      window.scrollTo(0, 0);
      return;
    }

    out();
  }
  run().catch(function (e) { fail.push('프로브 예외: ' + e.message + ' ' + e.stack); out(); });
})();
