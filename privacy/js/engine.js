/*
 * 상태 엔진 — 화면(DOM)을 모르는 순수 로직. 브라우저와 Node(검증 스크립트) 양쪽에서 쓴다.
 * 상태는 JSON으로 그대로 저장·복원할 수 있는 평범한 객체다.
 */
(function (root) {
  'use strict';

  var STAT_KEYS = ['spread', 'consent', 'minimize', 'repair', 'help', 'serious'];
  var TRUST_MIN = -3, TRUST_MAX = 3;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ── 조건 ───────────────────────── */
  function getVal(state, key) {
    if (key.indexOf('+') >= 0) {
      return key.split('+').reduce(function (s, k) { return s + Number(getVal(state, k.trim()) || 0); }, 0);
    }
    if (key.indexOf('trust.') === 0) return state.trust[key.slice(6)] || 0;
    if (STAT_KEYS.indexOf(key) >= 0) return state.stats[key] || 0;
    return state.flags[key];
  }

  function evalOne(cond, state) {
    cond = cond.trim();
    if (cond.charAt(0) === '!' && cond.charAt(1) !== '=') return !getVal(state, cond.slice(1).trim());
    var m = cond.match(/^([\w.+]+)\s*(>=|<=|!=|=|>|<)\s*(.+)$/);
    if (!m) return !!getVal(state, cond);
    var v = getVal(state, m[1]), op = m[2], rhs = m[3].trim();
    if (op === '=' || op === '!=') {
      var hit = rhs.split('|').indexOf(String(v)) >= 0;
      return op === '=' ? hit : !hit;
    }
    var x = Number(v || 0), n = Number(rhs);
    if (op === '>=') return x >= n;
    if (op === '<=') return x <= n;
    if (op === '>') return x > n;
    return x < n;
  }

  function evalCond(cond, state) {
    if (cond == null || cond === '') return true;
    if (Array.isArray(cond)) return cond.every(function (c) { return evalCond(c, state); });
    if (cond.indexOf('||') >= 0) return cond.split('||').some(function (c) { return evalCond(c, state); });
    if (cond.indexOf('&&') >= 0) return cond.split('&&').every(function (c) { return evalOne(c, state); });
    return evalOne(cond, state);
  }

  /* ── 대사 ───────────────────────── */
  function normLine(line, story) {
    if (typeof line !== 'string') return line;
    var i = line.indexOf(': ');
    if (i > 0) {
      var who = line.slice(0, i);
      if (who === 'narr' || who === 'sys' || story.characters[who]) return { who: who, text: line.slice(i + 2) };
    }
    return { who: 'narr', text: line };
  }
  function visibleLines(story, lines, state) {
    return (lines || []).map(function (l) { return normLine(l, story); })
      .filter(function (l) { return evalCond(l.if, state); });
  }
  function visibleChoices(story, scene, state) {
    return (scene.choices || []).filter(function (c) { return evalCond(c.if, state); });
  }

  /* ── 상태 ───────────────────────── */
  function emptyStats() { var s = {}; STAT_KEYS.forEach(function (k) { s[k] = 0; }); return s; }

  function createState(story) {
    var trust = {};
    story.trustable.forEach(function (k) { trust[k] = 0; });
    return {
      v: 1,
      screen: 'scene',          // scene | chapter | ending
      scene: story.start,
      chapter: 0,
      nextChapter: null,
      reaction: null,           // 방금 고른 선택지 id (반응 표시 중)
      stats: emptyStats(),
      trust: trust,
      flags: {},
      visited: [story.start],
      history: [],              // [{ scene, choice, snap }]
      chapterMarks: { 0: { stats: emptyStats(), trust: clone(trust) } },
      ending: null
    };
  }

  function snapshot(state) {
    var s = clone(state);
    delete s.history;
    return s;
  }

  function applyEffects(state, choice) {
    var set = choice.set || {}, add = choice.add || {};
    Object.keys(set).forEach(function (k) { state.flags[k] = set[k]; });
    Object.keys(add).forEach(function (k) {
      if (k.indexOf('trust.') === 0) {
        var who = k.slice(6);
        var v = (state.trust[who] || 0) + add[k];
        state.trust[who] = Math.max(TRUST_MIN, Math.min(TRUST_MAX, v));
      } else {
        state.stats[k] = Math.max(0, (state.stats[k] || 0) + add[k]);
      }
    });
  }

  function choose(story, state, choiceId) {
    if (state.screen !== 'scene' || state.reaction) throw new Error('지금은 선택할 수 없음');
    var scene = story.scenes[state.scene];
    var choice = visibleChoices(story, scene, state).filter(function (c) { return c.id === choiceId; })[0];
    if (!choice) throw new Error('없는 선택지: ' + state.scene + '#' + choiceId);
    var next = clone(state);
    next.history.push({ scene: state.scene, choice: choiceId, snap: snapshot(state) });
    applyEffects(next, choice);
    next.reaction = choiceId;
    return next;
  }

  function resolveNext(target, state) {
    if (!Array.isArray(target)) return target;
    for (var i = 0; i < target.length; i++) if (evalCond(target[i].if, state)) return target[i].to;
    return null;
  }

  /* 현재 장면에서 '계속'을 눌렀을 때의 목적지 */
  function pendingNext(story, state) {
    var scene = story.scenes[state.scene];
    if (state.reaction) {
      var ch = (scene.choices || []).filter(function (c) { return c.id === state.reaction; })[0];
      return resolveNext(ch.next, state);
    }
    return resolveNext(scene.next, state);
  }

  /* 선택지가 남아 있으면 계속할 수 없다 */
  function needsChoice(story, state) {
    if (state.screen !== 'scene' || state.reaction) return false;
    return visibleChoices(story, story.scenes[state.scene], state).length > 0;
  }

  function goTo(story, state, target) {
    var next = clone(state);
    next.reaction = null;
    if (target === '@ending') {
      next.screen = 'ending';
      next.ending = resolveEnding(story, next).code;
    } else if (typeof target === 'string' && target.indexOf('@chapter:') === 0) {
      next.screen = 'chapter';
      next.nextChapter = Number(target.split(':')[1]);
    } else {
      if (!story.scenes[target]) throw new Error('없는 장면: ' + target);
      next.screen = 'scene';
      next.scene = target;
      next.visited.push(target);
    }
    return next;
  }

  function advance(story, state) {
    if (state.screen === 'chapter') {
      var n = state.nextChapter, ch = story.chapters[n];
      var next = clone(state);
      next.screen = 'scene';
      next.chapter = n;
      next.nextChapter = null;
      next.scene = ch.start;
      next.visited.push(ch.start);
      next.chapterMarks[n] = { stats: clone(state.stats), trust: clone(state.trust) };
      return next;
    }
    if (needsChoice(story, state)) throw new Error('선택이 필요함: ' + state.scene);
    return goTo(story, state, pendingNext(story, state));
  }

  /* 마지막 선택 하나를 되돌린다 — 그 뒤 기록은 모두 버린다 */
  function undo(state) {
    if (!state.history.length) return state;
    var hist = state.history.slice(0, -1);
    var restored = clone(state.history[state.history.length - 1].snap);
    restored.history = hist;
    return restored;
  }

  function resolveEnding(story, state) {
    for (var i = 0; i < story.endings.length; i++) {
      if (evalCond(story.endings[i].if, state)) return story.endings[i];
    }
    return story.endings[story.endings.length - 1];
  }

  function eventOutcomes(story, eventId, state) {
    var ev = story.events[eventId];
    return ev.outcomes.filter(function (o) { return evalCond(o.if, state); }).map(function (o) { return o.text; });
  }

  /* 저장된 상태가 현재 스토리와 맞는지 */
  function isValidState(story, s) {
    if (!s || s.v !== 1 || typeof s !== 'object') return false;
    if (!s.stats || !s.trust || !s.flags || !Array.isArray(s.history) || !Array.isArray(s.visited)) return false;
    if (['scene', 'chapter', 'ending'].indexOf(s.screen) < 0) return false;
    if (!story.scenes[s.scene]) return false;
    if (s.screen === 'chapter' && !story.chapters[s.nextChapter]) return false;
    if (s.reaction) {
      var ok = (story.scenes[s.scene].choices || []).some(function (c) { return c.id === s.reaction; });
      if (!ok) return false;
    }
    return s.history.every(function (h) { return h && story.scenes[h.scene] && h.snap; });
  }

  var api = {
    STAT_KEYS: STAT_KEYS,
    evalCond: evalCond,
    normLine: normLine,
    visibleLines: visibleLines,
    visibleChoices: visibleChoices,
    createState: createState,
    choose: choose,
    advance: advance,
    needsChoice: needsChoice,
    pendingNext: pendingNext,
    undo: undo,
    resolveEnding: resolveEnding,
    eventOutcomes: eventOutcomes,
    isValidState: isValidState,
    clone: clone
  };
  root.PrivacyEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
