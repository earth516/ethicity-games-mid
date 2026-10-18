/* 원본 PNG의 프레임/알파를 유지하는 맵 전용 색 보정. 로드 시 한 번만 계산한다. */
(function (root) {
  'use strict';
  function recolor(data, character) {
    for (var i = 0; i < data.length; i += 4) {
      if (!data[i + 3]) continue;
      var r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
      var l = (max + min) / 2, h = 0, s = 0;
      if (delta) {
        s = delta / (1 - Math.abs(2 * l - 1));
        h = max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
        h *= 60;
      }
      // 검은 윤곽은 유지하고 중간 명도 위주로 밝힌다. 피부는 과포화하지 않는다.
      var skin = character && h >= 12 && h <= 48;
      var weight = Math.sin(Math.PI * l);
      l = Math.min(1, l + (character ? 0.045 : 0.09) * weight * Math.min(1, l / 0.15));
      s = Math.min(0.94, s * (skin ? 1.02 : character ? 1.16 : 1.12));
      // 초록은 노란 올리브빛을 줄이고, 나무는 밝은 꿀색, 물/유리는 맑은 청색으로.
      if (!character && s > 0.18) {
        if (h >= 55 && h <= 155) { h += (105 - h) * 0.18; l = Math.min(0.86, l + 0.025 * weight); }
        else if (h >= 18 && h < 55) { h += 3; s *= 0.94; }
        else if (h >= 175 && h <= 245) { h += (202 - h) * 0.18; }
      }
      var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
      var rgb = h < 60 ? [c,x,0] : h < 120 ? [x,c,0] : h < 180 ? [0,c,x] : h < 240 ? [0,x,c] : h < 300 ? [x,0,c] : [c,0,x];
      data[i] = Math.round((rgb[0] + m) * 255); data[i + 1] = Math.round((rgb[1] + m) * 255); data[i + 2] = Math.round((rgb[2] + m) * 255);
    }
    return data;
  }
  function image(source, character) {
    try {
      var c = document.createElement('canvas');
      c.width = source.naturalWidth; c.height = source.naturalHeight;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(source, 0, 0);
      var pixels = ctx.getImageData(0, 0, c.width, c.height);
      recolor(pixels.data, character); ctx.putImageData(pixels, 0, 0);
      c.naturalWidth = c.width; c.naturalHeight = c.height;
      return c;
    } catch (e) { return source; } // file:// 보안 제한 등에서는 원본으로 계속 실행
  }
  root.PrivacyPalette = { recolor: recolor, image: image };
  if (typeof module !== 'undefined') module.exports = root.PrivacyPalette;
})(typeof window !== 'undefined' ? window : globalThis);
