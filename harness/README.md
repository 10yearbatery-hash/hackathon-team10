# 개발 하네스 (claude -p)

Phase 하나를 `claude -p` 세션이 맡아 끝까지 만들고, 코드를 쓰지 않은 새 세션이 리뷰한다. 세션 사이의 맥락은 파일과 git 커밋으로만 넘긴다. 설계 이유는 `docs/adr.md`의 ADR-011.

## 구조

```
harness/
├── run-phase.ps1        # 실행 스크립트 (세션 실행, 게이트, 이어서 하기, 커밋, 리뷰)
├── prompts/build.md     # 빌드/수정 세션 절차
├── prompts/review.md    # 리뷰 세션 절차와 보고 형식
├── logs/                # 세션별 stream-json 로그 (git 제외)
└── state/continue.md    # 미완료 시 하네스가 세션에 넘기는 메모 (git 제외)

plan/plan.md             # Phase 목표와 범위
plan/acceptance.json     # 수용 기준 (기본 false, 빌더가 증거와 함께 true로)
progress/handoff.md      # 현재 상태 (세션마다 덮어씀)
progress/log.md          # 세션 기록 (추가만)
progress/reviews/        # 리뷰 결과 phase-N.md (첫 줄 VERDICT)
CLAUDE.md                # 모든 세션이 자동으로 읽는 프로젝트 규칙과 문서 지도
.claude/settings.json    # 허용/금지 명령
```

## 한 Phase가 진행되는 순서

```
[checkpoint 커밋]
   -> 빌드 세션 (새 컨텍스트, build.md)
   -> 게이트: npm run verify + acceptance.json 남은 기준 확인
        미완료면 continue.md를 써서 같은 세션 이어서 하기 (최대 2회)
        blocked면 멈춤
   -> 커밋
   -> 리뷰 세션 (새 컨텍스트, Edit 금지, review.md) -> progress/reviews/phase-N.md
        PASS면 끝
        NEEDS_WORK면 수정 세션(새 컨텍스트) -> 게이트 -> 커밋 -> 다시 리뷰 (최대 2회)
```

## 준비 (한 번만)

1. **Git for Windows 설치**: 체크포인트 커밋과 되돌리기에 필요하다. Windows의 Claude Code는 Git Bash로 셸 명령을 실행하므로 설치해 두는 편이 안정적이다.
   ```powershell
   winget install --id Git.Git -e --source winget
   ```
   설치 후 터미널을 새로 열고 이름과 이메일을 설정한다.
   ```powershell
   git config --global user.name  "이름"
   git config --global user.email "메일"
   ```
2. **Claude Code 최신화와 로그인**: `opus` 별칭이 최신 Opus(5.5)를 가리키게 한다.
   ```powershell
   claude update
   claude          # 한 번 실행해 로그인, /model 로 Opus 5.5 확인 후 종료
   ```
3. Node.js 20 이상 (현재 PC는 v24).

## 실행

프로젝트 루트에서:

```powershell
# Phase 1 하나
powershell -ExecutionPolicy Bypass -File harness/run-phase.ps1 -Phase 1

# Phase 2부터 6까지 이어서 (중간에 실패하면 거기서 멈춤)
powershell -ExecutionPolicy Bypass -File harness/run-phase.ps1 -Phase 2 -Through 6
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `-Model` | `opus` | 세션 모델 |
| `-BuildEffort` | `medium` | 빌드 세션 effort. Opus 5.5 권장 시작값. 어려운 Phase(예: 4)는 `high` |
| `-ReviewEffort` | `high` | 리뷰 세션 effort. 놓치기 쉬운 경우를 찾는 일이라 높게 |
| `-PermissionMode` | `auto` | 분류기가 위험한 동작만 막는다. 플랜에서 auto를 못 쓰면 `acceptEdits` (`.claude/settings.json` 허용 목록 안의 명령만 실행) |
| `-MaxContinuations` | `2` | 미완료 시 같은 세션 이어서 하기 횟수 |
| `-MaxFixRounds` | `2` | 리뷰 NEEDS_WORK 후 수정 세션 횟수 |
| `-MaxBudgetUsd` | `0` (제한 없음) | 세션당 비용 상한 |
| `-SkipReview` | 꺼짐 | 리뷰 생략 (시간이 급할 때) |
| `-SkipGate` | 꺼짐 | `npm run verify` 게이트 생략 (권장하지 않음) |

## 지켜보기, 멈추기, 이어 하기

- 진행 상황은 터미널에 요약이 찍힌다(모델의 메모, 사용한 도구). 전체 로그는 `harness/logs/`.
- 다른 터미널에서 현재 상태 보기: `Get-Content progress/handoff.md`, `git log --oneline -10`
- 멈추기: `Ctrl+C`. 같은 Phase를 다시 실행하면 새 세션이 `handoff.md`와 `acceptance.json`을 읽고 남은 기준부터 이어 간다.
- 되돌리기: Phase마다 커밋이 있으므로 `git log`로 지점을 찾아 되돌린다. 되돌리기 전에 팀과 상의한다.

## 사람이 개입할 때

- **blocked로 멈춤**: `plan/acceptance.json`의 해당 Phase `blocked`에 이유가 있다. 해결한 뒤 `null`로 바꾸고 다시 실행한다.
- **방향을 바꾸고 싶을 때**: `docs/prd.md`나 `plan/plan.md`를 고치고, 결정이면 `docs/adr.md`에 추가한 뒤 다시 실행한다. 이미 통과한 기준을 다시 만들게 하려면 `passes`를 `false`로 바꾼다.
- **대화형으로 직접 작업할 때**: 루트에서 `claude`를 열고 `Phase 3. harness/prompts/build.md를 따라 진행해`라고 하면 같은 절차로 일한다.

## 문제 해결

- **스크립트 실행이 막힘**: 위 명령처럼 `-ExecutionPolicy Bypass`를 붙인다.
- **한글이 깨져 보임**: 터미널 표시 문제다. 파일은 UTF-8로 저장된다. Windows Terminal을 쓰면 대부분 해결된다.
- **`--permission-mode auto` 오류**: 플랜이나 버전에서 auto 모드를 지원하지 않는 경우다. `claude update` 후 다시 시도하거나 `-PermissionMode acceptEdits`로 실행한다.
- **게이트가 계속 실패**: `harness/state/continue.md`에 마지막 출력이 있다. 같은 실패가 반복되면 직접 `npm run verify`를 돌려 원인을 본다.
- **모델이 바뀌었을 때**: 하네스의 구성 요소(이어서 하기, 리뷰, 게이트)를 하나씩 꺼 보며 아직 필요한지 다시 확인한다.
