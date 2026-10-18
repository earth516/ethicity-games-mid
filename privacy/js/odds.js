/*
 * 엔딩별 "아무거나 골랐다면" 확률(%) — 선택지를 무작위로 골라 10만 번 완주한 비율(tests/check-story.mjs가 계산).
 * 엔딩 연출에서 "아무거나 골랐다면 이 엔딩에 닿을 확률은 n%예요"로 보여 준다. 플레이어 기록은 모으지 않는다.
 * 이야기를 고쳐 비율이 1%p 넘게 달라지면 check-story가 알려 준다 → 그 값으로 고칠 것.
 */
(function (root) {
  'use strict';
  var ODDS = { A: 1.5, B: 64.9, C: 3.8, D: 29.9 };
  root.PRIVACY_ODDS = ODDS;
  if (typeof module !== 'undefined' && module.exports) module.exports = ODDS;
})(typeof window !== 'undefined' ? window : globalThis);
