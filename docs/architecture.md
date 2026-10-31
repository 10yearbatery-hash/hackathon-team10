# 아키텍처

- 상태: 확정 (해커톤 시연용 1차). 구현하면서 실제 구조와 달라지면 같은 커밋에서 이 문서를 고친다.
- 결정의 이유는 `docs/adr.md`에 있다. 여기에는 "무엇을"만 적는다.

## 1. 실행 모델

```
폰 브라우저 (세로 화면, 폰 1대를 아이와 부모가 나눠 씀)
 └─ 정적 웹앱 (Vite 빌드 결과 dist/)
     ├─ React 화면 (해시 주소: #/home, #/shop, #/parent ...)
     ├─ core/  규칙 계산 (순수 TypeScript, React 없음)
     └─ platform/  웹 전용 기능 감싸기
          ├─ 상태 JSON  → localStorage("penguin-adventure/v1")
          ├─ 인증 사진·영상 → IndexedDB("penguin-adventure", 저장소 "media")
          ├─ 카메라 → getUserMedia + MediaRecorder
          └─ 효과음 → Web Audio (음원 파일 없음)
```

서버가 없다 (ADR-003). 부모 영역은 같은 폰에서 PIN으로 나눈다 (ADR-007).

## 2. 기술 스택

| 영역 | 선택 | 메모 |
|---|---|---|
| 화면 | React 19 + Vite 8 + TypeScript | CSS 한 파일 (`src/styles.css`), 스타일 방식 하나로 통일 (ADR-002) |
| 화면 이동 | 자체 해시 라우터 (`src/app/router.ts`) | 의존성 없이 정적 호스팅에서 새로고침·뒤로 가기 동작 |
| 상태 | 자체 store (`useSyncExternalStore`) | 변경은 `core/rules.ts`의 순수 함수로만 |
| 글꼴 | Google Fonts의 Jua(아이 화면 제목·버튼), Noto Sans KR | 인터넷이 없으면 시스템 글꼴로 대체 (ADR-012) |
| 단위 테스트 | Vitest | `src/**/*.test.ts` |
| E2E | Playwright (시스템 Chrome, Pixel 7, 가짜 카메라) | 카메라 실기기 확인은 따로 필요 |

런타임 의존성은 `react`, `react-dom` 두 개뿐이다. 새 런타임 의존성을 추가하면 ADR에 이유를 남긴다.

## 3. 폴더 구조

```
src/
  main.tsx, App.tsx          # 진입점, 화면 고르기와 들어갈 수 있는지 확인
  styles.css                 # 공통 스타일, 온보딩·부모 영역 (부모: 연보라·보라)
  v3.css                     # 피그마 v3 아이 영역: 지도, DAY 카드, V3 화면 (ADR-013)
  ob.css                     # 부모 설정 온보딩 O4~O7 (피그마 V3/O4~O7, ADR-016). 모든 규칙이 .ob 안에서만 적용
  core/
    model.ts                 # 상태 타입, 기본 미션 5개, 기본 선물 4개, 상수
    rules.ts                 # 규칙 계산과 상태 변경 (R-xx)
    rules.test.ts
  platform/
    storage.ts               # localStorage + IndexedDB, 처음 상태로 되돌리기
    camera.ts                # 카메라 켜기, 사진 찍기, 정해진 길이 녹화
    sound.ts                 # 효과음
  app/
    store.ts                 # 상태 보관, 화면 사이에 넘기는 값(handoff)
    router.ts                # 해시 라우터
  ui/
    parts.tsx                # 캐릭터, 코인 칩, 아래 탭, 키패드, 팝업, 반짝이
    MapPath.tsx              # 10개 장 그림 지도와 1~100 발판 (피그마 02A·02B 좌표)
    icons.tsx                # Lucide 선 아이콘
  screens/
    onboarding/Onboarding.tsx  # O1~O7
    kid/   Home(C1, C2, C8), Capture(C3, O8), Clear(C4, C5, O9), Shop(C9, C10)
    parent/Parent.tsx          # P1~P7
public/
  char/                      # 캐릭터 이미지 (피그마 캐릭터 시트에서 포즈별로 자름, 공주·여우 전신)
  map/                       # 장별 지도 그림 ch1~10.jpg, 발판·별·발자국 SVG, 지도용 펭귄 (피그마에서 받음)
  media/intro.mp4            # 온보딩 납치 영상, 세로 406x720 (사용자가 폰 화면용으로 다시 만든 납치.mp4 사본, 화면을 꽉 채워 재생)
  media/hero_look.mp4        # 촬영 화면 위쪽 펭귄 영상 (assets/character/hero/video 사본)
e2e/                         # Playwright 스펙, screenshots/ (git 제외)
```

## 4. 데이터 모델

`src/core/model.ts`의 `AppState`. localStorage 키 `penguin-adventure/v1`에 JSON으로 저장한다.

```ts
{
  version: 1,
  onboarded: boolean,          // 온보딩 첫 미션 제출까지 마쳤는가
  pin: "1234", childName: "하늘", subscribed: boolean,
  missions: [{ id: "brush" | "wash" | "vitamin" | "book" | "pack", seconds }],  // 무료는 1개
  stage: 1..100,               // 캐릭터가 서 있는 단계
  restDate: "YYYY-MM-DD" | null,  // 이 날 단계를 다 깼다 = 지금 단계는 "내일 만나자"
  proofs: [{ id, missionId, missionName, kind: "video" | "photo", stage, date, at,
             status: "clear" | "ok" | "fail", failSeen }],
  gifts: [{ id, name, icon, price }],            // 4개 고정
  purchases: [{ id, giftId, name, icon, price, at, given }]
}
```

인증 사진·영상은 IndexedDB에 인증 id를 키로 저장한다. 코인 잔액은 저장하지 않고 계산한다 (5장).

## 5. 계산 값

`src/core/rules.ts`

| 값 | 계산 |
|---|---|
| 코인 | 10 × (실패가 아닌 인증 수) − Σ 구매 가격. 마이너스 가능 (R-06, R-08, R-09) |
| 쉬는 중 | `restDate`가 오늘(기기 현지 날짜)이면 지금 단계는 "내일 만나자" (R-01) |
| 미션 카드 | 지금 단계에 실패가 아닌 인증이 있으면 완료, 실패만 있으면 다시 해보자, 없으면 아직 |
| 확인할 인증 | status가 clear인 인증, 오래된 것부터 |
| 다음 선물까지 | 가장 싼 선물 가격 − 코인 |
| 장 | ⌈단계 ÷ 10⌉. 장 이름은 임시 (R-03 미정) |

## 6. 상태 전이

```
인증:  제출 --> [clear] --부모 성공--> [ok]
                  └--부모 실패--> [fail]  캐릭터 한 단계 아래로(지금 단계의 인증이면 그대로, ADR-010),
                                          쉬는 상태 해제, 아이 화면에 C8, 카드는 "다시 해보자"
단계:  지금 단계 미션 전부 완료 --> stage+1, restDate=오늘 --자정--> 다음 단계 열림
선물:  구매(코인 즉시 차감) --> given=false --부모 "줬어요"--> given=true
```

## 7. 화면 이동 구조

| 경로 | 화면 | 비고 |
|---|---|---|
| `#/start` | O1 시작 | 온보딩 전에는 모든 주소가 여기로 |
| `#/intro` | O2 온보딩 영상 | 끝나면 자동으로 O3 |
| `#/descent` | O3 하강 연출 | |
| `#/handoff` | O4 부모님께 폰 넘기기 | |
| `#/setup/pin`, `#/setup/name`, `#/setup/mission` | O5~O7 | O7 "선택"에서 한 번에 저장 |
| `#/first/:missionId` | O8 첫 미션 | C3와 같은 화면 + "엄마 아빠랑 같이 해봐요!" |
| `#/home` | C1 길, C2 단계 팝업, C8 다시 해보자 | C2와 C8은 같은 화면 위의 겹침 |
| `#/capture/:missionId` | C3 촬영 | |
| `#/clear/:proofId` | C4 기쁨 → C5 코인 (O9 포함) | 확인 후 홈에서 C6 걸어 올라가기 |
| `#/shop` | C9 상점, C10 구매 팝업 | |
| `#/parent/pin` | P1 PIN | 통과 여부는 메모리에만. 아이 영역으로 나가면 다시 잠김 |
| `#/parent` | P2 부모 홈 | 시연용 "처음 상태로 되돌리기" 포함 |
| `#/parent/review` | P3 인증 확인 | 한 건씩, 실패는 확인 팝업 |
| `#/parent/gifts` | P4 구매한 선물 | |
| `#/parent/missions` | P5 미션 관리 | |
| `#/parent/shop` | P6 선물 관리 | |
| `#/subscribe` | P7 구독 안내, 가짜 결제 | O7과 P5에서도 들어옴 |

## 8. 핵심 기능 설계

### 촬영 (C3)
- 위쪽은 말풍선 한 줄과 `hero_look.mp4` 칸(화면 높이의 약 27%, 190~250px)이다. 영상은 소리 없이 반복 재생하고, 가로 135%로 키워 오른쪽 아래 별 마크를 밖으로 내보낸다. 영상 맨 위를 기준으로 잘라 머리 깃털부터 가슴까지 보인다 (ADR-005, ADR-016).
- 아래는 전면 카메라(480×640 정도, 15fps). 카메라가 켜지기 전에는 촬영 버튼이 꺼져 있다.
- 영상 미션: [시작]을 누르면 정한 초만큼 녹화하고 자동으로 멈춘다(300kbps webm). 남은 시간 막대가 줄어든다.
- 사진 미션: [찍기]로 JPEG(긴 변 640px, 품질 0.7)를 만들고 미리보기와 [다시 찍기]를 보여준다.
- 제출 버튼은 인증이 있어야 켜진다. 저장(IndexedDB)이 실패해도 아이의 진행은 막지 않는다.

### 지도 (C1, O3)
- 피그마 지도 한 장은 390×1460이고 10장을 위에서 아래로 잇는다(1일이 맨 위). 전체를 피그마 좌표 그대로 그린 뒤 화면 폭에 맞춰 `transform: scale`로 한 번에 줄이거나 키운다.
- 발판 10개의 좌표는 모든 장이 같다. 장마다 그림, 발자국, 발판 재질, 말풍선, 다음 목적지 문구만 다르다 (`core/model.ts`의 `CHAPTERS`).
- 단계 모양: 완료(초록 체크), 지금(빛나며 둥실, 펭귄이 서 있음), 내일 만나자(달 배지, 펭귄이 쉼), 잠김(흐리게). 5일은 별 발판, 10일은 보물 발판.
- 헤더의 장 이름은 지금 화면에 보이는 장을 따라 바뀐다.
- O3은 같은 지도를 맨 아래(마법성)에서 1일까지 약 5.6초 동안 자동 스크롤한다.
- C6은 홈에 돌아올 때 펭귄을 이전 발판에서 다음 발판으로 옮기는 CSS 전환과 점프로 만든다.

### 연타와 뒤로 가기
- 같은 인증 id, 이미 완료한 미션, 쉬는 중의 제출은 규칙 함수가 막는다.
- 제출 뒤 `replace`로 이동해서 뒤로 가기로 촬영 화면에 돌아가지 않는다.

## 9. 환경별 제약

- 카메라는 HTTPS 또는 localhost에서만 열린다. 배포 주소는 HTTPS여야 한다.
- iOS Safari의 MediaRecorder는 mp4로 녹화한다. 실기기에서 녹화·재생을 확인해야 한다 (N-03, 아직 못 함).
- 폰 브라우저는 첫 터치 전에 소리를 막는다. O1 "시작"에서 소리를 연다 (N-04).
- 저장은 브라우저별이다. 다른 브라우저나 시크릿 창에서는 데이터가 없다.

## 10. 검증 명령

| 명령 | 하는 일 |
|---|---|
| `npm run dev` | 개발 서버 (`--host`, 같은 와이파이 폰에서 접속. 카메라는 localhost가 아니면 HTTPS가 필요) |
| `npm run test:unit` | Vitest 규칙 테스트 |
| `npm run build` | 타입 검사 + 프로덕션 빌드 (`dist/`) |
| `npm run e2e` | 빌드 결과를 preview로 띄워 Playwright 시나리오 3개 실행, 스크린샷은 `e2e/screenshots/` |
| `npm run verify` | test:unit → build → e2e |

C 드라이브 공간이 부족하면 `TEMP`/`TMP`를 다른 드라이브로 바꾸고 `--output`을 다른 드라이브로 지정해 e2e를 돌린다.

## 11. 시연 방식

- `npm run build` 후 `dist/`를 HTTPS 정적 호스팅(예: Netlify Drop)에 올리고 폰으로 연다.
- 시연 전 부모 홈 맨 아래 "시연용: 처음 상태로 되돌리기"를 누르면 시작 화면부터 다시 할 수 있다.

## 12. 개발 하네스

Phase 단위 `claude -p` 세션으로 개발한다. 구조와 실행법은 `harness/README.md`.
