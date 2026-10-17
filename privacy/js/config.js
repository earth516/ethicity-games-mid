/*
 * 팀 공통 연동 설정 — 공통 캐릭터 이미지가 정해지면 여기만 채운다.
 *
 * characterImages: 공통 캐릭터 코드(ethicity.player.character) → 이미지 경로(이 index.html 기준 상대 경로)
 *   예) 'char_03': '../shared/characters/char_03.png'
 * 매핑이 없는 코드는 임시 아바타(assets/avatar-default.svg)로 표시한다. 임시 아바타는 팀 공식 캐릭터가 아니다.
 *
 * playerLooks: 공통 캐릭터 코드 → 맵 주인공 모습('m' | 'f'). 매핑되면 시작 화면의 모습 고르기를 건너뛴다.
 *   예) 'char_01': 'm', 'char_02': 'f'   — 모습 그림은 assets/sprites/char_player_m.png / char_player_f.png
 */
window.PRIVACY_CONFIG = {
  characterImages: {},
  playerLooks: {},
  defaultAvatar: 'assets/avatar-default.svg',
  defaultNickname: '플레이어'
};
