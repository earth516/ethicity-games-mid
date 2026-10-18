/*
 * 화면 처리 — 스토리 데이터(story.js)와 상태 엔진(engine.js)을 화면에 그린다.
 * 모든 이야기 문자열과 별명은 textContent로만 넣는다(HTML로 해석하지 않음).
 */
(function () {
  'use strict';

  var story = window.PRIVACY_STORY;
  story.triggers = window.PRIVACY_WORLD.triggers; // 사건 입구 장면 앞에 맵 이동을 넣는다
  var E = window.PrivacyEngine;
  var S = window.PrivacyStorage;
  var CFG = window.PRIVACY_CONFIG || { characterImages: {}, defaultAvatar: 'assets/avatar-default.svg', defaultNickname: '플레이어' };

  var SPEED_MS = { normal: 650, fast: 220, instant: 0 };
  var VIEW_ICON = { group: '👥', dm: '💬', sns: '📱', ai: '✦', pc: '🖥', place: '📍' };
  // 장면을 띄우는 기기: 폰(메신저·SNS) / 모니터(공용 PC·AI) / 없음(그 자리 대화 → 대화창)
  var DEVICE = { group: 'phone', dm: 'phone', sns: 'phone', ai: 'monitor', pc: 'monitor', place: 'none' };
  var WD = window.PRIVACY_WORLD;
  var VIEW_KIND = { group: '단체 대화방', dm: '개인 대화', sns: 'SNS', ai: 'AI 도우미', pc: '공용 컴퓨터', place: '장소' };

  /* ── 상태 ───────────────────────── */
  var player = S.readPlayer(CFG.defaultNickname);
  var progress = { v: 1, run: null, explored: {}, endingsSeen: [], pos: null };
  var settings = { speed: 'normal', reduceMotion: false, look: null, sound: false };
  var revealTimer = null, revealQueue = [], revealDone = null;
  var pathBack = 'v-start', reflectBack = 'v-start';
  var noticeMsgs = [];
  var posTimer = null;
  var stagedScene = null, stageToken = 0, cutPending = false, spokenDevice = false;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function fill(text) { return String(text).replace(/\{name\}/g, player.nickname); }

  /* ── 불러오기·저장 ───────────────── */
  function loadAll() {
    var r = S.readJSON(S.KEYS.progress);
    if (!r.ok) noticeMsgs.push('저장된 진행 기록이 손상되어 새로 시작해요. (공통 캐릭터와 다른 게임 기록은 그대로예요)');
    var p = r.value;
    if (p && typeof p === 'object' && p.v === 1) {
      if (p.explored && typeof p.explored === 'object') progress.explored = p.explored;
      if (Array.isArray(p.endingsSeen)) progress.endingsSeen = p.endingsSeen.filter(function (c) { return typeof c === 'string'; });
      if (p.pos && typeof p.pos === 'object' && window.PRIVACY_WORLD.walkable(p.pos.x, p.pos.y)) progress.pos = p.pos;
      if (p.run) {
        if (E.isValidState(story, p.run)) progress.run = p.run;
        else noticeMsgs.push('이전 진행을 이어 할 수 없어 처음부터 시작해요.');
      }
    } else if (p) noticeMsgs.push('저장된 진행 기록 형식이 맞지 않아 새로 시작해요.');

    var st = S.readJSON(S.KEYS.settings).value;
    if (st && typeof st === 'object') {
      if (SPEED_MS.hasOwnProperty(st.speed)) settings.speed = st.speed;
      settings.reduceMotion = !!st.reduceMotion;
      settings.sound = st.sound === true;
      if (st.look === 'm' || st.look === 'f') settings.look = st.look;
    } else if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settings.reduceMotion = true;
    }
    if (!S.status.available) noticeMsgs.push('이 브라우저에서는 저장할 수 없어요. 플레이는 되지만, 창을 닫으면 진행이 사라져요.');
  }
  function saveProgress() {
    S.writeJSON(S.KEYS.progress, progress);
    checkWriteFailure();
  }
  function saveSettings() { S.writeJSON(S.KEYS.settings, settings); checkWriteFailure(); }
  var warnedWrite = false;
  function checkWriteFailure() {
    if (S.status.writeFailed && S.status.available && !warnedWrite) {
      warnedWrite = true;
      showNotice('저장 공간에 기록하지 못했어요. 이번 플레이는 계속할 수 있지만, 창을 닫으면 진행이 사라질 수 있어요.');
    }
  }
  function showNotice(msg) {
    var n = $('notice');
    n.textContent = '';
    n.appendChild(el('span', null, msg));
    var x = el('button', 'btn ghost sm', '닫기');
    x.type = 'button';
    x.addEventListener('click', function () { n.hidden = true; });
    n.appendChild(x);
    n.hidden = false;
  }

  function setRun(next) {
    progress.run = next;
    saveProgress();
  }

  /* ── 화면 전환 ───────────────────── */
  var VIEWS = ['v-start', 'v-game', 'v-map', 'v-chapter', 'v-ending', 'v-path', 'v-reflect'];
  var current = 'v-start';
  var STAGE_VIEWS = ['v-map', 'v-game', 'v-chapter']; // 맵 무대 위에 겹쳐 뜨는 화면
  function show(id, focusEl) {
    stopReveal();
    if (STAGE_VIEWS.indexOf(id) < 0) { window.PrivacyMap.hide(); stagedScene = null; stageToken++; }
    if (id !== 'v-map') window.PrivacyTalk.close();
    if (id !== 'v-ending' && $('finale')) { clearTimeout(finaleTimer); finaleState = null; $('finale').hidden = true; }
    $('stage').hidden = STAGE_VIEWS.indexOf(id) < 0;
    VIEWS.forEach(function (v) { $(v).hidden = v !== id; });
    current = id;
    document.body.setAttribute('data-view', id);
    window.scrollTo(0, 0);
    var f = focusEl || $(id).querySelector('h1');
    if (f) { if (!f.hasAttribute('tabindex') && f.tagName === 'H1') f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); }
  }

  function applySettings() {
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  }

  /* ── 아바타 ───────────────────────── */
  function playerAvatarSrc() {
    var map = CFG.characterImages || {};
    return (player.character && map[player.character]) || CFG.defaultAvatar;
  }
  function isOfficialAvatar() { return !!(player.character && (CFG.characterImages || {})[player.character]); }

  /* ── 시작 화면 ───────────────────── */
  // 맵 주인공 모습: 공통 캐릭터 코드에 매핑이 있으면 그것, 없으면 학생이 고른 것(이 게임 설정에만 저장)
  function commonLook() { var m = CFG.playerLooks || {}; return player.character && (m[player.character] === 'm' || m[player.character] === 'f') ? m[player.character] : null; }
  function playerLook() { return commonLook() || settings.look; }
  // 시작 화면의 두 주인공 카드. 공통 캐릭터로 모습이 정해져 있으면 그 주인공만 보여 주고 고르기는 막는다
  function renderLookPick() {
    var fixed = commonLook();
    Array.prototype.forEach.call(document.querySelectorAll('#look-pick .hero-card'), function (card) {
      var r = card.querySelector('input');
      card.hidden = !!fixed && r.value !== fixed;
      r.disabled = !!fixed;
      r.checked = r.value === (fixed || settings.look);
    });
    $('look-pick').classList.toggle('fixed', !!fixed);
    $('look-msg').hidden = true;
  }
  function needLook() {
    if (playerLook()) return false;
    $('look-msg').hidden = false;
    var first = document.querySelector('input[name=look]');
    if (first) first.focus();
    return true;
  }

  function renderStart() {
    renderLookPick();
    $('player-name').textContent = player.nickname;
    $('player-name').title = player.nickname;
    var img = $('player-avatar');
    img.src = playerAvatarSrc();
    img.alt = isOfficialAvatar() ? '내 캐릭터' : '임시 아바타';
    var note = $('player-note');
    if (player.source === 'damaged') { note.hidden = false; note.textContent = '공통 캐릭터 정보를 읽지 못해 기본 아바타와 ‘' + CFG.defaultNickname + '’로 시작해요.'; }
    else if (player.source === 'default') { note.hidden = false; note.textContent = '공통 캐릭터 정보가 없어 기본 아바타로 시작해요.'; }
    else note.hidden = true;

    var run = progress.run;
    var resumable = run && run.screen !== 'ending';
    $('btn-continue').hidden = !resumable;
    $('btn-new').textContent = resumable ? '처음부터 시작' : '시작하기';
    $('btn-new').className = resumable ? 'btn' : 'btn primary';

    var result = S.readResult();
    var lr = $('last-result');
    if (result) {
      var end = story.endings.filter(function (e) { return e.code === result.ending; })[0];
      lr.hidden = false;
      lr.textContent = '최근 완료: 엔딩 ' + result.ending + (end ? ' · ' + end.title : '');
    } else lr.hidden = true;
    var hasFinished = !!(run && run.screen === 'ending');
    $('start-links').hidden = !(hasFinished || result);
    $('btn-start-path').hidden = !hasFinished;
    show('v-start', null);
  }

  /* ── 본편 ─────────────────────────── */
  function chapterLabel(n) {
    if (n === 0) return '프롤로그';
    if (n === 4) return '에필로그';
    return n + '장 · ' + story.chapters[n].title;
  }

  function preChoiceState(run) {
    // 반응 표시 중이면, 장면 대사는 선택 전 상태로 판정한다
    return run.reaction && run.history.length ? run.history[run.history.length - 1].snap : run;
  }

  function lineNode(line) {
    var who = line.who || 'narr';
    var li;
    if (line.kind === 'image') {
      li = el('li', 'ln media');
      var box = el('div', 'media-box');
      box.appendChild(el('span', 'media-icon', '🖼'));
      box.lastChild.setAttribute('aria-hidden', 'true');
      box.appendChild(el('span', null, fill(line.text)));
      li.appendChild(box);
      return li;
    }
    if (line.kind === 'setting') {
      li = el('li', 'ln setting-row');
      li.appendChild(el('span', 'set-name', fill(line.text)));
      if (line.meta) li.appendChild(el('span', 'set-meta', fill(line.meta)));
      return li;
    }
    if (who === 'sys') { li = el('li', 'ln sys'); li.appendChild(el('span', null, fill(line.text))); return li; }
    if (who === 'narr') { li = el('li', 'ln narr', fill(line.text)); return li; }

    var ch = story.characters[who] || { name: who, initial: '?' };
    var isMe = who === 'me';
    li = el('li', 'ln msg' + (isMe ? ' me' : '') + (line.kind === 'post' ? ' post' : '') + (who === 'lumi' ? ' ai' : ''));
    if (!isMe) {
      var av = el('span', 'av', ch.initial);
      av.setAttribute('aria-hidden', 'true');
      li.appendChild(av);
    }
    var body = el('div', 'msg-body');
    var name = el('span', 'who', isMe ? player.nickname + ' (나)' : ch.name);
    body.appendChild(name);
    var bubble = el('div', 'bubble');
    bubble.appendChild(el('p', null, fill(line.text)));
    if (line.meta) bubble.appendChild(el('span', 'post-meta', fill(line.meta)));
    body.appendChild(bubble);
    li.appendChild(body);
    return li;
  }

  function stopReveal() {
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = null;
    revealQueue = [];
    revealDone = null;
  }
  function flushReveal() {
    if (!revealDone) return;
    var log = $('g-log');
    revealQueue.forEach(function (n) { n.classList.remove('enter'); log.appendChild(n); stageBubble(n._line); });
    revealQueue = [];
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = null;
    var done = revealDone; revealDone = null;
    scrollLog(true);
    done();
  }
  function reveal(nodes, animate, done) {
    stopReveal();
    var log = $('g-log');
    var ms = SPEED_MS[settings.speed];
    if (!animate || ms === 0 || !nodes.length) {
      nodes.forEach(function (n) { log.appendChild(n); stageBubble(n._line); });
      scrollLog(true);
      done();
      return;
    }
    revealQueue = nodes.slice();
    revealDone = done;
    $('g-dock').textContent = '';
    var skip = el('button', 'btn ghost skip-btn', '모두 보기 ▸▸');
    skip.type = 'button';
    skip.addEventListener('click', flushReveal);
    $('g-dock').appendChild(skip);
    (function step() {
      var n = revealQueue.shift();
      if (!settings.reduceMotion) n.classList.add('enter');
      log.appendChild(n);
      stageBubble(n._line);
      scrollLog(false);
      if (!revealQueue.length) {
        revealTimer = null;
        var d = revealDone; revealDone = null;
        d();
        return;
      }
      revealTimer = setTimeout(step, ms);
    })();
  }
  function scrollLog(instant) {
    var phone = $('g-phone');
    phone.scrollTop = phone.scrollHeight;
    var dock = $('g-dock');
    if (dock && dock.getBoundingClientRect().bottom > window.innerHeight) {
      dock.scrollIntoView({ block: 'end', behavior: instant || settings.reduceMotion ? 'auto' : 'smooth' });
    }
  }

  function deviceOf(sceneId) {
    var st = WD.STAGES[sceneId], v = story.scenes[sceneId].view || { type: 'place' };
    return (st && st.device) || DEVICE[v.type] || 'phone';
  }
  // 장면 중 주인공이 보일 자리: 넓은 화면은 폰 왼쪽 빈 곳, 좁은 화면은 위쪽 맵 자리
  function stageFocus(device) {
    if (device === 'none') return { x: 0.5, y: 0.36 };
    return $('stage').clientWidth <= 720 ? { x: 0.5, y: 0.17 } : { x: 0.7, y: 0.36 }; // 넓은 화면: 폰(왼쪽) 오른쪽 빈 곳
  }
  /* ── 수신음: 메시지 하나당 짧은 '띠링' 한 번(파일 없이 합성). 기본 꺼짐 ── */
  var audioCtx = null, lastChime = 0;
  function chime(force) {
    if (!settings.sound) return;
    var now = Date.now();
    if (!force && now - lastChime < 150) return; // 여러 줄이 한꺼번에 와도 겹치지 않게
    lastChime = now;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = audioCtx || new AC();
      if (audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume();
      var t = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.setValueAtTime(1320, t + 0.07);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(t); osc.stop(t + 0.24);
    } catch (e) { /* 소리를 못 내는 환경이면 조용히 넘어간다 */ }
  }
  function nodeOf(line) { var n = lineNode(line); n._line = line; return n; }
  // 줄이 나타날 때: 같은 공간 친구 머리 위 말풍선(폰 메시지는 원문 대신 📱…) + 장면에 적어 둔 반응
  function stageBubble(line) {
    if (!line || !progress.run) return;
    var st = WD.STAGES[progress.run.scene];
    if (!st) return;
    var who = line.who, text = fill(line.text || '');
    if (who && who !== 'narr' && who !== 'sys' && who !== 'me') {
      window.PrivacyMap.bubble(who, spokenDevice ? text : '📱…', !spokenDevice);
      if (!line.talk) chime();
    }
    (st.bubbles || []).forEach(function (b) { if (text.indexOf(b.on) >= 0) window.PrivacyMap.bubble(b.who, b.text); });
  }
  // 그 자리 대화(장소 장면)는 포켓몬식 대화창으로 한 줄씩
  function talkLines(list) {
    var items = list.filter(function (l) { return l.who !== 'sys' && !l.kind; }).map(function (l) {
      var who = l.who || 'narr';
      if (who === 'narr') return { who: null, name: null, text: fill(l.text), line: l };
      var ch = story.characters[who] || { name: who };
      return { who: who, name: who === 'me' ? player.nickname + ' (나)' : ch.name, text: fill(l.text), line: l };
    });
    return window.PrivacyTalk.open(items, { instant: settings.speed === 'instant', onLine: function (it) { stageBubble(Object.assign({ talk: true }, it.line)); } });
  }
  function reactionLines(run, scene) {
    var c = (scene.choices || []).filter(function (x) { return x.id === run.reaction; })[0];
    if (!c) return [];
    return (c.say ? [{ who: 'me', text: c.say }] : []).concat(E.visibleLines(story, c.react, run));
  }

  function renderGame(animate) {
    var run = progress.run;
    var scene = story.scenes[run.scene];
    $('g-chap').textContent = chapterLabel(scene.chapter);
    $('btn-undo').disabled = !run.history.length;
    window.PrivacyTalk.close(); // 앞 장면 대화창이 남아 선택지를 가리지 않게
    var device = deviceOf(run.scene);
    spokenDevice = device !== 'phone';
    $('v-game').setAttribute('data-device', device);
    $('g-phone').setAttribute('data-device', device);
    $('g-phone').hidden = device === 'none';
    $('stage').classList.toggle('dim', device !== 'none');

    var head = $('g-head');
    head.textContent = '';
    var v = scene.view || { type: 'place', title: '' };
    $('g-phone').setAttribute('data-type', v.type);
    var ic = el('span', 'head-icon', VIEW_ICON[v.type] || '');
    ic.setAttribute('aria-hidden', 'true');
    head.appendChild(ic);
    var ht = el('div', 'head-text');
    ht.appendChild(el('span', 'head-kind', VIEW_KIND[v.type] || ''));
    ht.appendChild(el('strong', 'head-title', fill(v.title || '')));
    head.appendChild(ht);
    if (v.meta) head.appendChild(el('span', 'head-meta', v.meta));

    $('g-log').textContent = '';
    $('g-dock').textContent = '';
    if (current !== 'v-game') show('v-game', $('g-chap'));
    // 무대: 장면이 바뀌면 그 장소로(처음 들어갈 때만 컷 카드)
    var token = ++stageToken;
    var st = WD.STAGES[run.scene] || { place: 'classroom', tint: 'day', cast: [] };
    var ready = Promise.resolve();
    if (stagedScene !== run.scene) {
      stagedScene = run.scene;
      cutPending = true;
      ready = window.PrivacyMap.stage(st, { card: animate && st.card ? st.card : null, focus: function () { return stageFocus(device); } });
    }
    ready.then(function () {
      cutPending = false;
      if (token !== stageToken) return;
      var pre = preChoiceState(run);
      var lines = E.visibleLines(story, scene.lines, pre);
      if (device === 'none') {
        talkLines(run.reaction ? reactionLines(run, scene) : lines).then(function () { if (token === stageToken) renderDock(); });
        return;
      }
      // 반응 표시 중으로 복원된 경우: 장면 대사 + 반응까지 한 번에
      reveal(lines.map(nodeOf).concat(reactionNodes(run, scene)), animate && !run.reaction, renderDock);
    });
  }

  function reactionNodes(run, scene) {
    if (!run.reaction) return [];
    var c = (scene.choices || []).filter(function (x) { return x.id === run.reaction; })[0];
    var out = [];
    var mine = el('li', 'ln choice-echo');
    mine.appendChild(el('span', 'echo-label', '내 선택'));
    mine.appendChild(el('span', null, fill(c.text)));
    out.push(mine);
    if (c.say) out.push(nodeOf({ who: 'me', text: c.say }));
    return out.concat(E.visibleLines(story, c.react, run).map(nodeOf));
  }

  function renderDock() {
    var run = progress.run;
    var scene = story.scenes[run.scene];
    var dock = $('g-dock');
    dock.textContent = '';
    if (E.needsChoice(story, run)) {
      var choices = E.visibleChoices(story, scene, run);
      if (scene.prompt) dock.appendChild(el('p', 'prompt', fill(scene.prompt)));
      var list = el('div', 'choices');
      list.setAttribute('role', 'group');
      list.setAttribute('aria-label', scene.prompt ? fill(scene.prompt) : '선택지');
      choices.forEach(function (c, i) {
        var b = el('button', 'choice');
        b.type = 'button';
        b.setAttribute('data-choice', c.id);
        var num = el('span', 'num', String(i + 1));
        num.setAttribute('aria-hidden', 'true');
        b.appendChild(num);
        b.appendChild(el('span', 'choice-text', fill(c.text)));
        b.addEventListener('click', function () { onChoose(c.id); });
        list.appendChild(b);
      });
      dock.appendChild(list);
      focusFirst(list.querySelector('button'));
    } else {
      var go = el('button', 'btn primary continue', '계속 ▸');
      go.type = 'button';
      go.id = 'btn-next';
      go.addEventListener('click', onContinue);
      dock.appendChild(go);
      focusFirst(go);
    }
    scrollLog(true);
  }
  function focusFirst(b) { if (b) b.focus({ preventScroll: true }); }

  function onChoose(id) {
    var run = progress.run;
    var scene = story.scenes[run.scene];
    var next = E.choose(story, run, id);
    var ex = progress.explored[run.scene] || (progress.explored[run.scene] = []);
    if (ex.indexOf(id) < 0) ex.push(id);
    setRun(next);
    $('btn-undo').disabled = false;
    // 화면은 그대로 두고 선택 반응만 이어서 보여 준다
    $('g-dock').textContent = '';
    if (deviceOf(next.scene) === 'none') {
      var tk = stageToken;
      talkLines(reactionLines(next, scene)).then(function () { if (tk === stageToken) renderDock(); });
      return;
    }
    reveal(reactionNodes(next, scene), true, renderDock);
  }

  function onContinue() {
    var run = progress.run;
    var next = E.advance(story, run);
    setRun(next);
    routeRun(true);
  }

  function routeRun(animate) {
    var run = progress.run;
    if (run.screen === 'scene') renderGame(animate);
    else if (run.screen === 'map') renderMap();
    else if (run.screen === 'chapter') renderChapter();
    else if (run.screen === 'ending') renderEnding(true);
  }

  /* ── 맵 ─────────────────────────── */
  function renderMap() {
    var run = progress.run;
    $('btn-undo').disabled = !run.history.length;
    $('stage').classList.remove('dim');
    window.PrivacyTalk.close();
    stagedScene = null; stageToken++;
    show('v-map', $('hud-mission'));
    window.PrivacyMap.show(run);
  }

  /* ── 장 전환 ───────────────────────── */
  var TRUST_WORD = function (d) { return d > 0 ? '가까워졌다 ↑' : d < 0 ? '멀어졌다 ↓' : '그대로 →'; };

  function statRows(fromStats, toStats, onlyChanged) {
    var dl = el('dl', 'stat-list');
    E.STAT_KEYS.forEach(function (k) {
      var d = (toStats[k] || 0) - (fromStats[k] || 0);
      if (onlyChanged && d === 0) return;
      var row = el('div', 'stat-row');
      row.appendChild(el('dt', null, story.stats[k]));
      row.appendChild(el('dd', null, onlyChanged ? (d > 0 ? '+' + d : String(d)) : String(toStats[k] || 0)));
      dl.appendChild(row);
    });
    if (!dl.children.length) dl.appendChild(el('p', 'mute small', '눈에 띄는 변화는 없었어요.'));
    return dl;
  }
  function trustRows(fromTrust, toTrust) {
    var ul = el('ul', 'trust-list');
    story.trustable.forEach(function (k) {
      var d = (toTrust[k] || 0) - (fromTrust[k] || 0);
      var li = el('li');
      li.setAttribute('data-who', k);
      li.appendChild(el('span', 'trust-name', story.characters[k].name));
      li.appendChild(el('span', 'trust-val' + (d > 0 ? ' up' : d < 0 ? ' down' : ''), TRUST_WORD(d)));
      var mark = el('span', 'trust-mark' + (d > 0 ? ' up' : d < 0 ? ' down' : ''), d > 0 ? '♥' : d < 0 ? '💧' : '–');
      mark.setAttribute('aria-hidden', 'true');
      li.appendChild(mark);
      // 그 친구 얼굴(캐릭터 시트에서 머리만 잘라 2배) — 줄 오른쪽 끝
      li.appendChild(window.PrivacySprite.el(k, { face: true, scale: 2, initial: story.characters[k].initial }));
      ul.appendChild(li);
    });
    return ul;
  }
  function eventBlock(eventId, run) {
    var ev = story.events[eventId];
    var box = el('div', 'event-card');
    var h = el('h3');
    h.appendChild(el('span', 'event-topic', ev.topic));
    h.appendChild(document.createTextNode(ev.title));
    box.appendChild(h);
    var ul = el('ul');
    E.eventOutcomes(story, eventId, run).forEach(function (t) { ul.appendChild(el('li', null, fill(t))); });
    box.appendChild(ul);
    return box;
  }

  function renderChapter() {
    var run = progress.run;
    var n = run.nextChapter, ch = story.chapters[n];
    var prev = run.chapter;
    $('c-eyebrow').textContent = n === 4 ? '마지막' : (n + '장');
    $('c-title').textContent = n === 4 ? '에필로그' : ch.title;
    $('c-sub').textContent = ch.sub;
    var sum = $('c-summary');
    sum.textContent = '';
    if (prev >= 1 && story.chapters[prev]) {
      sum.appendChild(el('h2', null, chapterLabel(prev) + ' — 지금까지 생긴 변화'));
      story.chapters[prev].events.forEach(function (e) { sum.appendChild(eventBlock(e, run)); });
      var mark = run.chapterMarks[prev] || { stats: {}, trust: {} };
      var grid = el('div', 'change-grid');
      var a = el('div');
      a.appendChild(el('h3', null, '이번 장의 흐름'));
      a.appendChild(statRows(mark.stats, run.stats, true));
      var b = el('div');
      b.appendChild(el('h3', null, '친구들과의 사이'));
      b.appendChild(trustRows(mark.trust, run.trust));
      grid.appendChild(a); grid.appendChild(b);
      sum.appendChild(grid);
    } else {
      sum.appendChild(el('p', 'lead-sub', '학급 축제 ‘레트로 사진관’을 준비하는 나흘. 단톡방, SNS, AI 도우미, 공용 컴퓨터에서 여러 번 선택하게 돼요. 지나간 선택은 뒤에서 다시 돌아와요.'));
    }
    $('btn-chapter-go').textContent = n === 4 ? '에필로그 보기' : n + '장 시작';
    show('v-chapter');
    // 장 카드 뒤로 직전 장면의 무대를 어둡게 깐다
    $('stage').classList.add('dim');
    if (stagedScene !== run.scene) { stagedScene = run.scene; window.PrivacyMap.stage(WD.STAGES[run.scene] || { place: 'classroom', tint: 'day', cast: [] }); }
  }

  /* ── 엔딩 ─────────────────────────── */
  function endingOf(code) { return story.endings.filter(function (e) { return e.code === code; })[0]; }
  function cardText(end) { return story.title + ' · 엔딩 ' + end.code + ' 「' + end.title + '」 — ' + end.summary; }

  /* ── 엔딩 연출(프로스트펑크식): 검은 화면 → 두 문장 → 9개 사건의 내 선택 → 친구들과의 사이 → 엔딩 이름 ── */
  var finaleTimer = null, finaleState = null;
  function eventDate(eventId) {
    var id = Object.keys(story.scenes).filter(function (k) { return story.scenes[k].event === eventId; })[0];
    var sys = (story.scenes[id].lines || []).map(function (l) { return E.normLine(l, story); }).filter(function (l) { return l.who === 'sys'; })[0];
    return sys ? sys.text.split(' · ')[0] : '';
  }
  function finale(run, end) {
    var box = $('finale');
    if (!box) {
      box = el('div', 'finale');
      box.id = 'finale';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', '게임이 끝났습니다');
      box.tabIndex = -1;
      box.addEventListener('click', function (e) { if (!e.target.closest('button')) finaleAll(); });
      document.body.appendChild(box);
    }
    box.textContent = '';
    box.hidden = false;
    var lines = [];
    var inner = el('div', 'finale-inner');
    function add(node) { node.classList.add('finale-line'); lines.push(node); return node; }
    inner.appendChild(add(el('p', 'finale-title', '게임이 끝났습니다.')));
    inner.appendChild(add(el('p', 'finale-q', '과연 당신의 선택은 어떠했을까요?')));
    var picks = el('ol', 'finale-choices');
    [1, 2, 3].forEach(function (n) {
      story.chapters[n].events.forEach(function (e) {
        var h = run.history.filter(function (x) { return story.scenes[x.scene].event === e; })[0];
        var c = h && (story.scenes[h.scene].choices || []).filter(function (x) { return x.id === h.choice; })[0];
        var li = add(el('li', 'finale-choice'));
        li.appendChild(el('span', 'finale-date', eventDate(e)));
        li.appendChild(el('span', 'finale-ev', story.events[e].title));
        li.appendChild(el('span', 'finale-pick', c ? fill(c.text) : '—'));
        picks.appendChild(li);
      });
    });
    inner.appendChild(picks);
    inner.appendChild(add(el('p', 'finale-sub', '친구들과의 사이')));
    var bonds = el('ul', 'finale-bonds');
    story.trustable.forEach(function (k) {
      var d = (run.trust[k] || 0) - ((run.chapterMarks[0] && run.chapterMarks[0].trust[k]) || 0);
      var li = add(el('li', 'finale-bond'));
      li.setAttribute('data-who', k);
      li.appendChild(window.PrivacySprite.el(k, { face: true, scale: 2, initial: story.characters[k].initial }));
      li.appendChild(el('span', 'finale-name', story.characters[k].name));
      li.appendChild(el('span', 'finale-word' + (d > 0 ? ' up' : d < 0 ? ' down' : ''), d > 0 ? '친해짐' : d < 0 ? '멀어짐' : '그대로'));
      bonds.appendChild(li);
    });
    inner.appendChild(bonds);
    inner.appendChild(add(el('p', 'finale-end', '엔딩 ' + end.code + ' · ' + end.title)));
    var actions = add(el('div', 'finale-actions'));
    var go = el('button', 'btn primary', '결과 보기');
    go.id = 'finale-go';
    go.type = 'button';
    go.addEventListener('click', finaleClose);
    actions.appendChild(go);
    inner.appendChild(actions);
    var skip = el('button', 'finale-skip', '건너뛰기');
    skip.type = 'button';
    skip.addEventListener('click', finaleClose);
    box.appendChild(skip);
    box.appendChild(inner);
    finaleState = { lines: lines, go: go };
    clearTimeout(finaleTimer);
    if (settings.speed === 'instant' || settings.reduceMotion) { finaleAll(); return; }
    box.focus({ preventScroll: true });
    // 화면이 검게 꺼지는 동안 잠깐 멈췄다가, 두 문장은 천천히, 나머지는 한 줄씩
    var i = 0, step = settings.speed === 'fast' ? 350 : 750;
    (function next() {
      if (!finaleState) return;
      if (i >= lines.length) { go.focus({ preventScroll: true }); return; }
      lines[i].classList.add('on');
      if (i >= 2) lines[i].scrollIntoView({ block: 'nearest' });
      i++;
      finaleTimer = setTimeout(next, i <= 2 ? 1500 : step);
    })();
  }
  function finaleAll() {
    clearTimeout(finaleTimer);
    if (!finaleState) return;
    finaleState.lines.forEach(function (n) { n.classList.add('on'); });
    finaleState.go.focus({ preventScroll: true });
  }
  function finaleClose() {
    clearTimeout(finaleTimer);
    finaleState = null;
    var b = $('finale');
    if (b) b.hidden = true;
    var t = $('e-title');
    if (t && current === 'v-ending') { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }

  function renderEnding(justArrived) {
    var run = progress.run;
    var end = endingOf(run.ending);
    if (justArrived) {
      S.saveResult(end.code, cardText(end));
      if (progress.endingsSeen.indexOf(end.code) < 0) progress.endingsSeen.push(end.code);
      saveProgress();
    }
    $('e-eyebrow').textContent = '엔딩 ' + end.code;
    $('e-title').textContent = end.title;
    $('e-summary').textContent = end.summary;
    var body = $('e-body'); body.textContent = '';
    end.body.forEach(function (p) { body.appendChild(el('p', null, fill(p))); });

    var evs = $('e-events'); evs.textContent = '';
    [1, 2, 3].forEach(function (n) {
      var sec = el('div', 'chapter-group');
      sec.appendChild(el('p', 'group-label', chapterLabel(n)));
      story.chapters[n].events.forEach(function (e) { sec.appendChild(eventBlock(e, run)); });
      evs.appendChild(sec);
    });
    var st = $('e-stats'); st.textContent = '';
    var grid = el('div', 'change-grid');
    var a = el('div');
    a.appendChild(el('h3', null, '선택이 남긴 흔적'));
    a.appendChild(statRows({}, run.stats, false));
    var b = el('div');
    b.appendChild(el('h3', null, '친구들과의 사이 (처음과 비교)'));
    b.appendChild(trustRows(run.chapterMarks[0].trust, run.trust));
    grid.appendChild(a); grid.appendChild(b);
    st.appendChild(grid);
    show('v-ending');
    if (justArrived) finale(run, end);
  }

  /* ── 선택 경로 ─────────────────────── */
  function renderPath(back) {
    pathBack = back || pathBack;
    var run = progress.run;
    var list = $('p-list'); list.textContent = '';
    var endBox = $('p-endings'); endBox.textContent = '';

    var eh = el('div', 'endings-seen');
    eh.appendChild(el('h2', null, '엔딩 ' + progress.endingsSeen.length + ' / ' + story.endings.length));
    var eul = el('ul', 'ending-chips');
    story.endings.forEach(function (e) {
      var seen = progress.endingsSeen.indexOf(e.code) >= 0;
      var li = el('li', seen ? 'seen' : 'unseen');
      li.appendChild(el('span', 'chip-code', e.code));
      li.appendChild(el('span', null, seen ? e.title : '아직 보지 못한 엔딩'));
      if (run && run.ending === e.code) li.appendChild(el('span', 'chip-now', '이번 엔딩'));
      eul.appendChild(li);
    });
    eh.appendChild(eul);
    endBox.appendChild(eh);

    if (!run) { list.appendChild(el('p', 'mute', '아직 기록된 선택이 없어요.')); show('v-path'); return; }
    var visited = {};
    run.visited.forEach(function (s) { visited[s] = true; });

    var groups = [{ key: null, title: '프롤로그' }];
    [1, 2, 3].forEach(function (n) {
      story.chapters[n].events.forEach(function (e) { groups.push({ key: e, title: n + '장 · ' + story.events[e].title, topic: story.events[e].topic }); });
    });
    groups.forEach(function (g) {
      var entries = run.history.filter(function (h) { return story.scenes[h.scene].event === g.key; });
      var sec = el('section', 'path-group');
      var h2 = el('h2', null, g.title);
      if (g.topic) { h2.appendChild(el('span', 'event-topic', g.topic)); }
      sec.appendChild(h2);
      entries.forEach(function (h) {
        var sc = story.scenes[h.scene];
        var card = el('div', 'path-step');
        card.appendChild(el('p', 'path-q', sc.label + (sc.prompt ? ' — ' + fill(sc.prompt) : '')));
        var ul = el('ul', 'path-opts');
        E.visibleChoices(story, sc, h.snap).forEach(function (c) {
          var mine = c.id === h.choice;
          var li = el('li', mine ? 'mine' : 'other');
          li.appendChild(el('span', 'opt-mark', mine ? '✓ 내 선택' : '다른 선택'));
          li.appendChild(el('span', 'opt-text', fill(c.text)));
          var ex = progress.explored[h.scene] || [];
          if (!mine && ex.indexOf(c.id) >= 0) li.appendChild(el('span', 'opt-note', '이전 플레이에서 고른 적 있음'));
          ul.appendChild(li);
        });
        card.appendChild(ul);
        sec.appendChild(card);
      });
      if (g.key) {
        var missed = Object.keys(story.scenes).filter(function (id) { return story.scenes[id].event === g.key && !visited[id]; });
        if (missed.length) {
          var m = el('p', 'path-missed');
          m.appendChild(el('span', 'opt-mark', '이번에 지나지 않은 장면'));
          m.appendChild(document.createTextNode(missed.map(function (id) { return story.scenes[id].label; }).join(' · ')));
          sec.appendChild(m);
        }
      }
      list.appendChild(sec);
    });
    show('v-path');
  }

  /* ── 성찰 ─────────────────────────── */
  function renderReflect(back) {
    reflectBack = back || reflectBack;
    $('r-core').textContent = story.reflection.core;
    var b = $('r-basic'), d = $('r-deep');
    b.textContent = ''; d.textContent = '';
    story.reflection.basic.forEach(function (q) { b.appendChild(el('li', null, q)); });
    story.reflection.deep.forEach(function (q) { d.appendChild(el('li', null, q)); });
    show('v-reflect');
  }

  /* ── 메뉴·확인 창 ─────────────────── */
  var lastFocus = null;
  function openOverlay(id) {
    lastFocus = document.activeElement;
    $(id).hidden = false;
    var f = $(id).querySelector('input:checked, button, input');
    if (f) f.focus();
  }
  function closeOverlay(id) {
    $(id).hidden = true;
    if (lastFocus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  var confirmCb = null;
  function ask(title, text, yesLabel, cb) {
    $('confirm-title').textContent = title;
    $('confirm-text').textContent = text;
    $('confirm-yes').textContent = yesLabel || '확인';
    confirmCb = cb;
    openOverlay('confirm');
    $('confirm-no').focus();
  }
  function trapFocus(e, id) {
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call($(id).querySelectorAll('button, input'), function (n) { return !n.disabled; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function syncMenu() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name=speed]'), function (r) { r.checked = r.value === settings.speed; });
    $('opt-motion').checked = settings.reduceMotion;
    $('opt-sound').checked = settings.sound;
  }

  function startNew() {
    stopReveal();
    progress.pos = null;
    setRun(E.createState(story));
    routeRun(true);
  }

  /* ── 이벤트 연결 ─────────────────── */
  function bind() {
    Array.prototype.forEach.call(document.querySelectorAll('input[name=look]'), function (r) {
      r.addEventListener('change', function () { settings.look = r.value; $('look-msg').hidden = true; saveSettings(); });
    });
    $('btn-new').addEventListener('click', function () {
      if (needLook()) return;
      if (progress.run && progress.run.screen !== 'ending') {
        ask('처음부터 시작할까요?', '지금까지의 진행은 지워져요. 완료한 결과와 지난 선택 기록은 남아요.', '처음부터', startNew);
      } else startNew();
    });
    $('btn-continue').addEventListener('click', function () { if (needLook()) return; routeRun(false); });
    $('btn-start-path').addEventListener('click', function () { renderPath('v-start'); });
    $('btn-start-reflect').addEventListener('click', function () { renderReflect('v-start'); });
    $('btn-chapter-go').addEventListener('click', function () { setRun(E.advance(story, progress.run)); routeRun(true); });
    $('btn-end-path').addEventListener('click', function () { renderPath('v-ending'); });
    $('btn-end-reflect').addEventListener('click', function () { renderReflect('v-ending'); });
    $('btn-end-replay').addEventListener('click', startNew);
    $('btn-path-reflect').addEventListener('click', function () { renderReflect('v-path'); });
    $('btn-path-back').addEventListener('click', function () { goTo(pathBack); });
    $('btn-reflect-back').addEventListener('click', function () { goTo(reflectBack); });
    $('btn-reflect-home').addEventListener('click', renderStart);

    $('btn-undo').addEventListener('click', function () {
      var run = progress.run;
      if (!run || !run.history.length) return;
      var last = run.history[run.history.length - 1];
      var c = (story.scenes[last.scene].choices || []).filter(function (x) { return x.id === last.choice; })[0];
      ask('이전 선택으로 돌아갈까요?', '“' + fill(c.text) + '”를 고르기 직전으로 돌아가요. 그 뒤의 진행은 지워져요.', '돌아가기', function () {
        stopReveal();
        setRun(E.undo(progress.run));
        routeRun(false);
      });
    });

    $('btn-menu').addEventListener('click', function () { syncMenu(); openOverlay('menu'); });
    $('btn-menu-close').addEventListener('click', function () { closeOverlay('menu'); });
    Array.prototype.forEach.call(document.querySelectorAll('input[name=speed]'), function (r) {
      r.addEventListener('change', function () { settings.speed = r.value; saveSettings(); });
    });
    $('opt-motion').addEventListener('change', function () { settings.reduceMotion = $('opt-motion').checked; applySettings(); saveSettings(); });
    $('opt-sound').addEventListener('change', function () { settings.sound = $('opt-sound').checked; saveSettings(); if (settings.sound) chime(true); });
    $('btn-menu-home').addEventListener('click', function () { $('menu').hidden = true; renderStart(); });
    $('btn-menu-restart').addEventListener('click', function () {
      $('menu').hidden = true;
      ask('처음부터 다시 할까요?', '지금까지의 진행은 지워져요. 완료한 결과와 지난 선택 기록은 남아요.', '처음부터', startNew);
    });
    $('btn-menu-wipe').addEventListener('click', function () {
      $('menu').hidden = true;
      ask('이 게임 기록을 모두 지울까요?', '‘공유한 순간’의 진행, 지난 선택 기록, 완료 결과가 지워져요. 공통 캐릭터와 다른 게임 기록은 지우지 않아요.', '지우기', function () {
        S.remove(S.KEYS.progress);
        S.remove(S.KEYS.result);
        progress = { v: 1, run: null, explored: {}, endingsSeen: [], pos: null };
        renderStart();
      });
    });
    $('confirm-no').addEventListener('click', function () { confirmCb = null; closeOverlay('confirm'); });
    $('confirm-yes').addEventListener('click', function () { var cb = confirmCb; confirmCb = null; $('confirm').hidden = true; if (cb) cb(); });

    document.addEventListener('keydown', function (e) {
      var fin = $('finale');
      if (fin && !fin.hidden) {
        if (e.key === 'Escape') finaleClose();
        else if ((e.key === 'Enter' || e.key === ' ') && (e.target.tagName || '') !== 'BUTTON') { e.preventDefault(); finaleAll(); }
        return;
      }
      if (!$('confirm').hidden) { if (e.key === 'Escape') { confirmCb = null; closeOverlay('confirm'); } trapFocus(e, 'confirm'); return; }
      if (!$('menu').hidden) { if (e.key === 'Escape') closeOverlay('menu'); trapFocus(e, 'menu'); return; }
      if (current !== 'v-game' || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = (e.target && e.target.tagName) || '';
      if (revealDone && (e.key === 'Enter' || e.key === ' ') && tag !== 'BUTTON') { e.preventDefault(); flushReveal(); return; }
      if (/^[1-9]$/.test(e.key)) {
        var b = $('g-dock').querySelectorAll('.choice')[Number(e.key) - 1];
        if (b) { e.preventDefault(); b.click(); }
      }
    });
    $('g-log').addEventListener('click', function () { if (revealDone) flushReveal(); });
  }
  function goTo(view) {
    if (view === 'v-ending' && progress.run && progress.run.screen === 'ending') renderEnding(false);
    else if (view === 'v-path') renderPath();
    else renderStart();
  }

  /* ── 시작 ─────────────────────────── */
  loadAll();
  applySettings();
  bind();
  window.PrivacyMap.init({
    story: story,
    fill: fill,
    playerName: function () { return player.nickname; },
    playerLook: function () { return playerLook() || 'm'; },
    evalCond: function (c) { return E.evalCond(c, progress.run); },
    instant: function () { return settings.speed === 'instant'; },
    reduceMotion: function () { return settings.reduceMotion; },
    loadPos: function () { return progress.pos; },
    savePos: function (p) { progress.pos = p; clearTimeout(posTimer); posTimer = setTimeout(saveProgress, 400); },
    onEnter: function () { clearTimeout(posTimer); setRun(E.advance(story, progress.run)); routeRun(true); }
  });
  renderStart();
  if (noticeMsgs.length) showNotice(noticeMsgs.join(' '));

  // 검증용 읽기 전용 창구(게임 동작에는 쓰지 않음)
  window.PrivacyApp = {
    state: function () { return progress.run ? E.clone(progress.run) : null; },
    player: function () { return E.clone(player); },
    setSpeed: function (s) { if (SPEED_MS.hasOwnProperty(s)) settings.speed = s; },
    staging: function () { return cutPending; }
  };
})();
