"""단색 배경(흰색 또는 검정)의 캐릭터 그림에서 바깥쪽 배경만 지워 투명 PNG로 만든다.

사용: python3 -P cutout_full.py <입력.png> <출력.png> <허용오차> <깎을픽셀> [x0,y0,x1,y1]
- 허용오차: 배경색과 RGB 차이의 합이 이 값 이하이면 배경으로 본다
- 깎을픽셀: 가장자리에 남는 배경색 테두리를 없애려고 투명 영역을 안쪽으로 넓히는 횟수
- 마지막 인자: 먼저 이 영역만 잘라서 쓴다 (한 장에 그림이 여러 개일 때)
몸 안쪽에 있는 같은 색(예: 흰 배)은 바깥과 이어져 있지 않으면 지워지지 않는다.
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

MARK = (255, 0, 255)  # 지울 영역을 표시하는 색 (그림에 쓰이지 않는 색)


def main():
  src, out, thresh, erode = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
  im = Image.open(src).convert("RGB")
  if len(sys.argv) > 5:
    x0, y0, x1, y1 = [int(v) for v in sys.argv[5].split(",")]
    im = im.crop((x0, y0, x1, y1))
  w, h = im.size
  work = im.copy()
  # 네 모서리와 가장자리 여러 곳에서 출발해 바깥 배경을 채운다
  seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
  seeds += [(x, 0) for x in range(0, w, w // 8)] + [(x, h - 1) for x in range(0, w, w // 8)]
  seeds += [(0, y) for y in range(0, h, h // 8)] + [(w - 1, y) for y in range(0, h, h // 8)]
  for s in seeds:
    if work.getpixel(s) != MARK:
      ImageDraw.floodfill(work, s, MARK, thresh=thresh)
  arr = np.asarray(work)
  bg = (arr[..., 0] == 255) & (arr[..., 1] == 0) & (arr[..., 2] == 255)
  alpha = Image.fromarray(np.where(bg, 0, 255).astype(np.uint8), "L")
  for _ in range(erode):
    alpha = alpha.filter(ImageFilter.MinFilter(3))
  alpha = alpha.filter(ImageFilter.GaussianBlur(0.7))
  rgba = im.convert("RGBA")
  rgba.putalpha(alpha)
  bbox = rgba.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
  pad = 10
  box = (max(bbox[0] - pad, 0), max(bbox[1] - pad, 0), min(bbox[2] + pad, w), min(bbox[3] + pad, h))
  rgba = rgba.crop(box)
  rgba.save(out)
  a = np.asarray(rgba.getchannel("A"))
  print(f"{out}: {rgba.size[0]}x{rgba.size[1]}  투명 {100*(a==0).mean():.0f}%  불투명 {100*(a==255).mean():.0f}%  반투명 {100*((a>0)&(a<255)).mean():.1f}%")


main()
