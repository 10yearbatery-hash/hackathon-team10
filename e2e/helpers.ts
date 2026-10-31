import { expect, type Page } from "@playwright/test";

export async function shot(page: Page, name: string) {
  await page.waitForTimeout(300);
  try {
    await page.screenshot({ path: `e2e/screenshots/${name}.png`, animations: "disabled" });
  } catch (e) {
    console.warn(`[shot] ${name}: ${(e as Error).message.split("\n")[0]}`);
  }
}

export async function pin(page: Page, digits: string, prefix = "key") {
  for (const d of digits) await page.getByTestId(`${prefix}-${d}`).click();
}

/** O1~O9: 시작부터 첫 미션 클리어, 홈 도착까지 */
export async function onboard(page: Page, opts: { name?: string; screenshots?: boolean } = {}) {
  const snap = (n: string) => (opts.screenshots ? shot(page, n) : Promise.resolve());
  await page.goto("/");
  await expect(page.getByTestId("splash")).toBeVisible();
  await snap("o0-splash");
  await expect(page.getByTestId("splash")).toBeHidden({ timeout: 5000 });
  await expect(page.getByTestId("screen-start")).toBeVisible();
  await snap("o1-start");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("greet-next")).toBeEnabled({ timeout: 6000 });
  await snap("o1-greet");
  await page.getByTestId("greet-next").click();
  await expect(page.getByTestId("screen-intro")).toBeVisible();
  await snap("o2-intro");
  // 10초 영상을 끝까지 기다리지 않고 끝난 것으로 친다
  await page.getByTestId("intro-video").dispatchEvent("ended");
  await expect(page.getByTestId("screen-descent")).toBeVisible();
  await page.waitForTimeout(2500);
  await snap("o3-descent-mid");
  await expect(page.getByTestId("descent-next")).toBeEnabled({ timeout: 10_000 });
  await snap("o3-descent-end");
  await page.getByTestId("descent-next").click();
  await expect(page.getByTestId("screen-handoff")).toBeVisible();
  await snap("o4-handoff");
  await page.getByTestId("parent-came").click();

  await pin(page, "1234", "ob-key");
  await expect(page.getByText("한 번 더 눌러 주세요")).toBeVisible();
  await snap("o5-pin");
  await pin(page, "1234", "ob-key");
  await expect(page.getByTestId("screen-setup-name")).toBeVisible();
  await expect(page.getByTestId("name-next")).toBeDisabled();
  await page.getByTestId("child-name").fill(opts.name ?? "하늘");
  await snap("o6-name");
  await page.getByTestId("name-next").click();

  await expect(page.getByTestId("screen-setup-mission")).toBeVisible();
  await page.getByRole("button", { name: "5초 줄이기" }).click();
  await page.getByRole("button", { name: "5초 줄이기" }).click();
  await expect(page.getByTestId("seconds-value")).toHaveText("5");
  await snap("o7-mission");
  await page.getByTestId("mission-choose").click();

  await expect(page.getByTestId("screen-capture")).toBeVisible();
  await expect(page.getByTestId("together")).toBeVisible();
  await expect(page.getByTestId("submit")).toBeDisabled();
  await page.getByTestId("shoot").click();
  await expect(page.getByTestId("rec")).toBeVisible();
  await snap("o8-recording");
  await expect(page.getByTestId("submit")).toBeEnabled({ timeout: 12_000 });
  await page.getByTestId("submit").click();

  await expect(page.getByTestId("clear-joy")).toBeVisible();
  await snap("o9-joy");
  await expect(page.getByTestId("clear-ok")).toBeEnabled({ timeout: 8000 });
  await expect(page.getByTestId("clear-coins")).toContainText("10");
  await snap("o9-coin");
  await page.getByTestId("clear-ok").click();
  await expect(page.getByTestId("screen-home")).toBeVisible();
}
