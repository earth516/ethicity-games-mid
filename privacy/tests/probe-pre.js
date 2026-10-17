// 프로브(앱보다 먼저 실행): 시나리오별 저장소 준비 + 오류 수집
(function () {
  var q = new URLSearchParams(location.search);
  var scenario = q.get('probe');
  window.__probe = { scenario: scenario, errors: [], phase: Number(sessionStorage.getItem('probe-phase') || 0) };
  window.addEventListener('error', function (e) { window.__probe.errors.push('error: ' + e.message); });
  window.addEventListener('unhandledrejection', function (e) { window.__probe.errors.push('rejection: ' + e.reason); });
  var ce = console.error;
  console.error = function () { window.__probe.errors.push('console.error: ' + Array.prototype.join.call(arguments, ' ')); ce.apply(console, arguments); };

  var OTHER = { 'ethicity.result.ai-art': '{"game":"ai-art","completed":true,"ending":"A","card":"다른 게임"}', 'ethicity.deepfake.progress.v1': '{"v":1,"scene":"x"}' };
  var PLAYER = '{"character":"char_03","nickname":"반짝이는 고래"}';
  window.__probe.OTHER = OTHER;
  window.__probe.PLAYER = PLAYER;

  if (scenario === 'blocked') {
    // 저장소가 막힌 브라우저 흉내
    Object.defineProperty(window, 'localStorage', { get: function () { throw new Error('SecurityError: blocked'); } });
    return;
  }
  if (window.__probe.phase > 0) return; // 새로고침 뒤에는 저장소를 그대로 둔다

  localStorage.clear();
  Object.keys(OTHER).forEach(function (k) { localStorage.setItem(k, OTHER[k]); });
  var instant = '{"speed":"instant","reduceMotion":true}';
  switch (scenario) {
    case 'no-player': localStorage.setItem('ethicity.privacy.settings.v1', instant); break;
    case 'damaged-player': window.__probe.PLAYER = '{"character":"char_03","nick'; localStorage.setItem('ethicity.player', window.__probe.PLAYER); localStorage.setItem('ethicity.privacy.settings.v1', instant); break;
    case 'wrong-player': window.__probe.PLAYER = '{"character":42,"nickname":["x"]}'; localStorage.setItem('ethicity.player', window.__probe.PLAYER); localStorage.setItem('ethicity.privacy.settings.v1', instant); break;
    case 'xss':
      PLAYER = JSON.stringify({ character: 'char_07', nickname: '<img src=x onerror="window.__xss=1"><b>굵게</b>아주아주아주아주아주아주긴별명을가진반짝이는고래와친구들' });
      window.__probe.PLAYER = PLAYER;
      localStorage.setItem('ethicity.player', PLAYER); localStorage.setItem('ethicity.privacy.settings.v1', instant); break;
    case 'corrupt-progress': localStorage.setItem('ethicity.player', PLAYER); localStorage.setItem('ethicity.privacy.progress.v1', '{"v":1,"run":'); localStorage.setItem('ethicity.privacy.settings.v1', instant); break;
    case 'stale-progress': localStorage.setItem('ethicity.player', PLAYER); localStorage.setItem('ethicity.privacy.progress.v1', '{"v":1,"run":{"v":1,"screen":"scene","scene":"사라진_장면","stats":{},"trust":{},"flags":{},"history":[],"visited":[]},"explored":{"pro_1":["sns"]},"endingsSeen":["B"]}'); localStorage.setItem('ethicity.privacy.settings.v1', instant); break;
    case 'normal-speed': localStorage.setItem('ethicity.player', PLAYER); break;
    case 'shot-start': case 'shot-game': case 'shot-react': case 'shot-ending': case 'shot-path':
      window.__probe.PLAYER = JSON.stringify({ character: 'char_03', nickname: '반짝이는 고래와 은하수 너머의 친구들' });
      localStorage.setItem('ethicity.player', window.__probe.PLAYER); localStorage.setItem('ethicity.privacy.settings.v1', instant); break;
    default: localStorage.setItem('ethicity.player', PLAYER); localStorage.setItem('ethicity.privacy.settings.v1', instant);
  }
})();
