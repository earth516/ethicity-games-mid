/*
 * 그림 주소 고르기 — tools/to-webp.mjs가 만든 목록(js/webp-list.js)에 있는 .png는 같은 자리의 .webp를 먼저 쓴다.
 *   PrivacyImg.src('assets/x.png')     → 'assets/x.webp' 또는 그대로
 *   PrivacyImg.load(img, 'assets/x.png') → webp로 불러오고, 실패하면 png로 한 번 다시
 * 원본 PNG는 그대로 두므로 webp를 못 쓰는 환경에서도 그림이 뜬다.
 */
(function () {
  'use strict';
  function src(png) { return (window.PRIVACY_WEBP || {})[png] ? png.replace(/\.png$/, '.webp') : png; }
  function load(im, png) {
    var w = src(png);
    if (w !== png) {
      im.addEventListener('error', function retry() {
        im.removeEventListener('error', retry);
        im.src = png;
      });
    }
    im.src = w;
  }
  window.PrivacyImg = { src: src, load: load };
})();
