import { defineConfig, devices } from "@playwright/test";

// 시스템에 설치된 Chrome을 쓴다. 가짜 카메라로 촬영 화면을 시험한다 (실기기 확인은 따로 필요)
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Pixel 7"],
    channel: "chrome",
    baseURL: "http://localhost:4173",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    permissions: ["camera"],
    launchOptions: {
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"]
    }
  },
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: false
  }
});
