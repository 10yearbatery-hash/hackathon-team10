// C9 상점, C10 구매 팝업 (구매 확인 / 코인 부족 / 구매 완료)
import { useState } from "react";
import type { Gift } from "../../core/model";
import { buyGift, coins } from "../../core/rules";
import { commit, getState, makeId, useAppState } from "../../app/store";
import { sfx } from "../../platform/sound";
import { Icon } from "../../ui/icons";
import { CoinChip, Hero, Modal, nick, TabBar } from "../../ui/parts";

const TINTS = ["#fff0b8", "#e4f5ee", "#efeafd", "#e4f3fd"];

type Popup = { kind: "confirm" | "short" | "done"; gift: Gift } | null;

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
    <section className="screen kid shop" data-testid="screen-shop">
      <header className="topbar topbar-kid">
        <span className="icon-btn-space" />
        <h1>선물 상점</h1>
        <span className="topbar-right">
          <CoinChip value={wallet} />
        </span>
      </header>

      <div className="scroll-body">
        <div className="wallet-card">
          <div>
            <small>{nick(state.childName)}의 코인</small>
            <b data-testid="wallet">
              <Icon name="coin" size={30} /> {wallet.toLocaleString("ko-KR")}
            </b>
            <p>미션을 하면 코인이 쌓여요!</p>
          </div>
          <Hero pose="wave" size={92} />
        </div>

        <h2 className="section-title">내가 고를 수 있는 선물</h2>
        <div className="gift-grid">
          {state.gifts.map((g, i) => {
            const need = g.price - wallet;
            return (
              <button key={g.id} className={`gift-card ${need > 0 ? "short" : ""}`} onClick={() => open(g)} data-testid={`gift-${g.id}`}>
                <span className="gift-art" style={{ background: TINTS[i % TINTS.length] }}>
                  <span className="gift-emoji">{g.icon}</span>
                  {need > 0 && <span className="need-pill">코인 {need} 더 필요</span>}
                </span>
                <b>{g.name}</b>
                <span className="price">
                  <Icon name="coin" size={15} /> {g.price}
                </span>
              </button>
            );
          })}
        </div>
        <p className="shop-note">
          <Icon name="lock" size={15} /> 선물은 부모님이 확인한 뒤 받을 수 있어요
        </p>
      </div>

      {popup?.kind === "confirm" && (
        <Modal onClose={() => setPopup(null)} testId="buy-confirm">
          <span className="modal-emoji">{popup.gift.icon}</span>
          <h2>{popup.gift.name}</h2>
          <p className="price big">
            <Icon name="coin" size={20} /> {popup.gift.price}
          </p>
          <div className="row gap">
            <button className="btn btn-ghost grow" onClick={() => setPopup(null)} data-testid="buy-cancel">
              취소
            </button>
            <button className="btn btn-blue grow" onClick={() => buy(popup.gift)} data-testid="buy-ok">
              사기
            </button>
          </div>
        </Modal>
      )}
      {popup?.kind === "short" && (
        <Modal onClose={() => setPopup(null)} testId="buy-short">
          <Hero pose="thumbs" size={96} motion="jump" />
          <h2>코인이 부족합니다</h2>
          <p className="muted">
            {popup.gift.name}까지 코인 {popup.gift.price - wallet}개만 더 모으자!
          </p>
          <button className="btn btn-blue btn-lg" onClick={() => setPopup(null)} data-testid="short-ok">
            확인
          </button>
        </Modal>
      )}
      {popup?.kind === "done" && (
        <Modal onClose={() => setPopup(null)} testId="buy-done">
          <Hero pose="cheer" size={100} motion="jump" />
          <h2>주문했어요!</h2>
          <p className="muted">부모님이 확인하면 받을 수 있어요</p>
          <button className="btn btn-blue btn-lg" onClick={() => setPopup(null)} data-testid="done-ok">
            확인
          </button>
        </Modal>
      )}

      <TabBar active="shop" />
    </section>
  );
}
