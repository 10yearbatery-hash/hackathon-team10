import { expect, test } from "@playwright/test";
import { onboard, pin, shot } from "./helpers";

test("시연 시나리오: 온보딩부터 실패 처리, 미션 관리와 구독까지 (서비스기획 15장)", async ({ page }) => {
  // 1~6. 시작, 영상, 하강, 부모 설정, 첫 미션, 1단계 클리어
  await onboard(page, { screenshots: true });
  await expect(page.getByTestId("first-banner")).toBeVisible({ timeout: 6000 });
  await shot(page, "c1-first-banner");
  await page.getByTestId("first-banner-ok").click();
  await expect(page.getByTestId("stage-1")).toHaveAttribute("data-state", "done");
  await expect(page.getByTestId("stage-2")).toHaveAttribute("data-state", "rest");
  await expect(page.getByTestId("path-hero")).toHaveAttribute("data-stage", "2");
  await expect(page.getByTestId("coin-chip")).toHaveText("10");
  await expect(page.getByTestId("castle-left")).toContainText("98칸");
  await shot(page, "c1-home-rest");
  await page.getByTestId("stage-3").click();
  await expect(page.getByTestId("toast")).toHaveText("아직 열리지 않았어!");

  // 7. 상점에서 코인 부족
  await page.getByTestId("tab-shop").click();
  await expect(page.getByTestId("screen-shop")).toBeVisible();
  await expect(page.getByText("하늘이의 코인")).toBeVisible();
  await shot(page, "c9-shop");
  await page.getByTestId("gift-g-movie").click();
  await expect(page.getByTestId("buy-short")).toContainText("코인이 조금 더 필요해");
  await shot(page, "c10-short");
  await page.getByTestId("short-ok").click();

  // 8. 부모 탭, PIN, 인증 확인에서 실패
  await page.getByTestId("tab-parent").click();
  await pin(page, "0000");
  await expect(page.getByTestId("pin-error")).toContainText("비밀번호가 달라요");
  await shot(page, "p1-pin-wrong");
  await pin(page, "1234");
  await expect(page.getByTestId("screen-parent-home")).toBeVisible();
  await expect(page.getByTestId("task-proofs")).toContainText("확인할 인증 1건");
  await expect(page.getByTestId("task-proofs")).toContainText("양치하기");
  await shot(page, "p2-parent-home");
  await page.getByTestId("go-review").click();
  await expect(page.getByTestId("proof-media")).toBeVisible();
  await expect(page.getByTestId("review-count")).toHaveText("1/1");
  await shot(page, "p3-review");
  await page.getByTestId("fail").click();
  await expect(page.getByTestId("fail-confirm")).toBeVisible();
  await page.getByTestId("fail-ok").click();
  await expect(page.getByTestId("screen-parent-home")).toBeVisible();
  await expect(page.getByTestId("task-proofs")).toContainText("확인할 인증이 없어요");

  // 아이 화면: 한 단계 내려오고 다시 해보자
  await page.getByTestId("to-kid").click();
  await expect(page.getByTestId("retry-screen")).toBeVisible();
  await expect(page.getByTestId("retry-coins")).toHaveText("-10");
  await shot(page, "c8-retry");
  await page.getByTestId("retry-later").click();
  await expect(page.getByTestId("coin-chip")).toHaveText("0");
  await expect(page.getByTestId("stage-1")).toHaveAttribute("data-state", "now");
  await page.getByTestId("stage-1").click();
  await expect(page.getByTestId("mission-brush")).toHaveAttribute("data-status", "retry");
  await shot(page, "c2-sheet-retry");
  await page.getByTestId("sheet-back").click({ position: { x: 20, y: 20 } });

  // 부모 탭에 다시 들어올 때는 PIN을 또 입력한다
  await page.getByTestId("tab-parent").click();
  await expect(page.getByTestId("screen-parent-pin")).toBeVisible();
  await pin(page, "1234");

  // 9. 미션 관리와 구독 안내
  await page.getByTestId("go-missions").click();
  await expect(page.getByTestId("manage-brush")).toBeVisible();
  await shot(page, "p5-missions");
  await page.getByTestId("more-missions").click();
  await expect(page.getByTestId("screen-subscribe")).toBeVisible();
  await shot(page, "p7-subscribe");
  await page.getByTestId("sub-start").click();
  await shot(page, "p7-pay");
  await page.getByTestId("pay").click();
  await expect(page.getByTestId("sub-done")).toBeVisible();
  await page.getByTestId("sub-back").click();
  await expect(page.getByTestId("add-mission")).toBeVisible();
});

test("다시 찍어서 클리어하고, 코인으로 선물을 사고 부모가 준다", async ({ page }) => {
  await onboard(page);
  await page.getByTestId("first-banner-ok").click();
  // 선물 가격을 10으로 바꾼다 (P6)
  await page.getByTestId("tab-parent").click();
  await pin(page, "1234");
  await page.getByTestId("go-gift-edit").click();
  await page.getByTestId("gift-price-0").fill("5");
  await page.getByTestId("save-gifts").click();
  await expect(page.getByTestId("gift-msg")).toContainText("10 이상");
  await page.getByTestId("gift-price-0").fill("10");
  await page.getByTestId("save-gifts").click();
  await expect(page.getByTestId("gift-msg")).toHaveText("저장했어요");
  await shot(page, "p6-gifts");

  // 아이가 산다
  await page.getByTestId("back").click();
  await page.getByTestId("to-kid").click();
  await page.getByTestId("tab-shop").click();
  await page.getByTestId("gift-g-movie").click();
  await page.getByTestId("buy-ok").click();
  await expect(page.getByTestId("buy-done")).toContainText("주문했어요!");
  await page.getByTestId("done-ok").click();
  await expect(page.getByTestId("wallet")).toContainText("0");

  // 부모가 실패를 누르면 코인은 마이너스가 될 수 있다 (R-09)
  await page.getByTestId("tab-parent").click();
  await pin(page, "1234");
  await expect(page.getByTestId("task-gifts")).toContainText("구매한 선물 1개");
  await page.getByTestId("go-review").click();
  await page.getByTestId("fail").click();
  await page.getByTestId("fail-ok").click();
  await page.getByTestId("go-gifts").click();
  await shot(page, "p4-bought");
  await page.getByTestId("give").click();
  await expect(page.getByText("구매한 선물이 없어요")).toBeVisible();
  await page.getByTestId("back").click();
  await page.getByTestId("to-kid").click();
  await expect(page.getByTestId("coin-chip")).toHaveText("-10");
  await page.getByTestId("retry-now").click();

  // 다시 찍기 → 클리어 → 2단계
  await expect(page.getByTestId("screen-capture")).toBeVisible();
  await page.getByTestId("shoot").click();
  await expect(page.getByTestId("submit")).toBeEnabled({ timeout: 12_000 });
  await page.getByTestId("retake").click();
  await expect(page.getByTestId("submit")).toBeDisabled();
  await page.getByTestId("shoot").click();
  await expect(page.getByTestId("submit")).toBeEnabled({ timeout: 12_000 });
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("clear-ok")).toBeEnabled({ timeout: 8000 });
  await page.getByTestId("clear-ok").click();
  await expect(page.getByTestId("path-hero")).toHaveAttribute("data-stage", "2", { timeout: 4000 });
  await expect(page.getByTestId("coin-chip")).toHaveText("0");

  // 새로고침해도 유지된다 (F-04)
  await page.reload();
  await expect(page.getByTestId("stage-2")).toHaveAttribute("data-state", "rest");
  await expect(page.getByTestId("coin-chip")).toHaveText("0");
});

test("사진 미션, 미션 두 개, 처음 상태로 되돌리기", async ({ page }) => {
  await onboard(page);
  await page.getByTestId("first-banner-ok").click();
  await page.getByTestId("tab-parent").click();
  await pin(page, "1234");
  // 구독하고 사진 미션을 추가
  await page.getByTestId("go-subscribe").click();
  await page.getByTestId("sub-start").click();
  await page.getByTestId("pay").click();
  await page.getByTestId("sub-back").click();
  await page.getByTestId("go-missions").click();
  await page.getByTestId("add-mission").click();
  await page.getByTestId("picker-book").click();
  await page.getByTestId("save-missions").click();
  await expect(page.getByTestId("save-missions")).toHaveText("저장했어요");
  await page.getByTestId("back").click();
  // 첫 인증을 실패로 돌려 1단계에서 두 미션을 하게 한다
  await page.getByTestId("go-review").click();
  await page.getByTestId("fail").click();
  await page.getByTestId("fail-ok").click();
  await page.getByTestId("to-kid").click();
  await page.getByTestId("retry-later").click();
  await page.getByTestId("stage-1").click();
  await expect(page.getByTestId("sheet-count")).toHaveText("오늘 0 / 2 완료");
  await page.getByTestId("go-book").click();
  await expect(page.getByTestId("timer")).toHaveText("");
  await page.getByTestId("shoot").click();
  await expect(page.getByTestId("preview")).toBeVisible();
  await shot(page, "c3-photo-preview");
  await page.getByTestId("submit").click();
  await expect(page.getByTestId("clear-ok")).toBeEnabled({ timeout: 8000 });
  await page.getByTestId("clear-ok").click();
  // 아직 하나 남아서 단계 팝업으로 돌아온다
  await expect(page.getByTestId("stage-sheet")).toBeVisible();
  await expect(page.getByTestId("sheet-count")).toHaveText("오늘 1 / 2 완료");
  await expect(page.getByTestId("mission-book")).toHaveAttribute("data-status", "done");
  await shot(page, "c2-sheet-half");

  // 시연용 초기화
  await page.getByTestId("sheet-back").click({ position: { x: 20, y: 20 } });
  await page.getByTestId("tab-parent").click();
  await pin(page, "1234");
  await page.getByTestId("reset").click();
  await page.getByTestId("reset-ok").click();
  await expect(page.getByTestId("screen-start")).toBeVisible();
  await page.goto("/#/home");
  await expect(page.getByTestId("screen-start")).toBeVisible();
});
