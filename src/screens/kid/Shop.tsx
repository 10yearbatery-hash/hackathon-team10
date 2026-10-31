// C9 선물 상점, C10 구매 팝업 (이 선물을 살까? / 코인이 조금 더 필요해 / 주문했어요!)
// 디자인: 피그마 "V3/C9", "V3/C10A", "V3/C10B", "V3/C10C"
import { useState } from "react";
import type { Gift } from "../../core/model";
import { buyGift, coins } from "../../core/rules";
import { commit, getState, makeId, useAppState } from "../../app/store";
import { sfx } from "../../platform/sound";
import { Hero, KidTabBar, Modal, nick, type Pose } from "../../ui/parts";

type Popup = { kind: "confirm" | "short" | "done"; gift: Gift } | null;

function V3Coin({ value, testId = "coin-chip" }: { value: number; testId?: string }) {
  return (
    <span className="v3-coin" data-testid={testId}>
      <i aria-hidden="true">●</i>
      <b>{value.toLocaleString("ko-KR")}</b>
    </span>
  );
}

function PopupHead({ title, sub, pose }: { title: string; sub: string; pose: Pose }) {
  return (
    <>
      <h2 className="v3-title">{title}</h2>
      <p className="v3-sub">{sub}</p>
      <div className="v3-hero-panel">
        <Hero pose={pose} size={120} motion={pose === "wave" ? "breathe" : "jump"} />
      </div>
    </>
  );
}

export default function Shop() {
  const state = useAppState();
  const wallet = coins(state);
  const [popup, setPopup] = useState<Popup>(null);

  function open(gift: Gift) {
    sfx.tap();
    if (wallet < gift.price) {
      sfx.soft();
      setPopup({ kind: "short", gift });
    } else {
      setPopup({ kind: "confirm", gift });
    }
  }

  function buy(gift: Gift) {
    const r = buyGift(getState(), { id: makeId("buy"), giftId: gift.id, now: Date.now() });
    if (!r.ok) {
      setPopup({ kind: "short", gift });
      return;
    }
    commit(r.state);
    sfx.coin();
    setPopup({ kind: "done", gift });
  }

  return (
    <section className="screen v3 shop-v3" data-testid="screen-shop">
      <div className="scroll-body">
        <div className="v3-title-row">
          <h1 className="v3-title">선물 상점</h1>
          <V3Coin value={wallet} />
        </div>
        <p className="v3-sub">조금씩 모아서 가족의 선물을 골라 봐.</p>

        <div className="v3-card wallet-v3">
          <small>{nick(state.childName)}의 코인</small>
          <b data-testid="wallet">{wallet.toLocaleString("ko-KR")}</b>
        </div>

        <h2 className="v3-section">내가 고를 수 있는 선물</h2>
        <div className="gift-grid">
          {state.gifts.map((g) => {
            const need = g.price - wallet;
            return (
              <button key={g.id} className={`gift-v3 ${need > 0 ? "short" : ""}`} onClick={() => open(g)} data-testid={`gift-${g.id}`}>
                <span className="gift-slot">{g.icon}</span>
                <b>{g.name}</b>
                <small>{g.price} 코인</small>
                {need > 0 && <em>코인 {need}개 더 필요</em>}
              </button>
            );
          })}
        </div>
        <p className="v3-sub shop-note-v3">선물은 부모님이 확인한 뒤 받을 수 있어.</p>
      </div>

      {popup?.kind === "confirm" && (
        <Modal onClose={() => setPopup(null)} testId="buy-confirm">
          <PopupHead title="이 선물을 살까?" sub="선물 구매 확인" pose="wave" />
          <div className="v3-card">
            <b>
              {popup.gift.name} · {popup.gift.price}코인
            </b>
            <small>사면 코인이 바로 사용돼. 부모님이 확인한 뒤 받을 수 있어.</small>
          </div>
          <button className="btn btn-blue btn-lg" onClick={() => buy(popup.gift)} data-testid="buy-ok">
            살래요
          </button>
          <button className="btn btn-white btn-lg" onClick={() => setPopup(null)} data-testid="buy-cancel">
            취소
          </button>
        </Modal>
      )}
      {popup?.kind === "short" && (
        <Modal onClose={() => setPopup(null)} testId="buy-short">
          <PopupHead title="코인이 조금 더 필요해" sub="조금씩 모으면 받을 수 있어!" pose="thumbs" />
          <div className="v3-card">
            <b>
              {popup.gift.name} · {popup.gift.price}코인
            </b>
            <small>오늘의 작은 미션으로 코인을 모아 봐.</small>
          </div>
          <p className="need-more" data-testid="need-more">
            {popup.gift.price - wallet}코인이 더 필요해요
          </p>
          <button className="btn btn-blue btn-lg" onClick={() => setPopup(null)} data-testid="short-ok">
            확인
          </button>
        </Modal>
      )}
      {popup?.kind === "done" && (
        <Modal onClose={() => setPopup(null)} testId="buy-done">
          <PopupHead title="주문했어요!" sub={`${popup.gift.name} · 구매 완료`} pose="cheer" />
          <div className="v3-card">
            <b>{popup.gift.price}코인을 사용했어</b>
            <small>이제 부모님과 함께할 시간을 약속해 보자.</small>
          </div>
          <button className="btn btn-blue btn-lg" onClick={() => setPopup(null)} data-testid="done-ok">
            확인
          </button>
        </Modal>
      )}

      <KidTabBar active="shop" />
    </section>
  );
}
