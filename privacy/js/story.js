/*
 * 「공유한 순간」 스토리 데이터
 * ------------------------------------------------------------
 * 대사·선택지를 고치려면 이 파일만 수정하면 된다. (화면·상태 코드는 engine.js / app.js)
 *
 * ▸ 대사(lines) 쓰는 법
 *   "hayun: 안녕"            → 인물 id + ': ' + 대사 (가장 간단한 형태)
 *   "narr: 설명 문장"         → 해설
 *   "sys: D-4 · 저녁 8:12"    → 시스템 알림 칩
 *   { who:'hayun', text:'…', if:'e1=public' }   → 조건이 맞을 때만 표시
 *   { who:'anon', kind:'post', text:'…', meta:'좋아요 41' }  → SNS 게시물 카드
 *   { kind:'image', text:'…' }                   → 이미지 자리(실제 이미지는 보여 주지 않음)
 *   { kind:'setting', text:'대화 기록 저장', meta:'켜짐' } → 설정 화면 한 줄
 *   {name} 은 플레이어 별명으로 바뀐다(텍스트로만 표시).
 *
 * ▸ 선택지(choices)
 *   { id, text, say?, react?, set?, add?, next, if? }
 *   - text  : 버튼 문구(행동·의도가 드러나게)
 *   - say   : 내가 말한 말풍선(선택)
 *   - react : 선택 직후 바로 보이는 반응 대사(대사 규칙 동일, if 가능 — 효과 적용 후 판정)
 *   - set   : 플래그 기록  { e1:'public', school_visible:true }
 *   - add   : 수치 증감    { spread:1, 'trust.hayun':-1 }
 *   - next  : 다음 장면 id. '@chapter:2' = 장 전환 화면, '@ending' = 엔딩 판정
 *            조건 분기는 [{ if:'e7=stop', to:'a' }, { to:'b' }]
 *
 * ▸ 조건(if) 문법
 *   'flag'  '!flag'  'e2post=group|story'  'e3!=capture'  'spread>=2'  'trust.seoa<0'
 *   여러 개: 배열(모두 참) 또는 'a && b', 'a || b'
 *
 * ▸ 추적 수치 (단일 도덕 점수가 아님)
 *   spread  정보가 필요 이상으로 퍼진 정도      consent  당사자의 뜻을 물은 횟수
 *   minimize 필요한 범위만 공유한 행동          repair   지우기·멈추기·사과 같은 수습 행동
 *   help    선생님·보호자·신고 등 도움 연결      serious  현실의 안전이 위협받는 상황
 *   trust.<인물> 인물별 신뢰(-3~3)
 */
(function (root) {
  'use strict';

  var STORY = {
    id: 'privacy',
    title: '공유한 순간',
    version: 1,
    start: 'pro_1',

    characters: {
      me:       { name: '나', initial: '나' },
      hayun:    { name: '하윤', initial: '하', desc: '축제 정산과 역할표를 맡은 반장' },
      dohyun:   { name: '도현', initial: '도', desc: '분위기를 띄우는 장난꾸러기' },
      seoa:     { name: '서아', initial: '서', desc: '꾸미기를 좋아하는 조용한 친구' },
      minjun:   { name: '민준', initial: '민', desc: '말수 적은 소품 담당' },
      teacher:  { name: '담임 선생님', initial: '선' },
      guardian: { name: '보호자', initial: '보' },
      friend:   { name: '옆 반 친구', initial: '옆' },
      lumi:     { name: '루미 (가상 AI)', initial: 'AI' },
      stranger: { name: '@nightfox', initial: '?' },
      anon:     { name: '@byeolbyeol_', initial: '?' }
    },
    trustable: ['hayun', 'dohyun', 'seoa', 'minjun'],

    stats: {
      spread:   '정보가 필요 이상으로 퍼진 정도',
      consent:  '당사자의 뜻을 물어본 횟수',
      minimize: '필요한 범위만 공유한 행동',
      repair:   '지우기·멈추기·사과 같은 수습',
      help:     '선생님·보호자·신고로 도움 연결',
      serious:  '현실의 안전이 위협받은 상황'
    },

    chapters: {
      1: { title: '우리끼리인데 뭐 어때?', sub: '축제 D-4 ~ D-2', events: ['e1', 'e2', 'e3'], start: 'c1_e1_a' },
      2: { title: '화면 밖으로 나간 정보', sub: '축제 D-1 ~ 당일 아침', events: ['e4', 'e5', 'e6'], start: 'c2_e4_a' },
      3: { title: '공유 버튼 뒤의 사람', sub: '축제 당일 ~ 다음 날', events: ['e7', 'e8', 'e9'], start: 'c3_e7_a' },
      4: { title: '에필로그', sub: '축제 다음 주', events: [], start: 'ep_1' }
    },

    /* 사건별 결과 — 엔딩·장 전환 화면에 표시. 조건이 맞는 문장이 모두 나온다. */
    events: {
      e1: { title: '정산 계좌번호', topic: '필요한 공유 범위', outcomes: [
        { if: 'e1=public', text: '내 이름과 계좌번호가 28명 단톡방에 올라갔다.' },
        { if: 'e1=dm', text: '계좌번호는 정산 담당 하윤이에게만 보냈다.' },
        { if: 'e1=propose', text: '반 전체가 계좌는 정산 담당에게만 보내기로 했다.' },
        { if: 'e1b=fix|fixboth', text: '도현이의 전화번호가 단톡방에서 지워졌다.' },
        { if: 'e1b=pass', text: '도현이의 전화번호는 단톡방에 그대로 남았다.' }
      ] },
      e2: { title: '잠든 친구 사진', topic: '촬영 동의와 게시 동의', outcomes: [
        { if: 'e2shot=nocheck', text: '민준이가 자는 모습이 동의 없이 찍혔다.' },
        { if: 'e2shot=asked', text: '민준이는 찍는 건 허락했지만, 올리는 건 허락하지 않았다.' },
        { if: 'e2shot=none', text: '사진은 찍히지 않았다.' },
        { if: 'e2post=ask|keep', text: '사진은 올라가지 않았다.' },
        { if: 'e2post=group', text: '사진이 반 단톡방 28명에게 퍼졌다.' },
        { if: 'e2post=story', text: '사진이 학교 태그와 함께 스토리에 올라가 312회 조회됐다.' },
        { if: 'e2fix=sorry|all', text: '게시물을 지우고 사과했지만, 저장된 사본은 확인할 수 없다.' },
        { if: 'e2fix=no', text: '민준이의 삭제 요청을 넘겼고, 사진은 계속 퍼졌다.' }
      ] },
      e3: { title: '털어놓은 고민', topic: '친밀감과 비밀', outcomes: [
        { if: 'e3=ask', text: '서아가 정한 만큼만 하윤이에게 전했다.' },
        { if: 'e3=anon', text: '서아의 이름과 사정을 빼고 역할 재신청을 제안했다.' },
        { if: 'e3=capture', text: '서아의 대화 캡처가 하윤이에게, 다시 도현이에게 전달됐다.' },
        { if: 'e3fix=full', text: '전달을 멈추게 하고 서아에게 먼저 사실을 말했다.' },
        { if: 'e3fix=part', text: '더 퍼지는 것은 막았지만, 서아는 그 사실을 나중에야 알았다.' },
        { if: 'e3fix=none', text: '서아의 비밀이 교실에 알려졌다.' }
      ] },
      e4: { title: '합성된 셀카', topic: '공개된 정보의 재사용', outcomes: [
        { if: 'e4=forward', text: '합성 이미지를 친구들에게 전달했다.' },
        { if: 'e4=refuse', text: '공개 사진이라도 합성·유포는 안 된다고 말했다.' },
        { if: 'e4=ignore', text: '받은 이미지에 반응하지 않았다.' },
        { if: 'e4b=ask', text: '하윤이의 뜻을 묻고 함께 신고하고 선생님께 알렸다.' },
        { if: 'e4b=report', text: '익명 계정을 신고하고, 받은 사람들에게 지워 달라고 했다.' },
        { if: 'e4b=confess', text: '전달한 사실을 털어놓고 삭제를 요청했지만, 한 곳에는 이미 퍼져 있었다.' },
        { if: 'e4b=blame', text: '하윤이에게 공개로 올린 탓을 했다. 이미지는 계속 돌았다.' }
      ] },
      e5: { title: 'AI 도우미에 붙여 넣기', topic: '정보 최소화', outcomes: [
        { if: 'e5=all', text: '28명의 이름·번호·계좌가 담긴 대화를 통째로 입력했다.' },
        { if: 'e5=seoa', text: '서아가 털어놓은 대화를 서아 모르게 입력했다.' },
        { if: 'e5=min', text: '안내문에 필요한 부스 정보만 입력했다.' },
        { if: 'e5=anon', text: '서아의 이름과 구체적인 사정을 빼고 질문했다.' },
        { if: 'e5fix=del', text: '대화를 지우고 기록 저장 설정을 확인했다.' },
        { if: 'e5fix=check', text: '기록 저장 설정을 확인해 두었다.' }
      ] },
      e6: { title: '로그인된 공용 PC', topic: '접근 가능성 ≠ 사용 권한', outcomes: [
        { if: 'e6=peek', text: '도현이의 DM 목록을 들여다봤다.' },
        { if: 'e6=post', text: '도현이의 계정으로 장난 스토리를 올렸다.' },
        { if: 'e6=logout', text: '아무것도 열지 않고 로그아웃한 뒤 도현이에게 알렸다.' },
        { if: 'e6=leave', text: '그냥 떠났고, 다음 사람이 도현이 계정에 장난을 쳤다.' },
        { if: 'e6b=stop', text: '더 보지 않고 로그아웃했다.' },
        { if: 'e6b=cap', text: '도현이의 DM을 캡처해 다른 사람에게 보냈다.' },
        { if: 'e6b=own', text: '내가 올렸다고 밝히고 스토리를 지웠다.' },
        { if: 'e6b=deny', text: '누가 올렸는지 모른 척했다.' }
      ] },
      e7: { title: '무료나눔 번호 장난', topic: '낯선 사람과 정보 전달', outcomes: [
        { if: 'e7=join', text: '민준이의 번호를 낯선 사람들이 보는 곳에 올리는 데 함께했다.' },
        { if: 'e7=stop&&e7done', text: '말렸지만 장난은 작게나마 일어났다.' },
        { if: 'e7=stop&&!e7done', text: '장난을 멈추게 했다. 민준이의 번호는 퍼지지 않았다.' },
        { if: 'e7=warn', text: '민준이에게 미리 알려 차단을 도왔다.' },
        { if: 'e7=silent', text: '아무 말도 하지 않았고, 장난은 그대로 진행됐다.' },
        { if: 'e7b=help', text: '민준이와 함께 선생님께 알려 번호 변경까지 도움을 받았다.' },
        { if: 'e7b=del', text: '글은 지워졌지만, 번호를 저장한 사람들이 남았다.' },
        { if: 'e7b=none', text: '민준이는 한동안 모르는 번호의 연락에 시달렸다.' }
      ] },
      e8: { title: '“직접 보자”', topic: '현실의 안전', outcomes: [
        { if: 'e8=meet', text: '온라인 다툼 상대에게 학교와 시간을 알려 줬다.' },
        { if: 'e8=crew', text: '친구들을 모아 만나러 가자고 했다.' },
        { if: 'e8=block', text: '위치를 밝히지 않고 대화를 끊었다.' },
        { if: 'e8=tell', text: '대화를 캡처해 두고 보호자에게 알렸다.' },
        { if: 'alone_meet', text: '약속 장소에 나갔다가 보호자에게 전화해 빠져나왔다.' },
        { if: 'e8b=help', text: '약속 장소에 가지 않고 보호자·선생님과 함께 대응했다.' },
        { if: 'school_visible&&e8!=tell', text: '예전에 올린 스토리의 학교 태그가 상대에게 단서가 됐다.' }
      ] },
      e9: { title: '신상 정리 스토리', topic: '비판과 신상 공개의 구분', outcomes: [
        { if: 'e9=share', text: '상대의 이름·학교·동네·얼굴이 담긴 스토리를 공유했다.' },
        { if: 'e9=critique', text: '글은 비판하되 신상은 내리자고 말했다.' },
        { if: 'e9=ask', text: '피해를 입은 서아에게 먼저 뜻을 물었다.' },
        { if: 'e9=report', text: '후기 글과 신상 스토리를 신고하고 선생님께 알렸다.' },
        { if: 'e9b=del', text: '공유를 내렸지만, 캡처해 간 사람이 몇인지는 모른다.' },
        { if: 'e9b=none', text: '공유를 그대로 두었고, 상대 학생을 찾아가자는 댓글이 달렸다.' },
        { if: 'e9b=calm', text: '하윤이와 함께 사람 찾기를 멈추자고 반에 알렸다.' },
        { if: 'e9b=step', text: '할 말은 했고, 그 뒤 일은 하윤이에게 맡겼다.' }
      ] }
    },

    /* 엔딩: 위에서부터 차례로 검사해 처음 맞는 것 하나. 마지막은 조건 없음(기본). */
    endings: [
      { code: 'D', title: '혼자서는 풀리지 않는 일', if: 'alone_meet || serious>=3',
        summary: '문제가 개인이 감당할 크기를 넘어섰다. 보호자와 선생님, 상담 같은 주변의 보호와 지원을 연결해야 하는 일이 됐다.',
        body: [
          '정보 한 조각이 낯선 사람의 손에 닿으면, 그 뒤의 일은 화면 안에서 끝나지 않는다.',
          '도움을 요청하는 건 지는 게 아니다. 혼자 해결하려 하지 않고 어른과 제도를 연결하는 것이 지금 가장 필요한 행동이다.'
        ] },
      { code: 'A', title: '함께 세운 경계', if: 'spread<=1 && consent>=3',
        summary: '정보의 주인에게 먼저 묻고, 필요한 범위에서만 공유하고 대응했다.',
        body: [
          '같은 반, 친한 친구 사이에서도 “이거 보내도 돼?”라는 한 문장이 있었다.',
          '경계는 혼자 지킨 게 아니라, 매번 상대에게 물으며 함께 세운 것이다. 다만 내가 모든 일을 막을 수 있었던 건 아니다. 다른 사람이 퍼뜨린 정보는 여전히 어딘가에 남아 있다.'
        ] },
      { code: 'B', title: '멈춘 확산, 남은 과제', if: 'repair+help>=3',
        summary: '문제가 생겼지만, 확산을 줄이고 회복을 시작했다.',
        body: [
          '지우기를 요청하고, 사과하고, 도움을 구했다. 확산은 멈췄다.',
          '하지만 이미 본 사람의 기억과 저장된 사본까지 되돌릴 수는 없다. 회복은 시작됐을 뿐, 끝나지 않았다.'
        ] },
      { code: 'C', title: '삭제 이후에도', if: null,
        summary: '게시물은 지워졌지만, 복제된 정보와 관계의 문제가 남았다.',
        body: [
          '축제가 끝나고 문제의 게시물들은 대부분 내려갔다. 그런데 캡처와 저장본은 누가 몇 개를 갖고 있는지 아무도 모른다.',
          '그리고 그때 아무 말도 하지 않았던 순간들이, 친구들과의 사이에 조용히 남아 있다.'
        ] }
    ],

    /* 성찰 질문 — 기본(중학생) + 더 깊이(고등학생·심화 토론) */
    reflection: {
      core: '누가, 누구의 정보를, 누구에게, 어떤 목적으로, 어디까지 공유할 수 있는가?',
      basic: [
        '정산 계좌번호처럼 꼭 필요한 공유와, 필요 이상의 공유는 어떻게 구분할 수 있을까?',
        '사진을 “찍어도 돼?”와 “올려도 돼?”는 왜 따로 물어야 할까?',
        '친구가 털어놓은 고민을 돕고 싶을 때, 친구의 비밀을 지키면서 도울 방법은 무엇일까?',
        '공용 컴퓨터에 친구 계정이 열려 있었다. “볼 수 있다”와 “봐도 된다”는 무엇이 다를까?',
        '온라인에서 “직접 보자”는 말을 들었을 때, 용기 있는 행동은 무엇일까?'
      ],
      deep: [
        '공개 계정에 올린 사진을 다른 사람이 합성했다. 공개한 사람에게도 책임이 있다는 말에 어떻게 답할 수 있을까?',
        'AI 도우미에 정보를 넣는 일은 친구에게 말하는 일과 어떤 점이 같고 어떤 점이 다를까? 그 정보의 주인은 누구일까?',
        '잘못된 글을 쓴 사람을 비판하는 것과 그 사람의 신상을 퍼뜨리는 것은 어디서 갈라질까?',
        '“아무 말도 하지 않은 것”도 선택일까? 방관이 확산에 어떤 영향을 줬는지 이 게임의 장면으로 이야기해 보자.',
        '지운 게시물, 사과, 신고로 되돌릴 수 있는 것과 없는 것은 각각 무엇이었을까?'
      ]
    },

    scenes: {
      /* ───────── 프롤로그 ───────── */
      pro_1: {
        chapter: 0, event: null, label: '역할 정하기',
        view: { type: 'group', title: '2학년 3반 축제준비방', meta: '28명' },
        lines: [
          'sys: 축제까지 D-4 · 오후 5:30',
          'hayun: 부스 이름 확정! ‘레트로 사진관’ 📸',
          'dohyun: 사진관이면 사진 진짜 많이 찍겠네 ㅋㅋ 다 올려야지',
          'seoa: 나는 꾸미기 할래!',
          'minjun: …나는 소품.',
          'hayun: {name}, 너는 뭐 맡을래?'
        ],
        prompt: '어떤 역할을 맡을까?',
        choices: [
          { id: 'photo', text: '사진 찍는 담당을 맡는다.', say: '나 사진 찍을게. 카메라 내가 챙길게', set: { role: 'photo' },
            react: ['hayun: 오 좋아! 부스용 카메라 너한테 맡길게'], next: '@chapter:1' },
          { id: 'sns', text: 'SNS 홍보를 맡는다.', say: '홍보는 내가 할게. 스토리 올리는 거 자신 있어', set: { role: 'sns' },
            react: ['dohyun: ㅋㅋ 조회수 뽑아 줘'], next: '@chapter:1' },
          { id: 'money', text: '정산을 돕는다.', say: '하윤아, 정산 같이 할게', set: { role: 'money' },
            react: ['hayun: 살았다 ㅠ 고마워'], next: '@chapter:1' }
        ]
      },

      /* ───────── 1장 · 사건1 계좌번호 ───────── */
      c1_e1_a: {
        chapter: 1, event: 'e1', label: '재료비 정산',
        view: { type: 'group', title: '2학년 3반 축제준비방', meta: '28명' },
        lines: [
          'sys: D-4 · 저녁 8:12',
          'hayun: 재료비 1인 3,000원! 제 계좌로 보내 주세요 → 가상은행 0000-00-000000 (김하윤)',
          'hayun: 그리고 아까 현금으로 더 낸 사람 3명! 돌려줄게 ㅠ 계좌 알려 줘',
          'dohyun: 여기 올리면 되지? 최도현 / 가상은행 1111-11-111111 / 010-0000-0000 ㅋㅋ 빨리 줘',
          { who: 'narr', text: '정산을 돕기로 했으니, 누가 얼마를 돌려받는지 내가 정리해야 한다.', if: 'role=money' },
          'narr: 나도 현금으로 2,000원을 더 냈다. 돌려받으려면 하윤이에게 계좌번호를 알려 줘야 한다.'
        ],
        prompt: '계좌번호를 어떻게 알려 줄까?',
        choices: [
          { id: 'public', text: '나도 단톡방에 계좌번호를 올린다.', say: '{name} / 가상은행 2222-22-222222',
            set: { e1: 'public' }, add: { spread: 1 },
            react: ['hayun: ㅇㅋ 확인!', 'narr: 28명이 내 이름과 계좌번호를 함께 봤다. 대화는 금방 위로 밀려 올라갔다.'],
            next: 'c1_e1_b' },
          { id: 'dm', text: '하윤이에게 개인톡으로만 계좌번호를 보낸다.',
            set: { e1: 'dm' }, add: { minimize: 1 },
            react: ['narr: 하윤이와의 개인톡에만 계좌번호를 보냈다.', 'hayun: (개인톡) 받았어! 고마워'],
            next: 'c1_e1_b' },
          { id: 'propose', text: '단톡방에 “계좌는 하윤이한테 개인톡으로 보내자”고 남긴다.',
            say: '계좌는 정산하는 하윤이한테만 개인톡으로 보내는 게 어때? 여기 28명이라',
            set: { e1: 'propose' }, add: { minimize: 1, 'trust.hayun': 1 },
            react: ['hayun: 오 그게 맞다. 다들 개인톡으로 보내 줘!', 'dohyun: 아 난 이미 올렸는데 ㅋㅋ'],
            next: 'c1_e1_b' }
        ]
      },
      c1_e1_b: {
        chapter: 1, event: 'e1', label: '도현이의 전화번호',
        view: { type: 'group', title: '2학년 3반 축제준비방', meta: '28명' },
        lines: [
          'narr: 도현이의 메시지에는 계좌번호뿐 아니라 전화번호도 들어 있다.',
          'seoa: 도현아 전화번호까지 올렸네',
          'dohyun: 에이 우리 반끼린데 뭐 어때 ㅋㅋ',
          { who: 'narr', text: '말하려다 보니, 내 계좌번호도 아직 위에 남아 있다.', if: 'e1=public' }
        ],
        prompt: '도현이의 메시지를 어떻게 할까?',
        choices: [
          { id: 'fix', if: 'e1!=public', text: '번호는 지우고 하윤이에게만 보내라고 도현이에게 말한다.',
            say: '우리 반이어도 28명이야. 번호는 지우고 하윤이한테만 보내 줘',
            set: { e1b: 'fix' }, add: { repair: 1 },
            react: ['dohyun: 아 ㅇㅋ 지움', 'sys: 메시지가 삭제되었습니다'], next: 'c1_e2_a' },
          { id: 'fixboth', if: 'e1=public', text: '내 계좌 메시지를 먼저 지우고, 도현이에게도 지우자고 한다.',
            say: '나도 지울게. 여기 28명이니까 도현이 너도 번호는 지우자',
            set: { e1b: 'fixboth' }, add: { repair: 1 },
            react: ['dohyun: 아 ㅇㅋ 나도 지움', 'sys: 메시지 2개가 삭제되었습니다',
              'narr: 지우기 전까지 몇 명이 봤는지는 알 수 없다.'], next: 'c1_e2_a' },
          { id: 'pass', text: '괜찮겠지 하고 넘어간다.',
            set: { e1b: 'pass' },
            react: ['narr: 대화는 곧 소품 이야기로 넘어갔다. 도현이의 번호는 그대로 남았다.'], next: 'c1_e2_a' }
        ]
      },

      /* ───────── 1장 · 사건2 사진 ───────── */
      c1_e2_a: {
        chapter: 1, event: 'e2', label: '잠든 민준이',
        view: { type: 'place', title: '교실 · 방과 후' },
        lines: [
          'sys: D-3 · 오후 4:40',
          'narr: 부스 꾸미기 중. 민준이가 페인트 묻은 얼굴로 책상에 엎드려 잠들었다. 볼에 반짝이까지 붙어 있다.',
          'dohyun: (속삭이며) 야, 이건 찍어야 돼. 레전드다.',
          { who: 'narr', text: '내 손에는 부스용 카메라가 들려 있다.', if: 'role=photo' }
        ],
        prompt: '찍을까?',
        choices: [
          { id: 'shoot', text: '같이 웃으며 사진을 찍는다.',
            set: { e2shot: 'nocheck', e2_photo: true },
            react: ['narr: 찰칵. 민준이는 깨지 않았다.', 'dohyun: ㅋㅋㅋㅋ 이거 프사감'], next: 'c1_e2_b' },
          { id: 'ask', text: '민준이를 깨워 찍어도 되는지 먼저 묻는다.',
            say: '민준아, 지금 너 얼굴 완전 웃긴데… 사진 찍어도 돼?',
            set: { e2shot: 'asked', e2_photo: true }, add: { consent: 1 },
            react: ['minjun: …뭐야. 찍는 건 괜찮은데, 어디 올리진 마.', 'dohyun: ㅋㅋ ㅇㅋㅇㅋ'], next: 'c1_e2_b' },
          { id: 'no', text: '자는 사람은 찍지 말자고 도현이에게 말한다.',
            say: '자는 사람 찍는 건 좀 아니다. 그냥 두자',
            set: { e2shot: 'none' },
            react: ['dohyun: 아 재미없어~ 알았어', 'narr: 도현이는 휴대폰을 내렸다.'], next: 'c1_e3_a' }
        ]
      },
      c1_e2_b: {
        chapter: 1, event: 'e2', label: '사진 올리기',
        view: { type: 'dm', title: '도현' },
        lines: [
          'sys: D-3 · 저녁 9:03',
          { kind: 'image', text: '민준이가 엎드려 자는 사진 (게임에서는 이미지를 보여 주지 않아요)' },
          'dohyun: 이거 스토리 올려도 되지? 아님 반톡?',
          { who: 'dohyun', text: '부스 홍보 계정에 올려도 웃기겠다 ㅋㅋ', if: 'role=sns' },
          { who: 'narr', text: '민준이는 분명 “올리진 마”라고 했다.', if: 'e2shot=asked' }
        ],
        prompt: '사진을 어떻게 할까?',
        choices: [
          { id: 'ask', if: 'e2shot!=asked', text: '올리기 전에 민준이에게 물어보자고 한다.',
            say: '올리는 건 민준이한테 물어보고 하자',
            set: { e2post: 'ask' }, add: { consent: 1 },
            react: ['narr: 민준이에게 메시지를 보냈다.', 'minjun: 아 그건 좀… 올리지 말아 줘', 'dohyun: ㅇㅋ 그럼 우리끼리만 보자'],
            next: 'c1_e3_a' },
          { id: 'keep', if: 'e2shot=asked', text: '민준이가 올리지 말라고 했다고 말한다.',
            say: '민준이가 찍는 건 되는데 올리는 건 안 된대',
            set: { e2post: 'keep' }, add: { minimize: 1 },
            react: ['dohyun: 아 맞다. 알겠어 ㅋㅋ 아깝네'], next: 'c1_e3_a' },
          { id: 'group', text: '“우리끼리”니까 반 단톡방에만 올린다.',
            set: { e2post: 'group' }, add: { spread: 1 },
            react: ['narr: 28명 방에 사진이 올라갔다. ‘ㅋㅋㅋ’ 반응이 14개 달렸다.',
              'narr: 누가 사진을 저장했는지는 표시되지 않는다. 그래서 아무도 모른다.'], next: 'c1_e2_d' },
          { id: 'story', text: '스냅로그 스토리에 올린다. 부스 홍보도 되니까.',
            set: { e2post: 'story', school_visible: true }, add: { spread: 2 },
            react: ['narr: ‘#솔빛축제 #레트로사진관’ 태그를 달았다. 1시간 만에 조회 312회.'], next: 'c1_e2_d' }
        ]
      },
      c1_e2_d: {
        chapter: 1, event: 'e2', label: '삭제 요청',
        view: { type: 'dm', title: '민준' },
        lines: [
          'sys: D-2 · 오전 7:58',
          'minjun: 어제 그 사진… 내려 줄 수 있어?',
          { who: 'minjun', text: '다른 학교 다니는 사촌까지 봤대.', if: 'e2post=story' },
          { who: 'minjun', text: '반 애들이 아침부터 나 보면서 웃어.', if: 'e2post=group' },
          { who: 'minjun', text: '찍는 건 괜찮다고 했지, 올려도 된다고는 안 했어.', if: 'e2shot=asked' }
        ],
        prompt: '민준이에게 뭐라고 할까?',
        choices: [
          { id: 'sorry', text: '바로 내리고, 동의 없이 올린 걸 사과한다.',
            say: '바로 내릴게. 묻지도 않고 올려서 미안해',
            set: { e2fix: 'sorry' }, add: { repair: 1 },
            react: ['sys: 게시물이 삭제되었습니다', 'minjun: …응. 고마워.',
              'narr: 게시물은 사라졌다. 이미 저장된 사진이 어디에 몇 장 있는지는 알 수 없다.'], next: 'c1_e3_a' },
          { id: 'all', text: '사진을 내리고, 저장한 사람도 지워 달라고 단톡방에 부탁한다.',
            say: '어제 민준이 사진 저장한 사람 있으면 지워 줘. 내가 허락 없이 올렸어',
            set: { e2fix: 'all' }, add: { repair: 2, 'trust.minjun': 1 },
            react: ['sys: 게시물이 삭제되었습니다', 'hayun: 나 저장했었는데 지웠어',
              'narr: 몇 명은 지웠다고 답했다. 답하지 않은 사람도 있다.', 'minjun: 고마워. 진짜로.'], next: 'c1_e3_a' },
          { id: 'no', text: '“다들 웃기다는데?” 하고 넘긴다.',
            say: '에이 다들 웃기다는데? 너무 신경 쓰지 마',
            set: { e2fix: 'no' }, add: { spread: 1, 'trust.minjun': -2 },
            react: ['minjun: …알겠어.', 'narr: 민준이는 그 뒤로 답이 없었다. 사진은 계속 공유됐다.'], next: 'c1_e3_a' }
        ]
      },

      /* ───────── 1장 · 사건3 고민 대화 ───────── */
      c1_e3_a: {
        chapter: 1, event: 'e3', label: '서아의 고민',
        view: { type: 'dm', title: '서아' },
        lines: [
          'sys: D-2 · 밤 10:21',
          'seoa: {name}, 자?',
          'seoa: 나 사실 축제 날 앞에서 손님 받는 거 너무 무서워. 사람들 앞에 서면 숨이 막혀.',
          'seoa: 하윤이가 나를 안내 담당으로 정했는데, 말을 못 하겠어.',
          'seoa: 이거 아무한테도 말하지 마. 진짜로.',
          'narr: 다음 날 아침, 하윤이에게서 메시지가 왔다.'
        ],
        next: 'c1_e3_b'
      },
      c1_e3_b: {
        chapter: 1, event: 'e3', label: '하윤이의 질문',
        view: { type: 'dm', title: '하윤' },
        lines: [
          'sys: D-1 · 오전 8:05',
          'hayun: 서아 요즘 왜 그래? 역할 얘기만 하면 피해. 너 뭐 알아?',
          'hayun: 역할표 오늘 확정해야 하는데 ㅠ'
        ],
        prompt: '하윤이에게 어떻게 답할까?',
        choices: [
          { id: 'ask', text: '하윤이와 이 일을 의논해도 되는지 서아에게 먼저 묻는다.',
            set: { e3: 'ask' }, add: { consent: 1, 'trust.seoa': 1 },
            react: ['narr: 하윤이에게 “잠깐만”이라고 보내고, 서아에게 물었다.',
              'seoa: …하윤이한테는 역할 바꾸고 싶다는 것만 말해 줘. 무서워하는 건 내가 나중에 직접 말할게.'],
            next: 'c1_e3_ask' },
          { id: 'anon', text: '이름과 구체적인 사정은 빼고, 역할을 다시 신청받자고만 한다.',
            say: '혹시 안내가 부담스러운 사람도 있을 수 있잖아. 역할 다시 신청받아 보는 건 어때?',
            set: { e3: 'anon' }, add: { minimize: 1 },
            react: ['hayun: 오 그러네. 역할 다시 받을게!'], next: 'c1_e3_anon' },
          { id: 'capture', text: '하윤이가 정확히 알아야 할 것 같아 서아와의 대화를 캡처해 보낸다.',
            set: { e3: 'capture' }, add: { spread: 1 },
            react: [{ kind: 'image', text: '서아와의 대화 캡처 1장 — “아무한테도 말하지 마”까지 함께 찍혔다' },
              'hayun: 헐 몰랐어… 알려 줘서 고마워'], next: 'c1_e3_cap' }
        ]
      },
      c1_e3_ask: {
        chapter: 1, event: 'e3', label: '서아가 정한 만큼',
        view: { type: 'dm', title: '서아' },
        lines: [
          'narr: 하윤이에게는 서아가 역할을 바꾸고 싶어 한다는 것만 전했다. 서아는 꾸미기 담당이 됐다.',
          'seoa: 고마워. 내가 정한 만큼만 말해 줘서.'
        ],
        next: '@chapter:2'
      },
      c1_e3_anon: {
        chapter: 1, event: 'e3', label: '역할 재신청',
        view: { type: 'group', title: '2학년 3반 축제준비방', meta: '28명' },
        lines: [
          'hayun: 역할 바꾸고 싶은 사람 오늘까지 개인톡 주세요~',
          'narr: 점심 무렵, 서아가 꾸미기 담당으로 바뀌었다.',
          'seoa: (개인톡) 역할 바꿨어! 다행이다 ㅠ',
          'narr: 서아는 내가 무슨 말을 했는지 모른다. 서아의 이야기는 서아의 것으로 남았다.'
        ],
        next: '@chapter:2'
      },
      c1_e3_cap: {
        chapter: 1, event: 'e3', label: '두 번째 전달',
        view: { type: 'dm', title: '도현' },
        lines: [
          'sys: D-1 · 오후 1:10',
          'dohyun: 서아 무대공포증이라며? ㅋㅋ 하윤이가 캡처 보여 줌',
          'narr: 하윤이가 역할을 바꾸면서 도현이에게 캡처를 보여 줬다. 한 장이 두 사람에게 갔다.'
        ],
        prompt: '어떻게 할까?',
        choices: [
          { id: 'full', text: '하윤이와 도현이에게 지워 달라고 한 뒤, 서아에게 솔직히 말하고 사과한다.',
            set: { e3fix: 'full' }, add: { repair: 2, 'trust.seoa': -1 },
            react: ['hayun: 아… 미안. 지웠어', 'dohyun: 나도 지움',
              'seoa: …화나. 아무한테도 말하지 말랬잖아.', 'seoa: 그래도 다른 데서 듣기 전에 네가 먼저 말해 줘서… 그건 다행이야.'],
            next: '@chapter:2' },
          { id: 'part', text: '도현이에게만 더 퍼뜨리지 말라고 한다.',
            say: '그거 아무한테도 말하지 마. 서아가 비밀로 해 달라고 한 거야',
            set: { e3fix: 'part' }, add: { repair: 1 },
            react: ['dohyun: ㅇㅋ 말 안 할게',
              'narr: 서아는 아직 아무것도 모른다. 캡처가 지금 몇 대의 휴대폰에 있는지도 모른다.'],
            next: '@chapter:2' },
          { id: 'none', text: '이미 보낸 거니 어쩔 수 없다고 생각한다.',
            set: { e3fix: 'none' }, add: { spread: 1, 'trust.seoa': -2 },
            react: ['narr: 점심시간, 서아가 교실에 들어오자 몇 명이 서아를 쳐다봤다.', 'seoa: (개인톡) 너지?'],
            next: '@chapter:2' }
        ]
      },

      /* ───────── 2장 · 사건4 합성 이미지 ───────── */
      c2_e4_a: {
        chapter: 2, event: 'e4', label: '돌고 있는 합성 이미지',
        view: { type: 'dm', title: '도현' },
        lines: [
          'sys: D-1 · 오후 6:05',
          'narr: 하윤이는 축제 홍보용 셀카를 공개 계정에 올렸었다.',
          'dohyun: 야 이거 봤냐 ㅋㅋㅋ 누가 만든 거래',
          { kind: 'image', text: '하윤이의 공개 셀카 얼굴을 ‘망한 축제 포스터’ 속 우스꽝스러운 인물에 붙인 합성 이미지 (게임에서는 보여 주지 않아요)' },
          'dohyun: 익명 계정에서 돌고 있음. 다른 반 애들도 벌써 다 봄',
          'dohyun: 근데 공개 계정에 셀카 올린 하윤이도 좀 그렇지 않냐?',
          { who: 'narr', text: '며칠 전, 내가 보낸 서아의 캡처도 이렇게 다른 사람의 화면으로 옮겨 갔었다.', if: 'e3=capture' },
          { who: 'narr', text: '사흘 전 단톡방에 올라갔던 민준이 사진이 떠올랐다.', if: 'e2post=group|story' }
        ],
        prompt: '받은 이미지를 어떻게 할까?',
        choices: [
          { id: 'forward', text: '웃기다며 다른 친구 몇 명에게 전달한다.',
            set: { e4: 'forward' }, add: { spread: 2, serious: 1 },
            react: ['sys: 3명에게 전달됨', 'narr: 그중 한 명이 또 다른 방에 올렸다.',
              'narr: 합성된 이미지에는 하윤이의 진짜 얼굴이 들어 있다.'], next: 'c2_e4_b' },
          { id: 'refuse', text: '“공개 사진이라고 합성해도 되는 건 아니야”라고 답하고, 저장하지 않는다.',
            say: '공개 사진이라고 아무나 합성해서 돌려도 되는 건 아니잖아. 하윤이 잘못 아니야',
            set: { e4: 'refuse' }, add: { minimize: 1 },
            react: ['dohyun: …그건 그렇네. 나도 그냥 받은 건데', 'dohyun: 나 보낸 거 지울게'], next: 'c2_e4_b' },
          { id: 'ignore', text: '그냥 읽고 넘긴다.',
            set: { e4: 'ignore' },
            react: ['narr: 답장하지 않았다. 이미지는 내 대화방에 그대로 남아 있다.',
              'narr: 그사이 다른 사람들은 계속 공유하고 있다.'], next: 'c2_e4_b' }
        ]
      },
      c2_e4_b: {
        chapter: 2, event: 'e4', label: '하윤이의 메시지',
        view: { type: 'dm', title: '하윤' },
        lines: [
          'sys: D-1 · 저녁 7:20',
          'hayun: {name}… 혹시 그 사진 봤어?',
          'hayun: 다들 나 보고 웃는 것 같아. 내가 공개로 올린 게 잘못이었나',
          { who: 'narr', text: '하윤이는 내가 그 이미지를 전달했다는 걸 아직 모른다.', if: 'e4=forward' }
        ],
        prompt: '하윤이에게 어떻게 답할까?',
        choices: [
          { id: 'ask', text: '네 잘못이 아니라고 말하고, 어떻게 하고 싶은지 묻는다.',
            say: '네 잘못 아니야. 만든 사람이랑 퍼뜨린 사람 잘못이지. 어떻게 하고 싶어? 같이 할게',
            set: { e4b: 'ask' }, add: { consent: 1, help: 1, 'trust.hayun': 1 },
            react: ['hayun: …신고하고 싶어. 선생님한테도 말할래. 같이 가 줄래?',
              'narr: 익명 계정을 신고하고, 하윤이와 함께 담임 선생님을 찾아갔다.',
              'teacher: 말해 줘서 고마워. 게시물 주소와 날짜를 같이 정리해 두자. 퍼뜨리는 일은 선생님이 반에서 따로 이야기할게.'],
            next: 'c2_e5_a' },
          { id: 'report', text: '익명 계정을 신고하고, 받은 사람은 지워 달라고 단톡방에 말한다.',
            say: '하윤이 합성 사진 받은 사람, 더 보내지 말고 지워 줘. 그 계정은 신고했어',
            set: { e4b: 'report' }, add: { repair: 1 },
            react: ['dohyun: 지움', 'narr: 익명 계정 옆에 ‘신고 접수됨’이 떴다.', 'hayun: 고마워…'], next: 'c2_e5_a' },
          { id: 'confess', if: 'e4=forward', text: '내가 전달했다고 털어놓고, 전달한 친구들에게 지워 달라고 한다.',
            say: '사실 나도 그거 3명한테 보냈어. 미안해. 지금 다 지워 달라고 할게',
            set: { e4b: 'confess' }, add: { repair: 2, 'trust.hayun': -1 },
            react: ['hayun: …너도?', 'narr: 3명에게 지워 달라고 했다. 2명은 지웠다고 답했다.',
              'narr: 한 명은 “이미 다른 방에도 있음”이라고 답했다.'], next: 'c2_e5_a' },
          { id: 'blame', text: '“그러게 왜 공개로 올렸어”라고 답한다.',
            say: '그러게… 왜 공개로 올렸어',
            set: { e4b: 'blame' }, add: { 'trust.hayun': -2 },
            react: ['hayun: …그렇지. 내가 바보지.', 'narr: 하윤이는 계정을 비공개로 바꿨다. 이미지는 여전히 돌고 있었다.'],
            next: 'c2_e5_a' }
        ]
      },

      /* ───────── 2장 · 사건5 생성형 AI ───────── */
      c2_e5_a: {
        chapter: 2, event: 'e5', label: 'AI 도우미 입력창',
        view: { type: 'ai', title: 'AI 도우미 루미', meta: '가상 시뮬레이션' },
        lines: [
          'sys: D-1 · 밤 9:30',
          'narr: 축제 전날 밤. 부스 안내문을 써야 한다. 그리고 서아 일이 계속 마음에 걸린다.',
          'narr: AI 도우미 ‘루미’에게 물어보기로 했다. 복사해 둔 것들이 있다.',
          { kind: 'setting', text: '① 반 단톡방 대화 전체', meta: '28명 이름·전화번호·계좌번호 포함' },
          { kind: 'setting', text: '② 서아와의 개인톡', meta: '서아가 털어놓은 고민' },
          { kind: 'setting', text: '③ 부스 정보', meta: '이름·운영 시간·가격' },
          'lumi: 무엇을 도와드릴까요?'
        ],
        prompt: '무엇을 입력할까?',
        choices: [
          { id: 'all', text: '단톡방 대화를 통째로 붙여 넣고 “안내문 써 줘”라고 한다.',
            set: { e5: 'all' },
            react: ['lumi: 안내문 초안입니다. “2학년 3반 레트로 사진관에 놀러 오세요! …”',
              'lumi: 참고로 입력하신 내용에는 전화번호와 계좌번호가 들어 있어요. 안내문 작성에는 필요하지 않은 정보예요.',
              'narr: 안내문에 필요한 건 부스 이름·시간·가격뿐이었다.'], next: 'c2_e5_b' },
          { id: 'min', text: '부스 이름·시간·가격만 넣고 안내문을 부탁한다.',
            set: { e5: 'min' }, add: { minimize: 1 },
            react: ['lumi: 안내문 초안입니다. “2학년 3반 레트로 사진관 · 오전 10시~오후 3시 · 1컷 500원”',
              'narr: 필요한 정보만 넣었는데도 안내문은 충분히 나왔다.'], next: 'c2_e5_b' },
          { id: 'seoa', text: '서아와의 대화를 그대로 넣고 “친구한테 뭐라고 하지?”라고 묻는다.',
            set: { e5: 'seoa' },
            react: ['lumi: 친구를 돕고 싶은 마음이 느껴져요. 다만 이 대화에는 친구가 당신에게만 털어놓은 내용이 들어 있어요.',
              'lumi: 이름이나 구체적인 내용 없이 상황만 알려 주셔도 함께 생각해 볼 수 있어요.',
              'narr: 서아는 자기 이야기가 여기에 들어온 걸 모른다.'], next: 'c2_e5_b' },
          { id: 'anon', text: '서아의 이름과 사정은 빼고 “무대가 무서운 친구를 어떻게 도울까?”라고만 묻는다.',
            set: { e5: 'anon' }, add: { minimize: 1 },
            react: ['lumi: 친구가 역할을 직접 고르게 해 주거나, 처음 10분만 옆에 같이 서 주는 방법이 있어요.',
              'lumi: 무엇보다 친구에게 어떤 도움이 필요한지 직접 물어보는 게 좋아요.'], next: 'c2_e5_b' }
        ]
      },
      c2_e5_b: {
        chapter: 2, event: 'e5', label: '설정 화면',
        view: { type: 'ai', title: 'AI 도우미 루미 · 설정', meta: '가상 시뮬레이션' },
        lines: [
          'narr: 답을 받고 나서 설정 메뉴를 열어 봤다.',
          { kind: 'setting', text: '대화 기록 저장', meta: '켜짐' },
          { kind: 'setting', text: '입력한 대화를 서비스 개선에 활용', meta: '설정에 따라 다름 · 안내 보기' },
          'narr: AI에 입력했다고 곧바로 인터넷에 공개되는 건 아니다. 하지만 어디에, 얼마나 오래 남고 어떻게 쓰이는지는 서비스마다 설정과 정책이 다르다.',
          { who: 'narr', text: '그리고 그 정보의 주인인 친구들은 여기에 입력되는 데 동의한 적이 없다.', if: 'e5=all|seoa' }
        ],
        prompt: '창을 닫기 전에',
        choices: [
          { id: 'del', if: 'e5=all|seoa', text: '방금 대화를 지우고, 기록 저장 설정을 확인한다.',
            set: { e5fix: 'del' }, add: { repair: 1 },
            react: ['sys: 대화가 삭제되었습니다',
              'narr: 이미 처리된 내용이 어떻게 되는지는 서비스 안내를 더 읽어 봐야 알 수 있다. 다음엔 넣기 전에 먼저 지워야겠다.'],
            next: 'c2_e6_a' },
          { id: 'check', if: 'e5=min|anon', text: '기록 저장 설정을 확인해 둔다.',
            set: { e5fix: 'check' },
            react: ['narr: 설정 안내를 읽고 기록 저장을 껐다.'], next: 'c2_e6_a' },
          { id: 'close', text: '별일 없겠지 하고 창을 닫는다.',
            set: { e5fix: 'none' },
            react: ['narr: 창을 닫았다. 대화는 기록에 남아 있다.'], next: 'c2_e6_a' }
        ]
      },

      /* ───────── 2장 · 사건6 공용 PC ───────── */
      c2_e6_a: {
        chapter: 2, event: 'e6', label: '도서관 공용 PC',
        view: { type: 'pc', title: '도서관 공용 PC 3번' },
        lines: [
          'sys: 축제 당일 · 오전 8:10',
          'narr: 안내문을 출력하러 도서관 공용 PC에 앉았다.',
          { kind: 'setting', text: '스냅로그 — @dohyun_ 님으로 로그인됨', meta: '새 메시지 7' },
          'narr: 도현이가 어제 쓰고 로그아웃을 안 한 모양이다.',
          'friend: 오 도현이 계정이네? DM 좀 보자 ㅋㅋ'
        ],
        prompt: '이 화면을 어떻게 할까?',
        choices: [
          { id: 'peek', text: 'DM 목록을 살짝 훑어본다.',
            set: { e6: 'peek' }, add: { spread: 1 },
            react: ['narr: 메시지 미리보기가 줄줄이 보인다. 가족 이야기, 다른 반 친구와 다툰 이야기…',
              'narr: 볼 수 있었다. 하지만 볼 권리가 생긴 건 아니었다.'], next: 'c2_e6_b' },
          { id: 'post', text: '옆 반 친구가 부추겨 도현이 계정으로 “나는 바보다” 스토리를 올린다.',
            set: { e6: 'post' }, add: { spread: 1, 'trust.dohyun': -2 },
            react: ['friend: ㅋㅋㅋㅋ 미쳤다', 'narr: 스토리가 도현이의 팔로워 418명에게 올라갔다.'], next: 'c2_e6_b' },
          { id: 'logout', text: '아무것도 열지 않고 로그아웃한 뒤 도현이에게 알려 준다.',
            say: '(도현에게) 도서관 PC에 너 스냅로그 로그인돼 있어서 로그아웃했어. 아무것도 안 열었어',
            set: { e6: 'logout' }, add: { repair: 1, 'trust.dohyun': 2 },
            react: ['friend: 아 뭐야 재미없게', 'dohyun: 헐 고마워 진짜. 비번도 바꿀게'], next: 'c2_e6_c' },
          { id: 'leave', text: '내 일만 하고 그냥 자리를 뜬다.',
            set: { e6: 'leave' },
            react: ['narr: 출력물을 챙겨 일어났다. 옆 반 친구가 그 자리에 앉았다.'], next: 'c2_e6_c' }
        ]
      },
      c2_e6_b: {
        chapter: 2, event: 'e6', label: '그다음',
        view: { type: 'pc', title: '도서관 공용 PC 3번' },
        lines: [
          { who: 'friend', text: '뭐 있어? 캡처 떠서 보내 줘 ㅋㅋ', if: 'e6=peek' },
          { who: 'dohyun', text: '(개인톡) 야 내 계정에 누가 이상한 거 올렸어?? 너 아까 도서관 갔었지', if: 'e6=post' }
        ],
        prompt: '어떻게 할까?',
        choices: [
          { id: 'stop', if: 'e6=peek', text: '캡처하지 않고 로그아웃한다. 도현이에게 로그인이 남아 있었다고 알린다.',
            say: '(도현에게) 도서관 PC에 로그인돼 있더라. 로그아웃했어. 비번 바꿔',
            set: { e6b: 'stop' }, add: { repair: 1 },
            react: ['dohyun: 헐 고마워', 'narr: 미리보기를 봤다는 말은 하지 못했다.'], next: 'c2_e6_c' },
          { id: 'cap', if: 'e6=peek', text: '옆 반 친구에게 몇 개 캡처해 보낸다.',
            set: { e6b: 'cap' }, add: { spread: 2, 'trust.dohyun': -2 },
            react: ['friend: ㅋㅋㅋ 도현이 이런 얘기도 하네', 'narr: 도현이의 가족 이야기가 다른 반 단톡방으로 넘어갔다.'], next: 'c2_e6_c' },
          { id: 'own', if: 'e6=post', text: '내가 올렸다고 말하고 스토리를 지운다. 비밀번호도 바꾸라고 알려 준다.',
            say: '미안, 그거 나야. 지금 지웠어. 로그인 남아 있었으니까 비번 바꿔',
            set: { e6b: 'own' }, add: { repair: 1, 'trust.dohyun': 1 },
            react: ['dohyun: 아 진짜… ㅡㅡ 그래도 말해 줘서 다행이다'], next: 'c2_e6_c' },
          { id: 'deny', if: 'e6=post', text: '모른 척한다.',
            say: '몰라? 나 출력만 하고 나왔는데',
            set: { e6b: 'deny' }, add: { 'trust.dohyun': -1 },
            react: ['dohyun: 진짜 누구지… 계정 해킹당한 줄', 'narr: 도현이는 하루 종일 누가 올렸는지 찾아다녔다.'], next: 'c2_e6_c' }
        ]
      },
      c2_e6_c: {
        chapter: 2, event: 'e6', label: '1교시 뒤',
        view: { type: 'dm', title: '도현' },
        lines: [
          { who: 'dohyun', text: '누가 내 계정 건드렸냐 ㅡㅡ 도서관에서 이상한 스토리 올라갔대', if: 'e6=leave' },
          { who: 'narr', text: '내가 일어난 뒤 그 자리에 앉은 사람이 올린 것이다. 로그아웃 버튼 하나면 됐다.', if: 'e6=leave' },
          { who: 'dohyun', text: '아까 진짜 고마웠어. 남이 내 DM 봤으면 끔찍했을 듯', if: 'e6=logout' },
          { who: 'narr', text: '도현이는 내가 무엇을 봤는지 모른다. 나는 안다.', if: 'e6b=stop' },
          { who: 'dohyun', text: '야… 내 DM 캡처 돌고 있던데 너야?', if: 'e6b=cap' },
          { who: 'dohyun', text: '다음부터는 진짜 그러지 마라', if: 'e6b=own' },
          'narr: 축제가 시작됐다.'
        ],
        next: '@chapter:3'
      },

      /* ───────── 3장 · 사건7 낯선 사람에게 번호 ───────── */
      c3_e7_a: {
        chapter: 3, event: 'e7', label: '“친구 만들어 주자”',
        view: { type: 'group', title: '부스 뒷정리 팀', meta: '5명' },
        lines: [
          'sys: 축제 당일 · 오후 1:15',
          'dohyun: 민준이 아까 사진관에서 계속 혼자 있더라 ㅋㅋ 친구 만들어 주자',
          'dohyun: 중고마켓 ‘무료나눔’ 글에 민준이 번호 올려 놓자. 모르는 사람들한테 연락 오게 ㅋㅋㅋ',
          'friend: ㅋㅋㅋㅋㅋ 해 해',
          { who: 'dohyun', text: '나도 저번에 단톡에 번호 올렸던 거 누가 저장했는지 모르는 번호로 연락 오더라 ㅋㅋ 그거 은근 웃김', if: 'e1b=pass' },
          'dohyun: {name} 너 민준이 번호 있지? 보내 줘',
          'narr: 방 인원 5명. 3명이 ‘ㅋㅋ’를 눌렀다. 다음은 내 차례다.'
        ],
        prompt: '어떻게 답할까?',
        choices: [
          { id: 'join', text: '같이 웃으면서 민준이 번호를 보낸다.',
            set: { e7: 'join', e7done: true }, add: { spread: 2, serious: 1 },
            react: ['narr: 글이 올라갔다. 10분 뒤, 민준이 휴대폰에 모르는 번호로 메시지 4개.'], next: 'c3_e7_b' },
          { id: 'stop', text: '“모르는 사람한테 번호 주는 건 장난 아니야. 하지 말자”고 말한다.',
            say: '모르는 사람한테 민준이 번호 주는 건 장난 아니야. 하지 말자',
            set: { e7: 'stop' },
            react: [
              { who: 'dohyun', text: '…그래, 알았어. 너 말이 맞다. 안 할게', if: 'trust.dohyun>=1' },
              { who: 'dohyun', text: '아 진지하긴 ㅋㅋ 됐어, 번호 말고 이름만 올림', if: 'trust.dohyun<1' },
              { who: 'narr', text: '도현이는 ‘연락 주실 분 솔빛 2-3 민준’이라고만 올렸다. 민준이의 계정을 찾아 메시지를 보내는 사람이 생겼다.', if: 'trust.dohyun<1' }
            ],
            next: [{ if: 'trust.dohyun>=1', to: 'c3_e7_b' }, { to: 'c3_e7_small' }] },
          { id: 'warn', text: '단톡방엔 답하지 않고, 민준이에게 따로 알린다.',
            set: { e7: 'warn', e7done: true }, add: { 'trust.minjun': 1 },
            react: ['narr: 민준이에게 개인톡을 보냈다. “도현이네가 네 번호를 중고마켓에 올리려고 해. 모르는 번호 오면 받지 말고 차단해.”',
              { who: 'minjun', text: '…네가 왜 신경 써? (조금 뒤) 그래도 알려 줘서 고마워.', if: 'trust.minjun<1' },
              { who: 'minjun', text: '알려 줘서 고마워. 차단할게.', if: 'trust.minjun>=1' },
              'narr: 도현이는 다른 친구에게 번호를 받아 글을 올렸다.'], next: 'c3_e7_b' },
          { id: 'silent', text: '아무 말도 하지 않는다.',
            set: { e7: 'silent', e7done: true }, add: { spread: 1 },
            react: ['narr: 다른 친구가 번호를 보냈고, 글이 올라갔다. 내 이름 옆에도 ‘읽음’이 떴다.'], next: 'c3_e7_b' }
        ]
      },
      c3_e7_small: {
        chapter: 3, event: 'e7', label: '이름만 올린 글',
        view: { type: 'dm', title: '민준' },
        lines: [
          'minjun: 모르는 사람이 내 계정으로 “나눔 아직 돼요?”라고 메시지 보냈어. 이거 뭐야?'
        ],
        prompt: '민준이에게 어떻게 할까?',
        choices: [
          { id: 'help', text: '사실대로 말하고, 글을 지우게 한 뒤 함께 차단·신고한다.',
            say: '도현이가 장난으로 글 올렸어. 지우라고 할게. 그 계정들은 같이 차단하고 신고하자',
            set: { e7b: 'del', e7done: true }, add: { repair: 1 },
            react: ['dohyun: 아 미안… 지웠어', 'minjun: …그런 거였구나. 알려 줘서 고마워.'], next: 'c3_e8_a' },
          { id: 'none', text: '나는 말렸으니 모르는 척한다.',
            set: { e7b: 'none', e7done: true },
            react: ['narr: 메시지는 저녁까지 이어졌다. 말린 것만으로는 끝나지 않았다.'], next: 'c3_e8_a' }
        ]
      },
      c3_e7_b: {
        chapter: 3, event: 'e7', label: '그날 오후',
        view: { type: 'dm', title: '민준' },
        lines: [
          { who: 'narr', text: '그날 오후, 민준이의 휴대폰은 조용했다. 민준이는 이런 일이 있었는지도 모를 것이다.', if: 'e7=stop' },
          { who: 'minjun', text: '모르는 사람들이 계속 연락 와. “나눔 아직 돼요?” 이러면서… 좀 무서워.', if: 'e7=join|silent' },
          { who: 'minjun', text: '네가 미리 말해 줘서 바로 차단은 하고 있어. 근데 계속 와.', if: 'e7=warn' }
        ],
        prompt: '민준이를 위해',
        choices: [
          { id: 'help', if: 'e7!=stop', text: '글을 지우게 하고, 민준이와 함께 선생님께 알린다.',
            set: { e7b: 'help' }, add: { help: 1, repair: 1 },
            react: ['teacher: 민준아, 번호 바꾸는 것까지 보호자분과 같이 알아보자. 글 올린 친구들과는 선생님이 이야기할게.',
              'dohyun: …진짜 이렇게까지 될 줄 몰랐어. 미안해.'], next: 'c3_e8_a' },
          { id: 'del', if: 'e7!=stop', text: '도현이에게 글을 지우라고만 한다.',
            say: '그 글 지워. 민준이 진짜 힘들어해',
            set: { e7b: 'del' }, add: { repair: 1 },
            react: ['dohyun: 지웠어 ㅇㅋ', 'narr: 글은 지워졌다. 이미 번호를 저장한 사람들은 남았다.'], next: 'c3_e8_a' },
          { id: 'none', if: 'e7=warn|silent', text: '내가 올린 건 아니니까 그냥 둔다.',
            set: { e7b: 'none' },
            react: ['narr: 민준이는 며칠 동안 모르는 번호의 연락을 받았다.'], next: 'c3_e8_a' },
          { id: 'hide', if: 'e7=join', text: '모르는 척한다.',
            set: { e7b: 'none' }, add: { 'trust.minjun': -1 },
            react: ['narr: 민준이는 며칠 동안 모르는 번호의 연락을 받았다. 번호를 누가 보냈는지 알게 되는 데는 오래 걸리지 않았다.'], next: 'c3_e8_a' }
        ],
        next: 'c3_e8_a'
      },

      /* ───────── 3장 · 사건8 만남 제안 ───────── */
      c3_e8_a: {
        chapter: 3, event: 'e8', label: '댓글 싸움',
        view: { type: 'sns', title: '게임 커뮤니티 ‘블록파티’', meta: '댓글' },
        lines: [
          'sys: 축제 당일 · 저녁 7:40',
          'narr: 축제가 끝나고, 부스에서 했던 게임 공략글을 커뮤니티에 올렸다. 그 글에 시비가 붙었다.',
          'stranger: 그 실력으로 공략글 ㅋㅋ 초딩이냐',
          'me: 님이 더 못하실 듯',
          'stranger: 말로만? 어디 사는데. 직접 보자',
          { who: 'stranger', text: '아 너 스토리에 ‘솔빛축제’ 태그 단 애 맞지? 솔빛학교 정문 9시 어때', if: 'school_visible' },
          'narr: 심장이 빨리 뛴다. 지기 싫다.'
        ],
        prompt: '어떻게 답할까?',
        choices: [
          { id: 'meet', text: '학교 이름을 대고 “9시에 나간다”고 답한다.',
            set: { e8: 'meet' }, add: { serious: 1 },
            react: ['me: 솔빛학교 정문 9시. 나간다',
              'stranger: 오 ㅋㅋ 친구들 데려감',
              'narr: 내 학교와 시간을 아는 사람이 몇 명인지 이제 알 수 없다.'], next: 'c3_e8_b' },
          { id: 'crew', text: '친구들을 모아 같이 나가자고 단톡방에 올린다.',
            set: { e8: 'crew' }, add: { serious: 1, spread: 1 },
            react: ['dohyun: ㄹㅇ? 가자 ㅋㅋ', 'minjun: …그거 위험한 거 아니야?'], next: 'c3_e8_b' },
          { id: 'block', text: '위치는 말하지 않고 대화를 끊은 뒤 차단한다.',
            set: { e8: 'block' },
            react: ['sys: 차단했습니다',
              { who: 'narr', text: '화는 가라앉지 않았지만, 상대는 내가 어디 사는지 모른다.', if: '!school_visible' },
              { who: 'narr', text: '그런데 상대는 이미 내 스토리의 학교 태그를 봤다. 혹시 몰라 스토리 공개 범위를 친한 친구로 바꿨다.', if: 'school_visible' }],
            next: 'c3_e9_a' },
          { id: 'tell', text: '대화를 캡처해 두고 보호자에게 말한다.',
            set: { e8: 'tell' }, add: { help: 1 },
            react: ['narr: 보호자에게 캡처를 보여 줬다.',
              'guardian: 잘 말해 줬어. 더 답하지 말고 신고하자. 내일 선생님께도 알리자.'], next: 'c3_e9_a' }
        ]
      },
      c3_e8_b: {
        chapter: 3, event: 'e8', label: '9시 전',
        view: { type: 'dm', title: '민준' },
        lines: [
          'sys: 저녁 8:30',
          'minjun: {name}, 진짜 나가? 모르는 사람이잖아. 그런 사람 진짜 올 수도 있어.',
          { who: 'dohyun', text: '(단톡) 근데 생각해 보니 상대가 어른일 수도 있잖아… 나 못 갈 듯', if: 'e8=crew' }
        ],
        prompt: '9시까지 30분',
        choices: [
          { id: 'go', text: '그래도 약속했으니 혼자라도 나간다.',
            set: { alone_meet: true }, add: { serious: 1 },
            react: ['narr: 9시, 학교 정문. 처음 보는 사람 셋이 서성인다. 휴대폰에 “어디야?” 메시지가 뜬다.',
              'narr: 다리가 굳었다. 근처 편의점으로 들어가 보호자에게 전화를 걸었다.',
              'narr: 보호자가 왔고, 그 사람들은 사라졌다. 아무 일도 일어나지 않았지만, 아무 일도 아니었던 건 아니다.'],
            next: 'c3_e9_a' },
          { id: 'help', text: '나가지 않고, 캡처를 모아 보호자와 선생님께 알린다.',
            set: { e8b: 'help' }, add: { help: 1 },
            react: ['guardian: 말해 줘서 다행이야. 그 대화 지우지 말고 둬. 내일 학교랑 같이 신고하자.',
              'narr: 약속 장소에 나가지 않았다. 지는 것 같았지만, 그건 지는 게 아니었다.'],
            next: 'c3_e9_a' }
        ]
      },

      /* ───────── 3장 · 사건9 신상 확산 ───────── */
      c3_e9_a: {
        chapter: 3, event: 'e9', label: '신상 정리 스토리',
        view: { type: 'sns', title: '스냅로그', meta: '스토리' },
        lines: [
          'sys: 축제 다음 날 · 오전 11:02',
          'narr: 어젯밤, 다른 학교 학생으로 보이는 계정이 우리 부스 후기를 올렸다.',
          { who: 'anon', kind: 'post', text: '솔빛 2-3 사진관 개노잼. 꾸민 거 다 싸구려ㅋ 꾸민 애 서아라던데 센스 실화냐', meta: '좋아요 87 · 댓글 23' },
          { who: 'hayun', kind: 'post', text: '이 계정 주인 찾았음. 이름 ○○○ / △△학교 2학년 / □□동 거주 / 얼굴 사진 첨부. 다들 퍼 가 주세요', meta: '하윤의 스토리 · 조회 156' },
          'hayun: (개인톡) 이번엔 우리가 당하고만 있으면 안 돼. 나도 저번에 합성 사진 당했잖아. 너도 공유해 줘.',
          { who: 'hayun', text: '그때 신고했는데 결국 누가 만든 건지도 못 찾았잖아.', if: 'e4b=ask|report' },
          'narr: 서아를 비웃은 글은 분명 잘못됐다. 그런데 하윤이의 스토리에는 그 사람이 한 말이 아니라, 그 사람의 이름·학교·동네·얼굴이 있다.'
        ],
        prompt: '어떻게 할까?',
        choices: [
          { id: 'share', text: '하윤이의 스토리를 내 계정에 공유한다.',
            set: { e9: 'share' }, add: { spread: 2, serious: 1 },
            react: ['sys: 내 스토리에 공유됨'], next: 'c3_e9_b' },
          { id: 'critique', text: '“그 글은 비판하되, 이름·학교·얼굴은 내리자”고 하윤이에게 말한다.',
            say: '그 글 진짜 별로인 거 맞아. 근데 이름·학교·얼굴까지 퍼뜨리는 건 다른 문제야. 그건 내리자',
            set: { e9: 'critique' }, add: { minimize: 1 }, next: 'c3_e9_b' },
          { id: 'ask', text: '피해를 입은 서아에게 어떻게 하고 싶은지 먼저 묻는다.',
            set: { e9: 'ask' }, add: { consent: 1 },
            react: [
              { who: 'seoa', text: '…이제 와서 내 생각을 묻는 거야?', if: 'trust.seoa<0' },
              { who: 'seoa', text: '하윤이한테 내 캡처 보낸 거 너였다며. 하윤이가 말해 줬어.', if: 'e3fix=part' },
              'seoa: 나는 그냥 그 글 신고만 하고 싶어. 그 사람 신상이 퍼지면, 나 때문에 일이 커진 것 같잖아.'],
            next: 'c3_e9_b' },
          { id: 'report', text: '후기 글과 신상 스토리를 둘 다 신고하고, 선생님께 알린다.',
            set: { e9: 'report' }, add: { help: 1 },
            react: ['teacher: 잘 알려 줬어. 그 후기 글은 학교에서 상대 학교와도 이야기해 볼게. 하윤이 스토리는 선생님이 하윤이와 따로 이야기할게.',
              'narr: 소문을 퍼뜨린 게 아니라, 막을 수 있는 사람에게만 정확히 알렸다.'],
            next: 'c3_e9_b' }
        ]
      },
      c3_e9_b: {
        chapter: 3, event: 'e9', label: '한 시간 뒤',
        view: { type: 'sns', title: '스냅로그', meta: '스토리' },
        lines: [
          'sys: 오후 12:10',
          { who: 'narr', text: '내 스토리 조회 204회. 그 학생의 다른 사진까지 퍼지기 시작했다.', if: 'e9=share' },
          { who: 'anon', kind: 'post', text: '○○○ 내일 △△학교 앞에서 기다리자 ㅋㅋ', meta: '공유된 스토리에 달린 댓글', if: 'e9=share' },
          { who: 'hayun', text: '…그래도 그냥 넘어가면 억울한데.', if: 'e9=critique|ask' },
          { who: 'narr', text: '서아의 뜻을 하윤이에게 전했다.', if: 'e9=ask' },
          { who: 'narr', text: '하윤이의 스토리는 선생님과 이야기한 뒤 내려갔다. 이미 캡처해 간 사람이 몇 명 있었다.', if: 'e9=report' }
        ],
        prompt: '그다음',
        choices: [
          { id: 'del', if: 'e9=share', text: '스토리를 내리고, 하윤이에게도 내리자고 한다.',
            set: { e9b: 'del' }, add: { repair: 1 },
            react: ['sys: 스토리가 삭제되었습니다', 'hayun: …알았어. 나도 내릴게.',
              'narr: 내렸다. 그사이 캡처해 간 사람이 몇 명인지는 모른다.'], next: '@chapter:4' },
          { id: 'keep', if: 'e9=share', text: '이미 다들 공유했으니 그대로 둔다.',
            set: { e9b: 'none' }, add: { spread: 1 },
            react: ['narr: 공유는 계속 늘었다. 그 학생은 다음 날 학교에 오지 않았다는 소문이 돌았다.'], next: '@chapter:4' },
          { id: 'calm', if: 'e9=critique|ask', text: '하윤이와 함께 “그 글은 신고했고, 사람 찾기는 그만하자”는 글을 반 단톡방에 올린다.',
            set: { e9b: 'calm' }, add: { repair: 1 },
            react: [
              { who: 'hayun', text: '…그래. 네 말이면. 내릴게.', if: 'trust.hayun>=1' },
              { who: 'hayun', text: '알았어, 내릴게. 근데 아직 화나.', if: 'trust.hayun<1' },
              'narr: 하윤이의 스토리가 내려갔다. 이미 퍼 간 사람이 세 명 있었다.'], next: '@chapter:4' },
          { id: 'step', if: 'e9=critique|ask', text: '할 말은 했으니 더 끼어들지 않는다.',
            set: { e9b: 'step' },
            react: ['narr: 하윤이의 스토리는 저녁까지 남아 있었다.'], next: '@chapter:4' }
        ],
        next: '@chapter:4'
      },

      /* ───────── 에필로그 ───────── */
      ep_1: {
        chapter: 4, event: null, label: '축제 다음 주 교실',
        view: { type: 'place', title: '2학년 3반 교실 · 다음 주 월요일' },
        lines: [
          'teacher: 축제 준비하면서 있었던 일들, 오늘은 다 같이 이야기해 볼까 해. 누구를 혼내려는 게 아니야.',
          { who: 'teacher', text: '그날 밤 일은 혼자 감당할 일이 아니었어. 보호자분과 상담 선생님까지 함께 이어 둘게.', if: 'alone_meet' },
          { who: 'teacher', text: '도움을 청한 건 잘한 일이야. 그 덕분에 더 커지기 전에 멈출 수 있었어.', if: 'help>=2' },
          { who: 'minjun', text: '(쉬는 시간) 그때 사진 지워 줘서 고마웠어.', if: 'e2fix=sorry|all' },
          { who: 'narr', text: '민준이는 아직 나와 눈을 잘 마주치지 않는다.', if: 'trust.minjun<0' },
          { who: 'seoa', text: '다음 축제 땐 안내도 한번 해 볼까 생각 중이야. 천천히, 내가 정해서.', if: 'trust.seoa>=1' },
          { who: 'narr', text: '서아와 나 사이에는 아직 어색한 공기가 남아 있다.', if: 'trust.seoa<0' },
          { who: 'dohyun', text: '야, 나 그날 이후로 PC방 가면 로그아웃부터 함 ㅋㅋ', if: 'trust.dohyun>=1' },
          { who: 'narr', text: '도현이와는 예전처럼 장난을 치지 못한다.', if: 'trust.dohyun<0' },
          { who: 'hayun', text: '정산은 다음부터 처음부터 개인톡으로만 받을게.', if: 'e1=propose|dm' },
          { who: 'hayun', text: '나도 그때 신상 올린 거, 다시 생각해 보니 무서웠어. 내가 당했던 거랑 똑같은 거였는데.', if: 'e9b=calm|del || e9=report' },
          'narr: 칠판에 선생님이 한 문장을 적었다. “누가, 누구의 정보를, 누구에게, 어떤 목적으로, 어디까지?”'
        ],
        next: '@ending'
      }
    }
  };

  root.PRIVACY_STORY = STORY;
  if (typeof module !== 'undefined' && module.exports) module.exports = STORY;
})(typeof window !== 'undefined' ? window : globalThis);
