// 화면 고르기와 들어갈 수 있는지 확인 (유저저니 3장)
import { useEffect } from "react";
import { MISSIONS, type MissionId } from "./core/model";
import { go, match, useRoute } from "./app/router";
import { handoff, useAppState } from "./app/store";
import { Descent, HandToParent, Intro, SetupMission, SetupName, SetupPin, Start } from "./screens/onboarding/Onboarding";
import Capture from "./screens/kid/Capture";
import Clear from "./screens/kid/Clear";
import Home from "./screens/kid/Home";
import Shop from "./screens/kid/Shop";
import Account from "./screens/parent/Account";
import { Splash } from "./ui/Splash";
import { BoughtGifts, GiftManage, MissionManage, ParentHome, ParentPin, Review, Subscribe } from "./screens/parent/Parent";

const ONBOARDING = ["/start", "/intro", "/descent", "/handoff", "/setup/pin", "/setup/name", "/setup/mission"];
const PARENT_LOCKED = ["/parent", "/parent/review", "/parent/gifts", "/parent/missions", "/parent/shop", "/parent/account"];

function isMission(id: string): id is MissionId {
  return MISSIONS.some((m) => m.id === id);
}

/** 지금 상태에서 이 주소로 갈 수 없으면 갈 곳을 돌려준다 */
function redirect(path: string, onboarded: boolean, hasSetup: boolean): string | null {
  const first = match("/first/:id", path);
  if (!onboarded) {
    if (ONBOARDING.includes(path)) return null;
    if (first && hasSetup) return null;
    if (path.startsWith("/clear/") && hasSetup) return null;
    if (path === "/subscribe" && handoff.subscribeBack === "/setup/mission") return null;
    return "/start";
  }
  if (ONBOARDING.includes(path) || first || path === "/") return "/home";
  if (PARENT_LOCKED.includes(path) && !handoff.parentOk) return "/parent/pin";
  if (path === "/subscribe" && !handoff.parentOk) return "/parent/pin";
  return null;
}

export default function App() {
  const path = useRoute();
  const state = useAppState();
  const target = redirect(path, state.onboarded, state.missions.length > 0);

  useEffect(() => {
    if (target) go(target, { replace: true });
  }, [target]);

  // 스플래시는 앱을 열 때 한 번만 나온다. 같은 자리에 두어 화면이 바뀌어도 다시 시작하지 않는다
  return (
    <>
      {target ? null : <Screen path={path} />}
      <Splash />
    </>
  );
}

function Screen({ path }: { path: string }) {
  const capture = match("/capture/:id", path);
  const first = match("/first/:id", path);
  const clear = match("/clear/:id", path);

  if (path === "/start") return <Start />;
  if (path === "/intro") return <Intro />;
  if (path === "/descent") return <Descent />;
  if (path === "/handoff") return <HandToParent />;
  if (path === "/setup/pin") return <SetupPin />;
  if (path === "/setup/name") return <SetupName />;
  if (path === "/setup/mission") return <SetupMission />;
  if (first && isMission(first.id)) return <Capture key={path} missionId={first.id} first />;
  if (capture && isMission(capture.id)) return <Capture key={path} missionId={capture.id} />;
  if (clear) return <Clear key={path} proofId={clear.id} />;
  if (path === "/home") return <Home />;
  if (path === "/shop") return <Shop />;
  if (path === "/parent/pin") return <ParentPin />;
  if (path === "/parent") return <ParentHome />;
  if (path === "/parent/review") return <Review />;
  if (path === "/parent/gifts") return <BoughtGifts />;
  if (path === "/parent/missions") return <MissionManage />;
  if (path === "/parent/shop") return <GiftManage />;
  if (path === "/parent/account") return <Account />;
  if (path === "/subscribe") return <Subscribe />;
  return <NotFound />;
}

function NotFound() {
  useEffect(() => go("/home", { replace: true }), []);
  return null;
}
