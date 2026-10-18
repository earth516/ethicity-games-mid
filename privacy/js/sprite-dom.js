/*
 * 캐릭터 시트를 화면(DOM)에 그리는 도우미 — 장 요약·엔딩의 관계 보고 얼굴 등.
 *   PrivacySprite.el(who, { face, scale, look, initial }) → <span class="spr">
 *   시트 = 48×72 칸 × 4프레임(가로) × 아래·왼·오·위(세로). 아래 방향 첫 프레임을 쓴다.
 *   face: 머리 부분(44×38)만. 그림을 못 불러오면 이니셜 동그라미로 남는다.
 */
(function () {
  'use strict';
  var DIR = 'assets/sprites/';
  var SHEET = { w: 192, h: 288 };
  var FULL = { x: 0, y: 0, w: 48, h: 72 };
  var FACE = { x: 2, y: 0, w: 44, h: 38 };
  // 그림이 없을 때 쓰는 인물 색(맵 임시 도형과 같은 색)
  var COLOR = { me: '#0F766E', hayun: '#4E6FC9', dohyun: '#D06A2E', seoa: '#B04F8C', minjun: '#3F7F5C', teacher: '#6E6150', friend: '#7B808A' };

  function el(who, opts) {
    opts = opts || {};
    var k = opts.scale || 2;
    var box = opts.face ? FACE : FULL;
    var file = who === 'me' ? 'char_player_' + (opts.look || 'm') + '.png' : 'char_' + who + '.png';
    var n = document.createElement('span');
    n.className = 'spr' + (opts.face ? ' face' : '') + ' fallback';
    n.setAttribute('data-who', who);
    n.setAttribute('aria-hidden', 'true');
    n.style.width = box.w * k + 'px';
    n.style.height = box.h * k + 'px';
    n.style.backgroundColor = COLOR[who] || '#7B808A';
    n.textContent = opts.initial || '';
    var img = new Image();
    img.onload = function () {
      n.classList.remove('fallback');
      n.classList.add('loaded');
      n.textContent = '';
      n.style.backgroundColor = '';
      n.style.backgroundImage = 'url("' + DIR + file + '")';
      n.style.backgroundSize = SHEET.w * k + 'px ' + SHEET.h * k + 'px';
      n.style.backgroundPosition = -box.x * k + 'px ' + -box.y * k + 'px';
    };
    img.src = DIR + file;
    return n;
  }

  window.PrivacySprite = { el: el, COLOR: COLOR };
})();
