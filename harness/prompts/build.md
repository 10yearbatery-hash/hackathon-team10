# 빌드 세션 절차

너는 이 프로젝트의 빌더다. 하네스(`harness/run-phase.ps1`)가 Phase 번호 N을 주고 이 파일을 읽게 했다. 이 세션 동안 사람은 대답하지 않는다. 이전 세션의 대화는 남아 있지 않고, 맥락은 아래 파일에만 있다.

## 1. 시작: 맥락 복구

1. `progress/handoff.md`를 읽는다. 직전 세션이 남긴 현재 상태와 주의점이다.
2. `plan/plan.md`에서 Phase N의 목표, 범위, 범위 밖을 읽는다.
3. `plan/acceptance.json`에서 Phase N의 기준을 읽는다. `passes: false`인 기준이 이번 세션의 일이다.
4. `progress/reviews/phase-N.md`가 있고 첫 줄이 `VERDICT: NEEDS_WORK`이면, 그 Blocking 항목을 가장 먼저 처리한다. 관련 기준이 실제로 깨져 있으면 `passes`를 `false`로 되돌린 뒤 고친다.
5. 하네스가 `harness/state/continue.md`를 읽으라고 했다면 그 내용(남은 기준, 실패한 검사 출력)을 우선한다.
6. `git log --oneline -15`로 최근 변경을 본다.
7. 필요한 만큼 `docs/prd.md`, `docs/architecture.md`, `docs/adr.md`, `docs/서비스기획.md`(규칙과 용어), `docs/유저저니.md`(화면 레이아웃은 6장)를 읽는다.

## 2. 작업

- Phase N 범위 안에서 만든다. 다음 Phase 기능이 필요하면 최소한의 자리만 만들고 handoff에 적는다.
- 순서는 스스로 정한다. 기준 하나를 구현, 테스트, 확인까지 닫고 다음으로 가는 방식을 권한다.
- 의미 있는 단위마다 커밋한다. 메시지 형식: `phase N: <무엇을>`. push는 사용자가 요청할 때만 한다.
- 문서에 없는 결정을 내리면 `docs/adr.md`에 ADR을 추가한다. 구조나 데이터 모델이 바뀌면 `docs/architecture.md`를 같은 커밋에서 고친다. 명령이 바뀌면 `CLAUDE.md`의 명령 목록을 고친다.
- 기획과 기준이 충돌하거나 기준이 잘못됐다고 판단되면 기준 문구는 그대로 두고 그 기준의 `notes`에 이유를 쓴 뒤, 기획 의도에 가장 가까운 쪽으로 진행한다.
- 화면을 만들 때는 PRD 10장(디자인 원칙과 피할 것)을 따른다. 스크린샷을 직접 열어 보고, `docs/유저저니.md` 6장 레이아웃과 비교해 고친다.

## 3. 수용 기준 판정 (기본 실패)

- 모든 기준은 `passes: false`로 시작한다.
- 이번 세션에서 직접 관찰한 증거가 있을 때만 `true`로 바꾼다. 증거는 실행한 명령의 출력(통과한 테스트 이름 포함)이나 Read로 열어 본 스크린샷이다.
- UI 기준은 Playwright e2e와 `e2e/screenshots/phase-N/` 스크린샷으로 확인한다.
- `true`로 바꿀 때 `evidence`에 근거를 짧게 쓴다. 예: `e2e/parent.spec.ts '오늘 한 일 일괄 승인' 통과, phase-2/approve.png 확인`.
- `id`, `text`는 바꾸지 않는다. 기준을 지우거나 추가하지 않는다. JSON 문법을 깨뜨리지 않는다.
- 이전 Phase의 기준이 이번 작업으로 깨졌으면 그 기준도 `false`로 되돌리고 고친다.

## 4. 끝내기 전에 (매 세션 반드시)

1. `npm run verify`를 실행해 통과를 확인한다. 하네스도 세션이 끝나면 같은 명령으로 다시 검사하고, 실패하면 출력과 함께 너를 다시 부른다.
2. `plan/acceptance.json`을 갱신한다.
3. `progress/handoff.md`를 아래 형식으로 새로 쓴다(덮어쓰기). 다음 세션은 이 파일을 가장 먼저 읽는다.
4. `progress/log.md` 맨 아래에 이번 세션 항목을 추가한다.
5. 남은 변경을 커밋한다.

### handoff.md 형식

```markdown
# Handoff

- 갱신: YYYY-MM-DD HH:MM, Phase N, 세션: build | fix
- 수용 기준: Phase N  통과 X / 전체 Y  (남은 ID: ...)

## 현재 상태
앱이 지금 어디까지 동작하는지 한 문단. 손으로 시연 가능한 범위.

## 이번 세션에서 한 일
- ...

## 다음 세션이 할 일 (우선순위 순)
1. ...

## 주의할 점
- 임시 처리, 알려진 버그, 함정, 바꾸면 안 되는 것

## 확인 방법
- 실행한 검증 명령과 결과 요약
```

### log.md 항목 형식

```markdown
## YYYY-MM-DD HH:MM · Phase N · build | fix
- 한 일:
- 결정: (추가한 ADR 번호)
- 검증: (명령과 결과)
- 남은 일:
```

## 5. 멈춰도 되는 경우

- Phase N의 모든 기준이 증거와 함께 통과하고 4번을 마쳤을 때.
- 사람만 풀 수 있는 문제(계정 로그인, 결제, 실제 기기 필요)로 막혔을 때. 이때는 `plan/acceptance.json`의 Phase N `blocked`에 이유를 쓰고 4번을 마친다.

그 외의 경우에는 다음 단계를 알리는 요약으로 턴을 끝내지 말고 그 단계를 진행한다.
