/*
 * 포켓몬식 대화창 — 맵 아래쪽 상자에 한 줄씩. ▼(Enter·Space·클릭)로 다음 줄.
 *   PrivacyTalk.open([{ who, name, text }], { instant, onLine }) → Promise (마지막 줄을 넘기면 끝)
 *   who·name이 없으면 이름 탭 없이(해설·안내). instant면 모든 줄을 한 상자에 쌓고 한 번에 넘긴다.
 * 글자는 textContent로만 넣는다.
 */
(function () {
  'use strict';

  var box = null, nameEl, textEl, nextBtn;
  var lines = [], idx = 0, opts = {}, done = null;

  function $(id) { return document.getElementById(id); }
  function setup() {
    if (box) return;
    box = $('talk');
    nameEl = box.querySelector('.talk-name');
    textEl = box.querySelector('.talk-text');
    nextBtn = $('btn-talk-next');
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); next(); });
    box.addEventListener('click', function () { next(); });
    // 맵(걷기·말 걸기)보다 먼저 받는다: 열려 있으면 Enter·Space는 대화 넘기기
    document.addEventListener('keydown', function (e) {
      if (!isOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target === nextBtn) return; // 버튼 자체의 클릭으로 처리
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'BUTTON' || tag === 'INPUT') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      next();
    }, true);
  }

  function para(line) {
    var p = document.createElement('p');
    if (opts.stack && line.name) {
      var b = document.createElement('b');
      b.textContent = line.name + ': ';
      p.appendChild(b);
    }
    p.appendChild(document.createTextNode(line.text));
    return p;
  }

  function showLine() {
    var line = lines[idx];
    nameEl.hidden = !line.name;
    nameEl.textContent = line.name || '';
    textEl.textContent = '';
    textEl.appendChild(para(line));
    if (opts.onLine) opts.onLine(line, idx);
  }

  function next() {
    if (!isOpen()) return;
    if (!opts.stack && idx < lines.length - 1) { idx++; showLine(); return; }
    close();
  }

  function open(list, o) {
    setup();
    if (isOpen()) close();
    lines = (list || []).filter(function (l) { return l && l.text; });
    opts = o || {};
    opts.stack = !!opts.instant && lines.length > 1;
    idx = 0;
    if (!lines.length) return Promise.resolve();
    box.hidden = false;
    if (opts.stack) {
      nameEl.hidden = true;
      textEl.textContent = '';
      lines.forEach(function (l, i) { textEl.appendChild(para(l)); if (opts.onLine) opts.onLine(l, i); });
    } else showLine();
    return new Promise(function (resolve) { done = resolve; });
  }

  function close() {
    if (!box) return;
    box.hidden = true;
    lines = []; idx = 0;
    var d = done; done = null;
    if (d) d();
  }

  function isOpen() { return !!box && !box.hidden; }

  window.PrivacyTalk = { open: open, next: next, close: close, isOpen: isOpen };
})();
