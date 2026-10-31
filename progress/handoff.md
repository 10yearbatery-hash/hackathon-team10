# Handoff

- 갱신: 2026-11-01 04:10, Phase 1 + 아이 영역 피그마 v3 반영 (ADR-013), 세션: 대화형 구현 (하네스 미사용)
- 수용 기준: Phase 1의 12개 모두 passes=true (`plan/acceptance.json`)

## 현재 상태

시연 범위 전체가 동작한다. `npm run verify` 통과 (단위 15, e2e 3).

- 온보딩 O1~O9, 아이 C1~C6·C8~C10, 부모 P1~P7을 `docs/유저저니.md` 6장대로 만들었다.
- 스타일은 피그마 "펭귄 퀘스트" Page 2 (file key `3JVOn5eZZgC25bgANGBBT7`)에서 가져왔다 (ADR-012).
- 규칙은 `src/core/rules.ts`, 웹 기능은 `src/platform/`에 나눴다 (ADR-002).
- e2e는 Chrome 가짜 카메라로 녹화·사진·부모 재생까지 확인했다. 실기기는 아직이다.

## 이번에 내린 결정

- ADR-013: 아이 영역을 피그마 v3로 교체. 홈은 10개 장 그림 지도(1일이 맨 위), 단계 팝업은 DAY 카드, 나머지 아이 화면은 V3. 별·보물 보상은 표시만 한다.

- ADR-010: 지금 단계의 인증이 실패하면 단계를 내리지 않는다 (미션 여러 개일 때 막힘 방지). 사용자 확인 필요.
- ADR-012: 흐름은 유저저니, 색·모양·글꼴은 피그마.
- 시연용 초기화는 부모 홈 맨 아래 "시연용: 처음 상태로 되돌리기" (PRD 9장의 미정 항목).
- 장 이름 10개는 임시 (`src/core/model.ts`의 `CHAPTER_NAMES`). 1장만 피그마의 "눈꽃 마을".

## 다음 세션이 할 일 (Phase 2)

1. HTTPS로 배포하고(사람) 아이폰 Safari, 안드로이드 Chrome에서 시연 시나리오를 끝까지 해 본다. 특히 MediaRecorder 녹화(iOS는 mp4)와 부모 화면 재생.
2. 촬영 화면 위쪽 펭귄 영상의 반복 이음새, 별 마크 가림 확인.
3. 오프라인 시연이 필요하면 Jua 글꼴을 `public/`에 넣는다 (지금은 Google Fonts).
4. 실패 안내(C8)의 "N단계 → N-1단계" 표시는 ADR-010의 "내려가지 않는 경우"에도 같은 문구가 나온다. 미션 여러 개를 시연할 거면 고친다.

## 주의할 점

- 저장소 루트의 `남자펭귄.mp4`, `납치.mp4`는 커밋하지 않았다. `납치.mp4`는 온보딩 영상으로 쓰고 있다. `남자펭귄.mp4`는 아직 쓰지 않는다.

- C 드라이브 여유 공간이 거의 없다 (2026-11-01 기준 약 200MB). e2e는 `TEMP`/`TMP`를 `D:\claude-tmp`로, `--output=/d/claude-tmp/pw-results`로 돌렸다.
- `public/media/intro.mp4`는 사용자가 세로로 다시 만든 `납치.mp4`(406x720, 저장소 루트, 커밋 안 함), `public/media/hero_look.mp4`는 `assets/character/hero/video/hero_look_idle.mp4`의 사본이다. 원본을 바꾸면 사본도 바꾼다.
- `public/char/hero_*.png`는 피그마 캐릭터 시트(투명)에서 포즈별로 자른 것이다.
- 독립 리뷰(`harness/prompts/review.md`)는 돌리지 않았다.
