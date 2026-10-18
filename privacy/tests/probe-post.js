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
      if (v === 'v-chapter') { if (opts.stopAtChapter != null && i >= opts.stopAtChapter) return i; $('#btn-chapter-go').click(); continue; }
      if (v === 'v-map') {
        if (opts.upto != null && opts.stopAtMap && i >= opts.upto) return i;
        if (opts.walk) await walkToTarget(opts);
        else { $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); }
        await wait(opts.delay || 0);
        continue;
      }
      if (v !== 'v-game') { fail.push('예상 밖 화면: ' + v); break; }
      if ($('#talk') && !$('#talk').hidden) { await passTalk(); continue; }
      if (PrivacyApp.staging && PrivacyApp.staging()) { await wait(50); continue; }
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
      ok($('#talk').getBoundingClientRect().height >= 118, '한 줄이어도 넉넉한 대화창 높이 ' + Math.round($('#talk').getBoundingClientRect().height));
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

    else if (s === 'stage-phone') {
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      var d = PrivacyMap.debug.stage();
      ok(view() === 'v-game' && d.mode === 'stage' && d.place === 'classroom', '단톡 장면이 교실 무대 위에서 ' + JSON.stringify(d));
      ok(['hayun', 'dohyun', 'seoa', 'minjun'].every(function (w) { return d.cast.indexOf(w) >= 0; }), '같은 공간 친구 4명: ' + d.cast);
      ok($('#g-phone').getAttribute('data-device') === 'phone' && !$('#g-phone').hidden, '폰 오버레이');
      ok($('#g-phone').getBoundingClientRect().width <= $('#stage').clientWidth * 0.45, '데스크톱에서 폰은 무대 폭의 45% 이하 ' + Math.round($('#g-phone').getBoundingClientRect().width) + '/' + $('#stage').clientWidth);
      ok(d.bubbles.indexOf('dohyun') >= 0 && d.bubbles.indexOf('minjun') >= 0, '메시지 보낸 친구 머리 위 말풍선: ' + d.bubbles);
      ok(d.bubbleTexts.indexOf('…') >= 0 && d.bubbleTexts.indexOf('👀') >= 0, '손으로 쓴 반응(서아 …, 하윤 👀): ' + d.bubbleTexts);
      ok(d.bubbleTexts.every(function (t) { return t.indexOf('올려야지') < 0; }), '폰 메시지 원문은 머리 위에 안 뜸');
      var mp = PrivacyMap.debug.me(), mpt = PrivacyMap.debug.tileToClient(mp.x, mp.y), phr = $('#g-phone').getBoundingClientRect(), dkr = $('#g-dock').getBoundingClientRect();
      ok(phr.right < dkr.left, '시선 순서: 폰(카톡)은 왼쪽, 선택 상자는 오른쪽 ' + [Math.round(phr.right), Math.round(dkr.left)]);
      ok(mpt.x > phr.right && mpt.y < dkr.top, '주인공이 폰·선택 상자에 가리지 않음 ' + JSON.stringify([Math.round(mpt.x), Math.round(mpt.y), Math.round(phr.left), Math.round(dkr.top)]));
      var m1 = PrivacyMap.debug.me(); key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(300); var m2 = PrivacyMap.debug.me();
      ok(m1.x === m2.x && m1.y === m2.y && view() === 'v-game', '장면 중 방향키로 걷지 않음');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true })); await wait();
      ok(PrivacyApp.state().reaction === 'photo', '숫자 키로 선택');
    }

    else if (s === 'stage-flow') {
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait(50);
      var f1 = PrivacyMap.debug.stage();
      ok(view() === 'v-game' && f1.place === 'room' && f1.tint === 'evening', '하교해 침대 → 내 방 저녁 무대 ' + JSON.stringify(f1));
      await play(R.A, { from: 1, upto: 3 });
      ok(PrivacyApp.state().scene === 'c1_e2_a' && $('#g-phone').hidden && $$('#g-dock .choice').length > 0, '장소 장면: 폰 없이 대화창 → 선택지');
      ok(PrivacyMap.debug.stage().place === 'classroom', '장소 장면 무대: 교실');
      await play(R.A, { from: 3, upto: 4 });
      ok(PrivacyApp.state().scene === 'c1_e2_b' && PrivacyMap.debug.stage().place === 'room' && PrivacyMap.debug.stage().tint === 'night', '그날 밤 내 방');
      $('#btn-undo').click(); await wait(); confirmYes(); await wait(50); await passTalk(); await wait(50);
      ok(PrivacyApp.state().scene === 'c1_e2_a' && PrivacyMap.debug.stage().place === 'classroom', '되돌리면 무대도 교실로');
      await play(R.A, { from: 3, upto: 8 });
      ok(PrivacyApp.state().scene === 'c2_e5_a' && $('#g-phone').getAttribute('data-device') === 'monitor', 'AI 도우미는 모니터');
      ok(PrivacyMap.debug.stage().place === 'room', '모니터 장면 무대: 내 방');
    }

    else if (s === 'stage-resize') {
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      $('#stage').style.width = '400px';
      window.dispatchEvent(new Event('resize')); await wait(300);
      var cw = $('#m-canvas').getBoundingClientRect().width;
      ok(Math.abs(cw - $('#stage').clientWidth) < 2, '좁아지면 캔버스도 무대 폭으로 ' + Math.round(cw) + '/' + $('#stage').clientWidth);
      var pr = $('#g-phone').getBoundingClientRect(), sr = $('#stage').getBoundingClientRect();
      ok(pr.width > sr.width * 0.8 && pr.height < sr.height * 0.75, '좁은 무대: 폰은 아래 시트 ' + [pr.width, pr.height, sr.width, sr.height].map(Math.round));
      ok(pr.top > sr.top + 60, '폰 위로 맵이 보임');
      var rme = PrivacyMap.debug.me(), rpt = PrivacyMap.debug.tileToClient(rme.x, rme.y);
      ok(rpt.y < pr.top && rpt.x > sr.left && rpt.x < sr.right, '좁아진 뒤에도 주인공이 폰 위에 보임 ' + JSON.stringify([Math.round(rpt.x), Math.round(rpt.y), Math.round(pr.top)]));
    }

    else if (s === 'title') {
      ok(view() === 'v-start', '시작 화면');
      ok(!$('.start-phone'), '메신저 푸시 알림 장식 없음');
      ok(/단톡방 28명, 스토리 조회 312회, 캡처 1장/.test($('#v-start').textContent), '훅 문장 유지');
      var imgs = $$('#look-pick .hero-card img');
      ok(imgs.length === 2 && /hero-boy\.png$/.test(imgs[0].getAttribute('src')) && /hero-girl\.png$/.test(imgs[1].getAttribute('src')), '두 주인공 일러스트');
      var gi = 0; while (imgs.some(function (im) { return !im.complete; }) && gi++ < 100) await wait(30);
      var r0 = imgs[0].getBoundingClientRect(), r1 = imgs[1].getBoundingClientRect();
      ok(Math.abs(r0.width - r1.width) < 1 && Math.abs(r0.height - r1.height) < 1 && r0.height >= 150, '두 주인공 같은 비중 ' + [r0.width, r0.height, r1.width, r1.height].map(Math.round));
      ok(Math.abs(r0.top - r1.top) < 1, '나란히 배치');
      ok($$('input[name=look]').length === 2 && $$('.hero-card input[name=look]').length === 2, '카드 자체가 고르기(라디오)');
      // 첫 화면 안에 시작 버튼: 휴대폰·노트북 크기 iframe
      var sizes = [[375, 667], [1280, 720]];
      for (var si = 0; si < sizes.length; si++) {
        var fr = document.createElement('iframe');
        fr.style.cssText = 'position:absolute;left:0;top:0;border:0;width:' + sizes[si][0] + 'px;height:' + sizes[si][1] + 'px';
        fr.src = 'index.html';
        document.body.appendChild(fr);
        await new Promise(function (r) { fr.onload = r; });
        var fd = fr.contentDocument, fg = 0;
        var fimgs = Array.prototype.slice.call(fd.querySelectorAll('#look-pick .hero-card img'));
        while (fimgs.some(function (im) { return !im.complete; }) && fg++ < 100) await wait(30);
        await wait(50);
        var bb = fd.getElementById('btn-new').getBoundingClientRect();
        var h0 = fimgs[0].getBoundingClientRect(), h1 = fimgs[1].getBoundingClientRect();
        ok(bb.bottom <= sizes[si][1] && bb.top > 0, sizes[si].join('×') + ': 시작 버튼이 첫 화면 안 (아래끝 ' + Math.round(bb.bottom) + ')');
        ok(Math.abs(h0.height - h1.height) < 1 && Math.abs(h0.top - h1.top) < 1 && h0.right <= sizes[si][0] && h1.right <= sizes[si][0] + 1, sizes[si].join('×') + ': 두 주인공 나란히·같은 크기·가로 넘침 없음');
        ok(fd.documentElement.scrollWidth <= sizes[si][0] + 1, sizes[si].join('×') + ': 가로 스크롤 없음');
        fr.remove();
      }
      // 고르고 시작
      $$('input[name=look]')[0].click(); await wait();
      ok($$('.hero-card')[0].matches('.hero-card:has(input:checked)'), '고른 카드 표시');
      $('#btn-new').click(); await wait(30);
      ok(view() === 'v-map', '시작하면 등교 맵');
    }

    else if (s === 'chapter-face') {
      $('#btn-new').click();
      var ci = await play(R.A, { stopAtChapter: 6 });
      ok(ci === 6 && view() === 'v-chapter' && !$('#stage').hidden, '1장 끝: 장 카드가 맵 무대 위에');
      var lis = $$('#c-summary .trust-list li');
      ok(lis.length >= 4 && lis.every(function (li) { return li.lastElementChild && li.lastElementChild.matches('.spr.face'); }), '관계 줄마다 오른쪽 끝에 얼굴 (' + lis.length + '줄)');
      ok(lis.every(function (li) { return !!li.querySelector('.trust-mark'); }), '가까워짐·그대로·멀어짐 표식');
      var mj = $('#c-summary .trust-list li[data-who="minjun"] .spr.face');
      var gl = 0; while (mj && !mj.classList.contains('loaded') && gl++ < 100) await wait(30);
      ok(!!mj && mj.getAttribute('data-who') === 'minjun' && /char_minjun\.png/.test(mj.style.backgroundImage), '민준 줄엔 민준 시트에서 자른 얼굴');
      ok(!!mj && mj.getBoundingClientRect().width >= 60 && mj.getBoundingClientRect().right <= $('#c-summary .trust-list').getBoundingClientRect().right + 1, '얼굴 2배 크기, 줄 안에 들어감');
      $('#btn-chapter-go').click();
      await play(R.A, { from: 6 });
      ok($$('#e-stats .trust-list li .spr.face').length >= 4, '엔딩 관계 줄에도 얼굴');
    }

    else if (s === 'no-sprites') {
      $('#btn-new').click();
      await play(R.C);
      ok(view() === 'v-ending', '그림을 못 불러와도 엔딩까지 진행');
      var fb = $$('#e-stats .trust-list .spr.face');
      ok(fb.length >= 4 && fb.every(function (n) { return n.classList.contains('fallback') && n.textContent.length > 0; }), '얼굴 대신 이니셜 ' + fb.map(function (n) { return n.textContent; }));
    }

    else if (s === 'quest-icon') {
      $('#btn-new').click(); await wait(30);
      ok($('#v-map').textContent.indexOf('❗') < 0 && $$('#v-map .map-help .ico-quest').length === 1, '맵 안내 문장: ❗ 대신 노란 느낌표 그림');
      key('ArrowRight'); key('ArrowRight', 'keyup'); await wait(300); // 침대 옆에서 한 칸 비켜 아무것도 없는 곳으로
      $('#btn-map-act').click(); await wait(30);
      ok(!!$('#m-say .ico-quest') && $('#m-say').textContent.indexOf('❗') < 0, '대상 아닌 곳에서 누를 때 안내에도 그림');
      $('#btn-map-skip').click(); await wait(30);
      ok(!!$('#btn-map-act .ico-quest') && $('#btn-map-act').textContent.indexOf('❗') < 0 && /하윤에게 말 걸기/.test($('#btn-map-act').textContent), '목적지 버튼: 그림 + 하윤에게 말 걸기');
      ok($$('.ico-quest').every(function (im) { return /quest\.png/.test(getComputedStyle(im).backgroundImage) && im.getAttribute('role') === 'img' && !!im.getAttribute('aria-label'); }), 'quest.png 사용·대체 글자 있음');
    }

    else if (s === 'smooth') {
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      var SM = PrivacyMap.debug;
      // 마을 길 가운데로 가서(카메라가 맵 끝에 막히지 않는 곳) 움직임 줄이기를 끈다
      var r0 = SM.routeTo(30, 16) || [];
      for (var k = 0; k < r0.length; k++) { key(ARROW[r0[k]]); key(ARROW[r0[k]], 'keyup'); var g = 0; await wait(16); while (SM.me().moving && g++ < 100) await wait(16); }
      $('#opt-motion').checked = true; $('#opt-motion').click(); await wait(400);
      var c0 = SM.cam();
      ok(Math.abs(c0.x - c0.tx) < 1, '멈춰 있으면 카메라가 주인공에 맞춰짐');
      key('ArrowRight'); SM.tick(50); // 기다리지 않고 50ms만 진행
      var c1 = SM.cam();
      ok(c1.tx - c1.x > 1, '걷기 시작하면 카메라가 살짝 늦게 따라옴 ' + JSON.stringify(c1));
      ok(c1.x === Math.round(c1.x), '카메라 좌표는 정수 픽셀(흔들림 방지)');
      key('ArrowRight', 'keyup');
      await wait(900);
      var c2 = SM.cam();
      ok(Math.abs(c2.x - c2.tx) < 1, '멈추면 곧 따라잡음 ' + JSON.stringify(c2));
      // 걷기 동작: 반 칸마다 한 프레임(한 칸에 약 2번 바뀜, 칸이 바뀌어도 이어짐). 시간 대신 걸은 칸 수로 잰다
      var r1 = SM.routeTo(40, 20) || [];
      for (var k1 = 0; k1 < r1.length; k1++) { key(ARROW[r1[k1]]); key(ARROW[r1[k1]], 'keyup'); var g1 = 0; await wait(16); while (SM.me().moving && g1++ < 100) await wait(16); }
      var lastF = SM.walkFrame(), lastX = SM.me().x, fch = 0, tiles = 0;
      key('ArrowRight');
      for (var st = 0; st < 80; st++) { // 15ms씩 80번(=1.2초) 직접 진행
        SM.tick(15);
        var wf = SM.walkFrame(), mx = SM.me().x;
        if (wf !== lastF) fch++;
        lastF = wf;
        if (mx !== lastX) { tiles += Math.abs(mx - lastX); lastX = mx; }
      }
      key('ArrowRight', 'keyup');
      ok(tiles >= 6 && fch / tiles >= 1 && fch / tiles <= 2.6, '걷기 동작: 한 칸에 약 2번 바뀜(' + fch + '번/' + tiles + '칸)');
      // 움직임 줄이기를 켜면 카메라는 바로 붙는다
      $('#opt-motion').checked = false; $('#opt-motion').click(); await wait(300);
      key('ArrowRight'); SM.tick(50); var c3 = SM.cam(); key('ArrowRight', 'keyup');
      ok(Math.abs(c3.x - c3.tx) < 1, '움직임 줄이기면 카메라가 바로 따라붙음');
    }

    else if (s === 'marker') {
      // ❗가 위 안내 상자·아래 버튼·안내 문구에 가리지 않는지(화면 좌표로 겹침 검사)
      function markerVisible(label) {
        var mk = PrivacyMap.debug.marker(), cr = $('#m-canvas').getBoundingClientRect();
        if (!mk) { fail.push(label + ': ❗ 없음'); return null; }
        var px = cr.left + mk.x, py = cr.top + mk.y;
        var hits = ['.hud-left', '.hud .bar-actions', '#v-map .map-controls', '#v-map .map-help', '#m-say'].filter(function (q) {
          var e = $(q); if (!e || !e.getClientRects().length) return false;
          var r = e.getBoundingClientRect(); return px >= r.left - 12 && px <= r.right + 12 && py >= r.top - 12 && py <= r.bottom + 12;
        });
        ok(hits.length === 0 && px > cr.left && px < cr.right && py > cr.top && py < cr.bottom, label + ': ❗가 안내 상자·버튼에 가리지 않음 ' + JSON.stringify([Math.round(px), Math.round(py), hits]));
        return mk;
      }
      $('#btn-new').click(); await wait(300);
      var mk0 = markerVisible('첫날 아침 내 방');
      ok(!!mk0 && mk0.tx === 34 && mk0.ty === 8, '방 안에서 목적지가 바깥이면 ❗는 방문에 ' + JSON.stringify(mk0));
      // 집 밖으로 나가면 다시 목적지(교실 하윤) 쪽
      var rt = PrivacyMap.debug.routeTo(42, 19) || [];
      for (var k = 0; k < rt.length; k++) { key(ARROW[rt[k]]); key(ARROW[rt[k]], 'keyup'); var g = 0; await wait(16); while (PrivacyMap.debug.me().moving && g++ < 100) await wait(16); }
      await wait(100);
      var mk1 = markerVisible('집 앞');
      ok(!!mk1 && !(mk1.tx === 34 && mk1.ty === 8), '집 밖에선 ❗가 학교 쪽 ' + JSON.stringify(mk1));
    }

    else if (s === 'neighborhood') {
      $('#btn-new').click();
      await play(R.A, { upto: 1, stopAtMap: true });
      var NM = PrivacyMap.debug, NW = window.PRIVACY_WORLD;
      async function walkTo(tx, ty) {
        var rt = NM.routeTo(tx, ty);
        if (!rt) { fail.push('길 없음 ' + tx + ',' + ty); return false; }
        for (var k = 0; k < rt.length; k++) { key(ARROW[rt[k]]); key(ARROW[rt[k]], 'keyup'); var g = 0; await wait(16); while (NM.me().moving && g++ < 100) await wait(16); }
        var m = NM.me(); return m.x === tx && m.y === ty;
      }
      ok(NW.NEIGHBORS.length === 3, '이웃집 3채');
      for (var ni = 0; ni < NW.NEIGHBORS.length; ni++) {
        var nb = NW.NEIGHBORS[ni];
        ok(await walkTo(nb.approach.x, nb.approach.y), nb.name + ' 현관 앞까지 걸어감');
        ok(NM.me().area === '주택가', nb.name + ' 앞은 주택가: ' + NM.me().area);
        key('ArrowUp'); key('ArrowUp', 'keyup'); await wait(250);
        var nm = NM.me();
        ok(nm.x === nb.approach.x && nm.y === nb.approach.y && nm.dir === 'up', nb.name + ' 안으로는 들어가지 않음');
        key(' '); await wait(50);
        ok(!$('#talk').hidden && $('#talk .talk-text').textContent.indexOf(nb.look.slice(0, 8)) >= 0, nb.name + ' 조사: 생활 대사');
        await passTalk();
        var ns = PrivacyApp.state();
        ok(view() === 'v-map' && ns.screen === 'map' && ns.mapTarget === 'c1_e1_a', nb.name + ' 조사 뒤에도 같은 걷기(문 이동·장면 없음)');
      }
      ok(await walkTo(43, 18), '우리 집 현관 옆');
      key('ArrowRight'); key('ArrowRight', 'keyup'); await wait(250); key(' '); await wait(50);
      ok(!$('#talk').hidden && /우편함/.test($('#talk .talk-text').textContent), '노란 우편함 조사');
      await passTalk();
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait(50);
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_a', '주택가를 돌아본 뒤 본편 진행');
    }

    else if (s === 'pos-recover') {
      var E3 = window.PrivacyEngine, ST3 = window.PRIVACY_STORY, PK3 = 'ethicity.privacy.progress.v1';
      if (P.phase === 0) { // 저장 위치가 새로 생긴 벽돌집 안(39,26)
        var m3 = E3.createState(ST3), g3 = 0;
        while (!(m3.screen === 'map' && m3.mapTarget === 'c1_e1_a') && g3++ < 8) m3 = m3.screen === 'scene' && E3.needsChoice(ST3, m3) ? E3.choose(ST3, m3, 'photo') : E3.advance(ST3, m3);
        m3.history = [];
        localStorage.setItem(PK3, JSON.stringify({ v: 1, run: m3, explored: { pro_1: ['photo'] }, endingsSeen: ['B'], pos: { x: 39, y: 26, dir: 'up', for: 'c1_e1_a' } }));
        sessionStorage.setItem('probe-saved', JSON.stringify(m3.stats));
        sessionStorage.setItem('probe-phase', '1'); carry(); location.reload(); return;
      }
      ok(!$('#btn-continue').hidden, '이어 하기');
      $('#btn-continue').click(); await wait(50);
      var rm = PrivacyMap.debug.me();
      ok(view() === 'v-map' && PrivacyApp.state().mapTarget === 'c1_e1_a', '같은 걷기에서 이어짐');
      ok(window.PRIVACY_WORLD.walkable(rm.x, rm.y) && Math.abs(rm.x - 39) + Math.abs(rm.y - 26) <= 3, '집 안 저장 위치 → 가까운 걸을 수 있는 칸 ' + JSON.stringify(rm));
      var pg = JSON.parse(ls(PK3));
      ok(pg.endingsSeen.indexOf('B') >= 0 && pg.explored.pro_1 && JSON.stringify(PrivacyApp.state().stats) === sessionStorage.getItem('probe-saved'), '진행·완료 기록은 그대로');
      checkOthersKept();
      ok(ls('ethicity.player') === P.PLAYER, '공통 플레이어 정보 보존');
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk(); await wait(50);
      ok(view() === 'v-game' && PrivacyApp.state().scene === 'c1_e1_a', '복구 뒤 본편 진행');
      sessionStorage.removeItem('probe-phase'); sessionStorage.removeItem('probe-carry');
    }

    else if (s === 'sound') {
      ok(!/"sound":true/.test(ls('ethicity.privacy.settings.v1') || ''), '효과음은 기본 꺼짐');
      $('#btn-new').click();
      await play(R.A, { upto: 0 });
      ok(window.__beeps === 0, '꺼져 있으면 메시지가 와도 소리 없음');
      $('#btn-menu').click(); await wait();
      ok(!!$('#opt-sound') && !$('#opt-sound').checked, '메뉴에 효과음 켜기(꺼짐 표시)');
      $('#opt-sound').click(); await wait();
      $('#btn-menu-close').click(); await wait();
      ok(JSON.parse(ls('ethicity.privacy.settings.v1')).sound === true && window.__beeps === 1, '켠 설정이 저장되고 미리듣기 한 번');
      await wait(300);
      var b0 = window.__beeps;
      $$('#g-dock .choice')[0].click(); await wait(400);
      var got = window.__beeps - b0;
      ok(got >= 1 && got <= 3, '친구 메시지가 오면 수신음(한꺼번에 와도 겹치지 않게) ' + got + '번');
      var gn = 0; while (!$('#btn-next') && gn++ < 100) await wait(20);
      var b1 = window.__beeps;
      $('#btn-next').click(); await wait(50);
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(400); await passTalk(); await wait(50);
      ok(window.__beeps >= b1, '맵·대화창에서는 수신음 강요 없음');
    }

    else if (s === 'finale') {
      $('#btn-new').click();
      await play(R.D, { upto: R.D.length - 1 });
      // 마지막 선택은 보통 속도·움직임 켬으로: 글이 차례로 떠오르는지 본다
      $('#opt-motion').checked = true; $('#opt-motion').click(); PrivacyApp.setSpeed('normal'); await wait(); // 움직임 줄이기 끔
      await play(R.D, { from: R.D.length - 1 });
      var fin = $('#finale');
      ok(!!fin && !fin.hidden && view() === 'v-ending', '엔딩 도착 → 검은 화면 연출');
      ok(!!fin && getComputedStyle(fin).backgroundColor === 'rgb(0, 0, 0)', '검은 화면');
      ok(!!fin && fin.getAttribute('role') === 'dialog' && document.activeElement && fin.contains(document.activeElement), '연출에 포커스(대화상자)');
      var shown0 = $$('#finale .finale-line:not(.on)').length;
      ok(shown0 > 0, '처음엔 글이 다 뜨지 않음(차례로 떠오름) 남은 줄 ' + shown0);
      fin.click(); await wait(50);
      ok($$('#finale .finale-line:not(.on)').length === 0, '누르면 남은 줄이 한꺼번에');
      ok(/게임이 끝났습니다\./.test(fin.textContent) && /과연 당신의 선택은 어떠했을까요\?/.test(fin.textContent), '두 문장');
      var picks = $$('#finale .finale-choice');
      ok(picks.length === 9, '9개 사건 내 선택 ' + picks.length + '줄');
      var st = PrivacyApp.state(), ST = window.PRIVACY_STORY;
      var e1 = st.history.filter(function (h) { return ST.scenes[h.scene].event === 'e1'; })[0];
      var e1text = ST.scenes[e1.scene].choices.filter(function (c) { return c.id === e1.choice; })[0].text;
      ok(picks[0] && picks[0].textContent.indexOf(ST.events.e1.title) >= 0 && picks[0].textContent.indexOf(e1text.replace(/\{name\}/g, '').slice(0, 8)) >= 0, '첫 줄 = 정산 계좌번호 + 그때 고른 선택');
      var bonds = $$('#finale .finale-bond');
      var mark0 = st.chapterMarks[0].trust;
      var okBonds = bonds.length === ST.trustable.length && bonds.every(function (b) {
        var w = b.getAttribute('data-who'), d = st.trust[w] - (mark0[w] || 0);
        var word = d > 0 ? '친해짐' : d < 0 ? '멀어짐' : '그대로';
        return !!b.querySelector('.spr.face') && b.textContent.indexOf(ST.characters[w].name) >= 0 && b.textContent.indexOf(word) >= 0;
      });
      ok(okBonds, '친구마다 얼굴 + 친해짐/그대로/멀어짐(실제 관계 변화와 일치) ' + bonds.map(function (b) { return b.textContent; }).join(' / '));
      ok(/엔딩 D/.test($('#finale .finale-end').textContent), '마지막에 엔딩 이름');
      $('#finale-go').click(); await wait(50);
      ok($('#finale').hidden && view() === 'v-ending' && /엔딩 D/.test($('#e-eyebrow').textContent), '결과 보기 → 엔딩 페이지');
      $('#btn-end-path').click(); await wait(); $('#btn-path-back').click(); await wait();
      ok(view() === 'v-ending' && $('#finale').hidden, '경로에서 돌아올 땐 연출 없이');
    }

    else if (s === 'school-roof') {
      $('#btn-new').click(); await wait(30);
      ok(PrivacyMap.debug.roof() === true, '학교 밖(내 방)에선 학교 지붕이 덮여 있음');
      var ow = { walk: true, areas: [], roofAt: {} };
      var M = PrivacyMap.debug, route = M.route();
      for (var k = 0; k < route.length; k++) {
        key(ARROW[route[k]]); key(ARROW[route[k]], 'keyup'); var g = 0; await wait(16); while (M.me().moving && g++ < 100) await wait(16);
        var a = M.me().area; if (!(a in ow.roofAt)) ow.roofAt[a] = M.roof();
      }
      ok(ow.roofAt['교문'] === true && ow.roofAt['마을 길'] === true, '교문·마을 길에선 지붕 덮임 ' + JSON.stringify(ow.roofAt));
      ok(ow.roofAt['복도'] === false && ow.roofAt['2학년 3반 교실'] === false, '건물에 들어가면 지붕이 사라짐');
    }

    else if (s === 'talk-guard') {
      $('#btn-new').click(); await wait(30);
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(30);
      ok(!$('#talk').hidden && document.activeElement === $('#btn-talk-next'), '대화창이 열리면 ▼에 키보드 포커스');
      key('ArrowLeft'); key('ArrowLeft', 'keyup'); await wait(200);
      ok(!$('#talk').hidden && view() === 'v-map', '하윤 소개 중 방향키로 건너뛰지 않음');
      // 소개 도중 처음부터 다시 → 내 방에서 다시 걷기(바로 장면으로 넘어가면 안 됨)
      $('#btn-menu').click(); await wait(); $('#btn-menu-restart').click(); await wait(); confirmYes(); await wait(50);
      if (!$('#talk').hidden) { $('#btn-talk-next').click(); await wait(50); }
      var rs = PrivacyApp.state();
      ok(view() === 'v-map' && rs.screen === 'map' && rs.mapTarget === 'pro_1' && /내 방/.test($('#m-area').textContent), '소개 중 처음부터 다시 → 내 방 걷기부터 ' + JSON.stringify([view(), rs.screen, $('#m-area').textContent]));
      // 장소 장면에서 대화창이 열린 채 되돌리기 → 대화창 닫힘
      await play(R.A, { upto: 2 });
      $$('#g-dock .choice').filter(function (b) { return b.getAttribute('data-choice') === 'fix'; })[0].click(); await wait(50);
      var gn = 0; while (!$('#btn-next') && gn++ < 100) await wait(20);
      $('#btn-next').click(); await wait(50);
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(50);
      var gt = 0; while ($('#talk').hidden && gt++ < 100) await wait(20);
      ok(PrivacyApp.state().scene === 'c1_e2_a' && !$('#talk').hidden, '장소 장면 대화창 열림');
      $('#btn-undo').click(); await wait(); confirmYes(); await wait(100);
      ok(PrivacyApp.state().scene === 'c1_e1_b' && $('#talk').hidden, '되돌리면 이전 장면 대화창은 닫힘');
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
      $('#btn-new').click(); await wait();
      $('#btn-map-skip').click(); await wait(); $('#btn-map-act').click(); await wait(); await passTalk();
      var gw = 0; while (!$$('#g-log li').length && gw++ < 200) await wait(20);
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
      if (s === 'shot-opening') { $('#btn-new').click(); await wait(500); return; }
      if (s === 'shot-talk') { $('#btn-new').click(); await play(R.A, { upto: 1, stopAtMap: true }); var pd = PrivacyMap.debug.tileToClient(8, 2); $('#m-canvas').dispatchEvent(new PointerEvent('pointerdown', { clientX: pd.x, clientY: pd.y, bubbles: true })); await wait(1500); return; }
      if (s === 'shot-hood' || s === 'shot-gate' || s === 'shot-south' || s === 'shot-edge' || s === 'shot-front') { // 주택가·교문 화면 확인용: 그 자리까지 걸어감
        $('#btn-new').click(); await play(R.A, { upto: 1, stopAtMap: true });
        var dest = { 'shot-hood': [46, 20], 'shot-gate': [24, 16], 'shot-south': [44, 27], 'shot-edge': [58, 30], 'shot-front': [12, 14] }[s];
        var rr = PrivacyMap.debug.routeTo(dest[0], dest[1]) || [];
        for (var q = 0; q < rr.length; q++) { key(ARROW[rr[q]]); key(ARROW[rr[q]], 'keyup'); await wait(16); while (PrivacyMap.debug.me().moving) await wait(16); }
        await wait(500); return;
      }
      if (s === 'shot-chapter') { $('#btn-new').click(); await play(R.A, { stopAtChapter: 6 }); await wait(500); $('#c-summary .change-grid').scrollIntoView({ block: 'center' }); return; }
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
