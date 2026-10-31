# 캐릭터 에셋 기록

캐릭터와 관련 이미지, 영상의 출처와 만든 방법을 기록한다. 새 파일을 추가하면 아래 표에 한 줄을 추가한다.

## 캐릭터와 폴더

캐릭터마다 폴더가 하나씩 있다. 파일 이름 앞에도 같은 id를 붙여서 폴더 밖에서도 누구 것인지 알 수 있다.

| id | 캐릭터 | 폴더 |
|---|---|---|
| `hero` | 파란 펭귄 (주인공) | `hero/` |
| `heroine` | 분홍 펭귄 + 리본 (여자 주인공) | `heroine/` |
| `villain` | 흰 여우 + 보라 망토 (악당) | `villain/` |

캐릭터 폴더 안의 구조는 모두 같다.

| 폴더 | 내용 |
|---|---|
| `source/` | 사람이 만든 원본 그림 (PNG). 수정하지 않는다 |
| `generated/` | AI로 새로 만든 이미지 (연두 배경의 부품 시트 등) |
| `cutout/full/` | 배경을 지운 **전신 투명 PNG**. 스테이지 길 위의 캐릭터와 연출 화면에 쓴다 |
| `cutout/parts/` | 부위별로 자른 투명 PNG. Rive나 부분 움직임에 쓴다 |
| `video/` | 캐릭터 영상. 촬영 화면에서 캐릭터가 지켜보는 칸에 쓴다 |
| `previews/` | 원본과 결과물을 나란히 놓은 비교 이미지 |

공용 폴더

| 폴더 | 내용 |
|---|---|
| `prompts/` | 부품 시트를 만들 때 Codex(ChatGPT 이미지 생성)에 준 요청문. 다른 캐릭터에 재사용한다 |
| `tools/` | 배경 제거와 부품 자르기 스크립트 (아래 "도구" 참고) |

## 이름 규칙

- 부품: `<id>_<부품>_<l|r>.png` 예: `hero_wing_l.png`. 왼쪽/오른쪽은 화면에서 보이는 방향이다
- 전신: `<id>_full.png`
- 영상: `<id>_<동작>_<상태>.mp4` 예: `hero_look_idle.mp4`
- 영어 소문자와 밑줄만 쓴다. 한글, 띄어쓰기, 대문자는 쓰지 않는다 (웹 주소에서 깨지지 않게)

## 파일 기록

### hero (파란 펭귄)

| 파일 | 만든 방법 | 원본 또는 프롬프트 | 날짜 | 비고 |
|---|---|---|---|---|
| `hero/source/hero_penguin_sheet.png` | 사용자 제공 | 전신 1개와 얼굴 컷 2개가 한 장에 있음 | 2026-10-31 | 채팅 첨부 사본이라 배경이 흰색(불투명). 원본 파일은 따로 확인 필요 |
| `hero/generated/hero_penguin_sheet1_body.png` | Codex(ChatGPT 이미지 생성) | 기준: 위 원본의 큰 펭귄. 요청문: `prompts/hero_parts_sheet1_body.txt` | 2026-10-31 | 몸 부품 7개를 연두색(#00FF00) 배경에 분해한 시트. 머리가 원본보다 납작하고 깃털이 2장 |
| `hero/generated/hero_penguin_sheet2_face.png` | Codex(ChatGPT 이미지 생성) | 기준: 큰 펭귄 + 몸 시트. 요청문: `prompts/hero_parts_sheet2_face.txt` | 2026-10-31 | 얼굴 부품 8개 시트. 크기 비율을 요청문에 적지 않아서 몸 시트보다 약 1.9배 크게 그려짐(눈 흰자 폭이 머리 폭의 54%). 사용할 때 줄여야 함. 눈 흰자 안에 원본에 없는 곡선이 있고 아랫부리는 입 벌린 모양 |
| `hero/cutout/parts/hero_*.png` (15개) | 위 두 시트에서 연두 배경을 지우고 부품별로 자름 (`tools/cut_parts.py`) | | 2026-10-31 | 몸 7개(head, body, wing_l/r, foot_l/r, tuft), 얼굴 8개(eye_white_l/r, pupil_l/r, brow_l/r, beak_top, beak_bottom). 가장자리 반투명이 거의 없어 확대하면 거칠 수 있음 |
| `hero/cutout/full/hero_full.png` | 원본의 큰 펭귄 영역을 잘라 바깥 흰 배경만 지움 (`tools/cutout_full.py`, 허용오차 45, 깎기 2) | | 2026-10-31 | 785x1126. 어두운 바탕과 밝은 바탕 위에서 테두리 찌꺼기 없음을 눈으로 확인 |
| `hero/video/hero_look_idle.mp4` | 사용자 제공 (제작 도구 미확인). 원래 이름 `펭귄_보는_영상.mp4` | 정면을 바라보다 고개를 기울이고 윙크하며 시선을 옮기는 영상 | 2026-10-31 | H.264+AAC, 1280x720, 4.03초, 24fps, 679KB. 욕실 배경이 영상에 포함(불투명). 소리 트랙 있음(평균 -25dB). 오른쪽 아래에 작은 별 모양 마크가 있음(웹에서는 가로로 확대해 가림). 처음과 끝 프레임 유사도 0.87이라 반복 재생 때 약간 튐 |
| `hero/generated/onboarding/hero_onboarding_o1_welcome_jump.png` | Codex 이미지 생성 | `hero/source/hero_penguin_sheet.png`, `hero/cutout/full/hero_full.png` | 2026-11-01 | 빙하루 온보딩 O1, 반가운 점프. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_o2_story_peek.png` | Codex 이미지 생성 | 위 두 원본 | 2026-11-01 | O2, 모험을 내다보는 모습. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_o4_parent_guide.png` | Codex 이미지 생성 | 위 두 원본 | 2026-11-01 | O4와 부모 설정 상태, 안내하는 모습. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_o6_name_greeting.png` | Codex 이미지 생성 | 위 두 원본 | 2026-11-01 | O6, 이름을 부르며 인사. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_o7_mission_choose.png` | Codex 이미지 생성 | 위 두 원본 | 2026-11-01 | O7, 첫 미션 선택. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_o8_brush_simple.png` | Codex 이미지 생성 | 위 두 원본 | 2026-11-01 | O8 양치 기록 상태, 칫솔 든 모습. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_o9_success_jump.png` | Codex 이미지 생성 | 위 두 원본 | 2026-11-01 | O9 및 제출 완료 상태, 환호하는 점프. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_mission_brushing.png` | Codex 이미지 생성 | 위 두 원본 | 2026-11-01 | O8 양치 미션 상세, 칫솔과 세면대. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_mission_handwashing.png` | Codex 이미지 생성 | 위 두 원본 | 2026-11-01 | O8 손 씻기 미션 상세, 물과 거품. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_mission_vitamin.png` | Codex 이미지 생성 | 파란 펭귄 원본과 기존 양치·손 씻기 미션 그림 | 2026-11-01 | 비타민 먹기, 비타민 병과 알약. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_mission_reading.png` | Codex 이미지 생성 | 위와 같음 | 2026-11-01 | 책읽기, 펼친 그림책. 투명 PNG |
| `hero/generated/onboarding/hero_onboarding_mission_packing.png` | Codex 이미지 생성 | 위와 같음 | 2026-11-01 | 준비물 챙기기, 가방에 학용품 넣기. 투명 PNG |

### heroine (분홍 펭귄)

| 파일 | 만든 방법 | 원본 또는 프롬프트 | 날짜 | 비고 |
|---|---|---|---|---|
| `heroine/source/heroine_penguin.png` | 사용자 제공 | 리본, 인사하는 자세 | 2026-11-01 | 배경이 투명한 원본(1145x1374)으로 교체함. 이전의 검정 배경 사본은 git 기록에 있음 |
| `heroine/generated/heroine_penguin_sheet1_body.png` | Codex(ChatGPT 이미지 생성) | 기준: `heroine/source/heroine_penguin.png`. 요청문: `prompts/heroine_parts_sheet1_body.txt` | 2026-10-31 | 몸 부품 8개(머리 바탕, 몸통, 날개 2, 발 2, 깃털, 리본)를 연두 배경에 분해한 시트 |
| `heroine/generated/heroine_penguin_sheet2_face.png` | Codex(ChatGPT 이미지 생성) | 기준: 원본 + 몸 시트. 요청문: `prompts/heroine_parts_sheet2_face.txt` | 2026-10-31 | 얼굴 부품 8개 시트. 요청문에 크기 비율을 적어서 눈 흰자 폭이 머리 폭의 34%(속눈썹 포함)로 나옴. 눈 흰자 안은 비어 있음 |
| `heroine/cutout/parts/heroine_*.png` (16개) | 위 두 시트에서 연두 배경을 지우고 부품별로 자름 (`tools/cut_parts.py`, 규칙 heroine1, heroine2) | | 2026-10-31 | 몸 8개(head, body, wing_l/r, foot_l/r, tuft, ribbon), 얼굴 8개(eye_white_l/r, pupil_l/r, brow_l/r, beak_top, beak_bottom). 연두색 잔여 0개 |
| `heroine/cutout/full/heroine_full.png` | 투명 원본을 그림 영역에 맞춰 자름 | 기준: `heroine/source/heroine_penguin.png` | 2026-11-01 | 1129x1275. 어두운 바탕과 밝은 바탕 위에서 확인 |

### villain (흰 여우)

| 파일 | 만든 방법 | 원본 또는 프롬프트 | 날짜 | 비고 |
|---|---|---|---|---|
| `villain/source/villain_fox.png` | 사용자 제공 | 보라 망토, 비스듬한 자세. 같은 디자인을 다듬어 다시 받은 두 번째 버전으로 교체함 | 2026-11-01 | 배경이 투명한 원본(1254x1254)으로 교체함. 첫 버전은 커밋 8417e0e에 있음 |
| `villain/generated/villain_fox_sheetA_core.png` | Codex(ChatGPT 이미지 생성) | 기준: `villain/source/villain_fox.png`. 요청문: `prompts/villain_parts_sheetA_core.txt` | 2026-10-31 | 핵심 부품 6개(머리 바탕, 귀 2, 몸통, 꼬리, 금색 장식). 머리와 몸통을 정면 대칭으로 다시 그림 |
| `villain/generated/villain_fox_sheetB_limbs_cape.png` | Codex(ChatGPT 이미지 생성) | 기준: 원본 + 시트 A. 요청문: `prompts/villain_parts_sheetB_limbs_cape.txt` | 2026-10-31 | 팔 2, 다리 2, 망토 5개. 망토에 금색 장식이 이미 붙어 있어 시트 A의 장식과 중복 |
| `villain/generated/villain_fox_sheetC_face.png` | Codex(ChatGPT 이미지 생성) | 기준: 원본 + 시트 A. 요청문: `prompts/villain_parts_sheetC_face.txt` | 2026-10-31 | 얼굴 부품 8개(눈 흰자 2, 홍채 2, 눈썹 2, 코, 입). Codex가 첫 결과가 목표보다 약 2배 크다고 스스로 점검해 재생성함. 눈 흰자 폭이 머리 폭의 24% |
| `villain/cutout/parts/villain_*.png` (19개) | 위 세 시트에서 연두 배경을 지우고 부품별로 자름 (`tools/cut_parts.py`, 규칙 villainA, villainB, villainC) | | 2026-10-31 | 핵심 6개(head, ear_l/r, torso, tail, clasp), 팔다리·망토 5개(arm_l/r, leg_l/r, cape), 얼굴 8개(eye_white_l/r, pupil_l/r, brow_l/r, nose, mouth). 홍채 부품 이름은 다른 캐릭터와 같게 pupil로 통일 |
| `villain/cutout/full/villain_full.png` | 투명 원본을 그림 영역에 맞춰 자름 | 기준: `villain/source/villain_fox.png` | 2026-11-01 | 1253x1217. 어두운 바탕과 밝은 바탕 위에서 확인 |

## 도구

Python과 Pillow가 필요하다. 이 PC에는 설치되어 있다. 프로젝트 폴더가 파이썬 경로에 섞이지 않도록 `-P` 옵션을 쓴다.

```
# 단색 배경의 캐릭터 그림에서 바깥 배경만 지워 투명 PNG로 (허용오차 깎을픽셀 [x0,y0,x1,y1])
python3 -P assets/character/tools/cutout_full.py 입력.png 출력.png 60 1

# 연두 배경의 부품 시트를 부품별 투명 PNG로 (시트 출력폴더 이름규칙 미리보기 캐릭터id)
python3 -P assets/character/tools/cut_parts.py 시트.png 출력폴더 heroine1 미리보기.png heroine
```

`cut_parts.py`의 이름 규칙은 시트마다 부품이 놓인 위치에 맞춰져 있다. 지금 있는 규칙은 `sheet1`, `sheet2`(파란 펭귄 몸·얼굴), `heroine1`, `heroine2`(분홍 펭귄), `villainA`, `villainB`, `villainC`(여우)이다. 새 시트는 규칙이 없어서, 규칙에 맞지 않는 덩어리는 `unknown_N`으로 저장되고 사람이 미리보기를 보고 이름을 바꾸거나 코드에 규칙을 추가한다.

## 부품 시트를 만들 때 배운 것

- **요청문에 크기 비율을 숫자로 적는다.** 적지 않으면 얼굴 부품이 몸 부품보다 훨씬 크게 나온다. 눈 흰자 폭 / 머리 폭: 비율 미지정 54%, 지정 34%(분홍 펭귄), 24%(여우)
- 한 시트에 부품은 8개 안팎까지. 많으면 나눠서 요청한다
- 배경은 투명이 아니라 연두색(#00FF00) 단색으로 요청한다. 캐릭터에 초록이 있으면 자홍색을 쓴다
- Codex는 깃 저장소가 아닌 폴더에서 `--skip-git-repo-check` 없이 시작하면 바로 실패한다
- 시트를 만든 직후 부품이 다 있는지, 서로 겹치지 않는지, 가려진 부분이 채워졌는지를 눈으로 확인한다

## 그림체 기준

새 이미지를 만들 때 지킬 조건. 원본 캐릭터를 참고 이미지로 함께 넣는다.

(작성 예정)
