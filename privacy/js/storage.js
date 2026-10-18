/*
 * 저장소 래퍼 — localStorage를 쓸 수 없거나(차단·용량·사생활 모드) 값이 손상돼도 게임이 멈추지 않게 한다.
 * 실패하면 메모리에만 보관하고 status로 알려 준다.
 *
 * 키 규약
 *   ethicity.player              공통 플레이어 정보 — 읽기만 한다(절대 쓰지 않음)
 *   ethicity.result.privacy      공통 완료 결과 — 엔딩 도달 시에만 쓴다
 *   ethicity.privacy.progress.v1 이 게임 전용 진행 저장
 *   ethicity.privacy.settings.v1 이 게임 전용 화면 설정
 */
(function (root) {
  'use strict';

  var KEYS = {
    player: 'ethicity.player',
    result: 'ethicity.result.privacy',
    progress: 'ethicity.privacy.progress.v1',
    settings: 'ethicity.privacy.settings.v1'
  };
  var memory = {};
  var status = { available: false, writeFailed: false };

  function ls() { return root.localStorage; }
  (function probe() {
    try {
      var k = '__ethicity_privacy_probe__';
      ls().setItem(k, '1');
      ls().removeItem(k);
      status.available = true;
    } catch (e) { status.available = false; }
  })();

  function get(key) {
    if (status.available) {
      try { return ls().getItem(key); } catch (e) { /* 메모리로 */ }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }
  function set(key, value) {
    memory[key] = value;
    if (!status.available) return false;
    try { ls().setItem(key, value); return true; } catch (e) { status.writeFailed = true; return false; }
  }
  function remove(key) {
    delete memory[key];
    if (status.available) { try { ls().removeItem(key); } catch (e) { /* 무시 */ } }
  }
  function readJSON(key) {
    var raw = get(key);
    if (raw == null) return { ok: true, value: null };
    try { return { ok: true, value: JSON.parse(raw) }; } catch (e) { return { ok: false, value: null }; }
  }
  function writeJSON(key, value) {
    try { return set(key, JSON.stringify(value)); } catch (e) { status.writeFailed = true; return false; }
  }

  /* 공통 플레이어 정보 — 손상·누락 시 기본값. 원본은 건드리지 않는다. */
  function readPlayer(defaultNickname) {
    var r = readJSON(KEYS.player);
    var fallback = { character: null, nickname: defaultNickname, source: 'default' };
    if (!r.ok) { fallback.source = 'damaged'; return fallback; }
    var v = r.value;
    if (v == null) return fallback;
    if (typeof v !== 'object' || Array.isArray(v)) { fallback.source = 'damaged'; return fallback; }
    var nick = typeof v.nickname === 'string' ? v.nickname.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
    var ch = typeof v.character === 'string' && /^[\w-]{1,64}$/.test(v.character) ? v.character : null;
    if (!nick && !ch) { fallback.source = 'damaged'; return fallback; }
    return { character: ch, nickname: nick || defaultNickname, source: 'stored' };
  }

  function saveResult(ending, card) {
    return writeJSON(KEYS.result, { game: 'privacy', completed: true, ending: ending, card: card });
  }
  function readResult() {
    var r = readJSON(KEYS.result);
    var v = r.value;
    if (!r.ok || !v || typeof v !== 'object' || v.game !== 'privacy' || typeof v.ending !== 'string') return null;
    return v;
  }

  root.PrivacyStorage = {
    KEYS: KEYS,
    status: status,
    readJSON: readJSON,
    writeJSON: writeJSON,
    remove: remove,
    readPlayer: readPlayer,
    saveResult: saveResult,
    readResult: readResult
  };
})(window);
