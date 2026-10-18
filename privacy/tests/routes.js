// 엔딩별 대표 경로 — Node 검증(check-story.mjs)과 브라우저 프로브가 함께 쓴다.
// 각 항목은 '장면#선택지'. 선택이 없는 장면과 장 전환은 자동으로 넘어간다.
(function (root) {
  var ROUTES = {
    A: ['pro_1#photo', 'c1_e1_a#propose', 'c1_e1_b#fix', 'c1_e2_a#ask', 'c1_e2_b#keep', 'c1_e3_b#ask',
        'c2_e4_a#refuse', 'c2_e4_b#ask', 'c2_e5_a#min', 'c2_e5_b#check', 'c2_e6_a#logout',
        'c3_e7_a#stop', 'c3_e8_a#tell', 'c3_e9_a#ask', 'c3_e9_b#calm'],
    B: ['pro_1#sns', 'c1_e1_a#public', 'c1_e1_b#fixboth', 'c1_e2_a#shoot', 'c1_e2_b#group', 'c1_e2_d#all', 'c1_e3_b#anon',
        'c2_e4_a#ignore', 'c2_e4_b#report', 'c2_e5_a#all', 'c2_e5_b#del', 'c2_e6_a#leave',
        'c3_e7_a#warn', 'c3_e7_b#help', 'c3_e8_a#block', 'c3_e9_a#critique', 'c3_e9_b#calm'],
    C: ['pro_1#money', 'c1_e1_a#public', 'c1_e1_b#pass', 'c1_e2_a#shoot', 'c1_e2_b#group', 'c1_e2_d#no',
        'c1_e3_b#capture', 'c1_e3_cap#none',
        'c2_e4_a#ignore', 'c2_e4_b#blame', 'c2_e5_a#seoa', 'c2_e5_b#close', 'c2_e6_a#leave',
        'c3_e7_a#silent', 'c3_e7_b#none', 'c3_e8_a#block', 'c3_e9_a#critique', 'c3_e9_b#step'],
    D: ['pro_1#sns', 'c1_e1_a#dm', 'c1_e1_b#fix', 'c1_e2_a#shoot', 'c1_e2_b#story', 'c1_e2_d#sorry',
        'c1_e3_b#capture', 'c1_e3_cap#part',
        'c2_e4_a#forward', 'c2_e4_b#confess', 'c2_e5_a#all', 'c2_e5_b#del', 'c2_e6_a#peek', 'c2_e6_b#stop',
        'c3_e7_a#join', 'c3_e7_b#del', 'c3_e8_a#meet', 'c3_e8_b#go', 'c3_e9_a#share', 'c3_e9_b#del']
  };
  root.PRIVACY_ROUTES = ROUTES;
  if (typeof module !== 'undefined' && module.exports) module.exports = ROUTES;
})(typeof window !== 'undefined' ? window : globalThis);
