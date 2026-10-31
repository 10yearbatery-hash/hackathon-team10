"""연두색 단색 배경의 부품 시트를 부품별 투명 PNG로 자른다.

사용: python3 -P cut_parts.py <시트.png> <출력폴더> <이름규칙> [미리보기.png]
이름규칙은 "sheet1" 또는 "sheet2". 규칙에 맞지 않는 덩어리는 unknown_N으로 저장한다.
"""
import os
import sys

import numpy as np
from PIL import Image

try:
  from scipy import ndimage
except Exception:
  ndimage = None


def green_excess(a):
  # 초록이 빨강/파랑보다 얼마나 센지. 배경(0,255,0)은 255, 흰색·파랑·주황은 0 이하
  return a[..., 1] - np.maximum(a[..., 0], a[..., 2])


def label(mask):
  if ndimage is not None:
    return ndimage.label(mask, structure=np.ones((3, 3)))
  h, w = mask.shape
  lab = np.zeros((h, w), dtype=np.int32)
  n = 0
  for y in range(h):
    for x in range(w):
      if mask[y, x] and lab[y, x] == 0:
        n += 1
        stack = [(y, x)]
        lab[y, x] = n
        while stack:
          cy, cx = stack.pop()
          for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
              ny, nx = cy + dy, cx + dx
              if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and lab[ny, nx] == 0:
                lab[ny, nx] = n
                stack.append((ny, nx))
  return lab, n


def to_rgba(a):
  gx = green_excess(a).astype(np.float32)
  # gx<=60이면 완전 불투명, gx>=170이면 완전 투명, 사이는 부드럽게
  alpha = np.clip((170 - gx) / 110.0, 0, 1)
  out = a.copy()
  mx = np.maximum(a[..., 0], a[..., 2])
  out[..., 1] = np.where(a[..., 1] > mx, mx, a[..., 1])  # 가장자리에 남은 연두빛 제거
  rgb = np.clip(out, 0, 255).astype(np.uint8)
  return np.dstack([rgb, (alpha * 255).astype(np.uint8)])


def name_sheet1(c):
  cx, cy, area = c["cx"], c["cy"], c["area"]
  if cy < 350 and cx > 800 and area < 60000:
    return "tuft"
  if cy < 450 and 250 < cx < 750:
    return "head"
  if cy > 1000 and cx < 500:
    return "foot_l"
  if cy > 1000 and cx >= 500:
    return "foot_r"
  if cx < 350 and 450 < cy < 950:
    return "wing_l"
  if cx > 900 and 500 < cy < 1050:
    return "wing_r"
  if 400 < cx < 900 and 500 < cy < 1100:
    return "body"
  return None


def name_sheet2(c):
  cx, cy = c["cx"], c["cy"]
  side = "l" if cx < 630 else "r"
  if cy < 450:
    return f"eye_white_{side}"
  if cy < 700:
    return f"pupil_{side}"
  if cy < 900:
    return f"brow_{side}"
  return "beak_top" if cx < 630 else "beak_bottom"


def name_heroine1(c):
  # 분홍 펭귄 몸 시트: 깃털은 왼쪽 위, 리본은 오른쪽 위에 놓였다
  cx, cy = c["cx"], c["cy"]
  if cy < 300 and cx < 500:
    return "tuft"
  if cy < 400 and cx > 800:
    return "ribbon"
  if cy < 500 and 400 < cx < 900:
    return "head"
  if cy > 1000:
    return "foot_l" if cx < 630 else "foot_r"
  if cx < 400 and 450 < cy < 950:
    return "wing_l"
  if cx > 900 and 500 < cy < 1050:
    return "wing_r"
  if 350 < cx < 900 and cy > 550:
    return "body"
  return None


def name_heroine2(c):
  # 분홍 펭귄 얼굴 시트: 눈썹, 눈 흰자, 눈동자, 부리가 위에서 아래 순서
  cx, cy = c["cx"], c["cy"]
  side = "l" if cx < 630 else "r"
  if cy < 350:
    return f"brow_{side}"
  if cy < 600:
    return f"eye_white_{side}"
  if cy < 820:
    return f"pupil_{side}"
  return "beak_top" if cx < 630 else "beak_bottom"


def name_villainA(c):
  # 여우 핵심 시트: 귀는 양쪽 위, 머리는 가운데 위, 장식·몸통·꼬리는 아래 줄
  cx, cy = c["cx"], c["cy"]
  if cy < 450 and cx < 400:
    return "ear_l"
  if cy < 450 and cx > 800:
    return "ear_r"
  if cy < 650 and 300 < cx < 900:
    return "head"
  if cy > 800 and cx < 300:
    return "clasp"
  if cy > 650 and cx > 800:
    return "tail"
  if cy > 650 and 300 <= cx <= 800:
    return "torso"
  return None


def name_villainB(c):
  # 여우 팔다리와 망토 시트: 팔 두 개(위), 다리 두 개(가운데), 망토(아래)
  cx, cy = c["cx"], c["cy"]
  side = "l" if cx < 630 else "r"
  if cy < 400:
    return f"arm_{side}"
  if cy < 750:
    return f"leg_{side}"
  return "cape"


def name_villainC(c):
  # 여우 얼굴 시트: 눈썹, 눈 흰자, 홍채(코드에서 다른 캐릭터와 같게 pupil로 부름), 코와 입이 위에서 아래 순서
  cx, cy = c["cx"], c["cy"]
  side = "l" if cx < 630 else "r"
  if cy < 450:
    return f"brow_{side}"
  if cy < 620:
    return f"eye_white_{side}"
  if cy < 800:
    return f"pupil_{side}"
  return "nose" if cx < 630 else "mouth"


RULES = {"sheet1": name_sheet1, "sheet2": name_sheet2, "heroine1": name_heroine1, "heroine2": name_heroine2,
         "villainA": name_villainA, "villainB": name_villainB, "villainC": name_villainC}


def main():
  src, outdir, rule = sys.argv[1], sys.argv[2], sys.argv[3]
  preview = sys.argv[4] if len(sys.argv) > 4 else None
  prefix = sys.argv[5] if len(sys.argv) > 5 else "hero"  # 파일 이름 앞에 붙일 캐릭터 id
  os.makedirs(outdir, exist_ok=True)
  a = np.asarray(Image.open(src).convert("RGB")).astype(np.int16)
  rgba_all = to_rgba(a)
  fg = green_excess(a) < 120
  lab, n = label(fg)
  comps = []
  for i in range(1, n + 1):
    ys, xs = np.nonzero(lab == i)
    if len(ys) < 800:
      continue
    comps.append({"i": i, "area": len(ys), "cx": int(xs.mean()), "cy": int(ys.mean()),
                  "x0": int(xs.min()), "x1": int(xs.max()), "y0": int(ys.min()), "y1": int(ys.max())})
  print(f"덩어리 {len(comps)}개 발견 (작은 점 제외)")
  namer = RULES.get(rule, lambda c: None)
  used, saved, unk = set(), [], 0
  for c in sorted(comps, key=lambda c: (c["cy"], c["cx"])):
    nm = namer(c)
    if nm is None or nm in used:
      unk += 1
      nm = f"unknown_{unk}"
    used.add(nm)
    mask = lab == c["i"]
    if ndimage is not None:
      mask = ndimage.binary_dilation(mask, iterations=3)
    rgba = rgba_all.copy()
    rgba[..., 3] = np.where(mask, rgba[..., 3], 0)
    pad = 6
    box = (max(c["x0"] - pad, 0), max(c["y0"] - pad, 0),
           min(c["x1"] + pad + 1, a.shape[1]), min(c["y1"] + pad + 1, a.shape[0]))
    img = Image.fromarray(rgba, "RGBA").crop(box)
    path = os.path.join(outdir, f"{prefix}_{nm}.png")
    img.save(path)
    arr = np.asarray(img)
    al = arr[..., 3]
    # 반투명 가장자리에 연두빛이 남았는지 검사
    vis = al > 0
    resid = int(((arr[..., 1].astype(int) - np.maximum(arr[..., 0], arr[..., 2]).astype(int)) > 20)[vis].sum())
    print(f"  {prefix}_{nm}.png  {img.size[0]}x{img.size[1]}  불투명 {100*(al==255).mean():.0f}%  "
          f"투명 {100*(al==0).mean():.0f}%  반투명 {100*((al>0)&(al<255)).mean():.1f}%  연두잔여 {resid}px  "
          f"(중심 {c['cx']},{c['cy']} 면적 {c['area']})")
    saved.append((nm, img))
  if preview and saved:
    # 어두운 회색 바탕 위에 부품을 늘어놓아 투명도와 가장자리를 눈으로 확인
    cell = 360
    cols = 4
    rows = (len(saved) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell, rows * cell), (70, 70, 80, 255))
    for k, (nm, img) in enumerate(saved):
      im = img.copy()
      im.thumbnail((cell - 20, cell - 20))
      sheet.alpha_composite(im, ((k % cols) * cell + (cell - im.size[0]) // 2,
                                 (k // cols) * cell + (cell - im.size[1]) // 2))
    sheet.convert("RGB").save(preview)
    print("미리보기 저장:", preview)


main()
