# 펭귄 모험 (임시 이름)

5~8세 아이가 생활습관 미션을 사진·영상으로 인증하면 파란 펭귄이 100단계 길을 올라가 공주를 구하러 가는 습관 미션 웹앱(PWA). 폰 1대를 아이와 부모가 나눠 쓴다. 이번 목표는 해커톤 시연(서비스기획 15장)이다.

## 문서 지도

| 파일 | 내용 | 언제 읽나 |
|---|---|---|
| `progress/handoff.md` | 직전 세션이 남긴 현재 상태 | 세션 시작 시 가장 먼저 |
| `plan/plan.md` | Phase별 목표와 범위 | 세션 시작 |
| `plan/acceptance.json` | Phase별 수용 기준 (기본 false) | 세션 시작과 끝 |
| `progress/reviews/phase-N.md` | 독립 리뷰 결과 | 수정 세션 시작 |
| `docs/prd.md` | 기능(F-xx), 규칙(R-xx), 시드, 디자인 원칙 | 기능을 만들거나 판단이 필요할 때 |
| `docs/서비스기획.md` | 서비스 개요, 용어, 미션, 진행 규칙, 상태 전이, MVP 범위 | 기능과 규칙을 판단할 때 |
| `docs/유저저니.md` | 하루 저니, 화면 이동 흐름, 화면별 레이아웃(6장) | 화면을 만들 때 |
| `docs/architecture.md` | 스택, 폴더, 데이터 모델, 검증 명령 | 코드를 쓰기 전 |
| `docs/adr.md` | 결정 기록 | 결정을 내리거나 뒤집기 전 |
| `progress/log.md` | 세션별 작업 기록 (추가만) | 과거 맥락이 필요할 때 |

`claude -p`로 Phase를 진행할 때의 절차는 `harness/prompts/build.md`(빌드)와 `harness/prompts/review.md`(리뷰)에 있다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm install` | 의존성 설치 (처음 한 번) |
| `npm run dev` | 개발 서버, 같은 와이파이 폰에서도 접속 (카메라는 HTTPS 필요) |
| `npm run test:unit` | Vitest 규칙 테스트 |
| `npm run build` | 타입 검사 + 프로덕션 빌드 (`dist/`) |
| `npm run preview` | 빌드 결과를 로컬에서 확인 (`dist/index.html`을 파일로 열면 동작하지 않음) |
| `npm run e2e` | Playwright 시나리오 (빌드 결과를 preview로 띄움, 시스템 Chrome, 가짜 카메라) |
| `npm run verify` | test:unit → build → e2e |

## 규칙

- 규칙 계산(코인, 단계, 실패)은 `src/core/`의 순수 TypeScript로만 한다. React와 브라우저 기능을 넣지 않는다 (ADR-002). 코인 잔액은 저장하지 않고 계산한다.
- 카메라, 저장소, 소리는 `src/platform/`의 함수로만 쓴다.
- 아이 화면은 글씨를 줄이고 큰 버튼(최소 48px, 주요 버튼 56px 이상)으로 만든다. 실패는 "다시 해보자"와 응원하는 캐릭터로만 보인다 (PRD 10장).
- 화면 흐름은 `docs/유저저니.md`, 색과 모양은 피그마 디자인을 따른다 (ADR-012).
- 새 런타임 의존성을 넣으면 `docs/adr.md`에 이유를 남긴다.
- 구현이 문서와 달라지면 같은 커밋에서 문서를 고친다.
- 배포, 외부 계정 연결, git config 변경은 하지 않는다. 사람 몫이다. (git push는 사용자가 요청하면 한다.)
