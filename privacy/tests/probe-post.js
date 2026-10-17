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
