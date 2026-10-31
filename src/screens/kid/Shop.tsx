// C9 선물 상점, C10 구매 (이 선물을 살까? / 구매해 줘서 고마워! / 코인이 부족해)
// 디자인: 피그마 "상점 01 · 어서 와!", "상점 02 · 상품 둘러보기", "상점 03 · 구매 완료", "상점 04 · 크레딧 부족"
// 나무 간판과 계산대가 있는 가게에서 펭귄 점원이 맞이한다. 피그마의 "크레딧"은 앱 전체 용어에 맞춰 "코인"으로 쓴다.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Gift } from "../../core/model";
import { buyGift, coins } from "../../core/rules";
import { go } from "../../app/router";
import { commit, getState, makeId, useAppState } from "../../app/store";
import { sfx } from "../../platform/sound";
import { Hero, Modal } from "../../ui/parts";

type View = { kind: "welcome" } | { kind: "list" } | { kind: "done"; gift: Gift } | { kind: "short"; gift: Gift };
type Keeper = "wave" | "wink" | "cry";

/** 기본 선물의 한 줄 설명. 부모가 새로 만든 선물은 공통 문구를 쓴다 */
const GIFT_DESC: Record<string, string> = {
  "g-movie": "팝콘과 함께 우리 가족 영화 시간",
  "g-dinner": "오늘 저녁은 내가 좋아하는 메뉴!",
  "g-play": "엄마 아빠랑 신나게 놀아요",
  "g-park": "가족과 함께 나들이를 떠나요",
  "g-hug": "엄마 아빠가 꼭 안아 줘요"
};

const STRIPES = Array.from({ length: 12 }, (_, i) => i);

function ShopCoin({ value }: { value: number }) {
  return (
    <span className="shop-coin" data-testid="wallet">
      <i aria-hidden="true">●</i> {value.toLocaleString("ko-KR")} 코인
    </span>
  );
}

/** 말풍선과 계산대 뒤의 펭귄 점원 */
function Counter({ say, keeper }: { say: string; keeper: Keeper }) {
  return (
    <div className={`shop-stage keeper-${keeper}`}>
      <div className="shop-bubble" key={say}>
        <p>{say}</p>
        <img className="shop-bubble-tail" src="./shop/bubble-tail.svg" alt="" aria-hidden="true" />
      </div>
      <div className="shop-keeper">
        <img key={keeper} src={`./char/hero_${keeper}.png`} alt="펭귄 점원" draggable={false} />
      </div>
      <div className="shop-counter">
        <i className="shop-counter-top" aria-hidden="true" />
        <div className="shop-wood shop-counter-body">PENGUIN SHOP</div>
      </div>
    </div>
  );
}

/**
 * 계산대 장면을 스크롤 없이 한 화면에 담는다. 장면의 원래 높이를 재서 남은 높이보다 크면
 * 같은 비율로 줄인다. 키가 큰 화면에서는 원래 크기로 두고 버튼만 아래에 붙인다.
 */
function Fit({ children, testId }: { children: ReactNode; testId: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const o = outer.current;
    const n = inner.current;
    if (!o || !n) return;
    const fit = () => {
      n.style.transform = "none";
      n.style.height = "auto";
      const k = Math.min(1, o.clientHeight / n.offsetHeight);
      n.style.height = `${o.clientHeight / k}px`;
      n.style.transform = k < 1 ? `scale(${k})` : "none";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(o);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="shop-scene" ref={outer} data-testid={testId}>
      <div className="shop-fit" ref={inner}>
        {children}
      </div>
    </div>
  );
}

export default function Shop() {
  const state = useAppState();
  const wallet = coins(state);
  const [view, setView] = useState<View>({ kind: "welcome" });
  const [confirm, setConfirm] = useState<Gift | null>(null);

  function to(next: View) {
    sfx.tap();
    setView(next);
  }

  function open(gift: Gift) {
    if (wallet < gift.price) {
      sfx.soft();
      setView({ kind: "short", gift });
    } else {
      sfx.tap();
      setConfirm(gift);
    }
  }

  function buy(gift: Gift) {
    setConfirm(null);
    const r = buyGift(getState(), { id: makeId("buy"), giftId: gift.id, now: Date.now() });
    if (!r.ok) {
      setView({ kind: "short", gift });
      return;
    }
    commit(r.state);
    sfx.coin();
    setView({ kind: "done", gift });
  }

  function home() {
    sfx.tap();
    go("/home");
  }

  return (
    <section className="screen shop" data-testid="screen-shop">
      <header className="shop-head">
        <div className="shop-sign">
          <i className="shop-snow" aria-hidden="true" />
          <div className="shop-wood shop-sign-board">눈꽃 선물 상점</div>
        </div>
        <div className="shop-bar">
          <button className="shop-back" onClick={home} data-testid="shop-back">
            ‹ 모험으로
          </button>
          <ShopCoin value={wallet} />
        </div>
        <div className="shop-awning" aria-hidden="true">
          {STRIPES.map((i) => (
            <i key={i} className={i % 2 === 0 ? "pink" : "cream"} />
          ))}
        </div>
      </header>

      <div className="shop-room">
        <i className="shop-post left" aria-hidden="true" />
        <i className="shop-post right" aria-hidden="true" />

        {view.kind === "welcome" && (
          <Fit testId="shop-welcome">
            <Counter say="안녕~ 뭐 사러 왔어?" keeper="wave" />
            <p className="shop-lead">
              매일 모은 코인으로
              <br />
              가족과 특별한 시간을 골라 봐!
            </p>
            <button className="shop-btn" onClick={() => to({ kind: "list" })} data-testid="shop-browse">
              상품 구경하기
            </button>
          </Fit>
        )}

        {view.kind === "list" && (
          <div className="shop-list" data-testid="shop-list">
            {[...state.gifts].sort((x, y) => x.price - y.price).map((g) => {
              const need = g.price - wallet;
              return (
                <button key={g.id} className={`shop-item ${need > 0 ? "short" : ""}`} onClick={() => open(g)} data-testid={`gift-${g.id}`}>
                  <b>{g.name}</b>
                  <small>{GIFT_DESC[g.id] ?? "가족과 함께하는 특별한 시간"}</small>
                  <span className="shop-item-price">
                    {g.price} 코인 <em>·</em> {need > 0 ? `${need}개 더 모으자` : "구매하기 ›"}
                  </span>
                </button>
              );
            })}
            <p className="shop-note">
              가족과 약속한 선물이에요.
              <br />
              구매한 선물은 부모님과 함께 확인해요.
            </p>
          </div>
        )}

        {view.kind === "done" && (
          <Fit testId="buy-done">
            <Counter say="구매해 줘서 고마워!" keeper="wink" />
            <div className="shop-bought">
              <b>{view.gift.name}</b>
              <small>{view.gift.price} 코인 · 부모님과 함께 확인해요</small>
            </div>
            <button className="shop-btn" onClick={() => to({ kind: "list" })} data-testid="done-ok">
              다른 선물도 볼래
            </button>
          </Fit>
        )}

        {view.kind === "short" && (
          <Fit testId="buy-short">
            <Counter say="미안… 코인이 부족해ㅜ" keeper="cry" />
            <p className="shop-lead">
              <span data-testid="need-more">{view.gift.price - wallet}코인</span>만 더 모으고 다시 만나!
              <br />
              모험을 깨면 코인이 쌓여.
            </p>
            <button className="shop-btn" onClick={home} data-testid="short-ok">
              모험하러 가기
            </button>
          </Fit>
        )}
      </div>

      <footer className="shop-wood shop-floor">
        {view.kind === "short" && (
          <button className="shop-floor-link" onClick={() => to({ kind: "list" })} data-testid="short-list">
            다른 상품 보기
          </button>
        )}
      </footer>

      {confirm && (
        <Modal onClose={() => setConfirm(null)} testId="buy-confirm">
          <h2 className="v3-title">이 선물을 살까?</h2>
          <div className="v3-hero-panel">
            <Hero pose="wave" size={110} motion="breathe" />
          </div>
          <div className="v3-card">
            <b>
              {confirm.name} · {confirm.price}코인
            </b>
            <small>사면 코인이 바로 사용돼. 부모님이 확인한 뒤 받을 수 있어.</small>
          </div>
          <button className="btn btn-blue btn-lg" onClick={() => buy(confirm)} data-testid="buy-ok">
            살래요
          </button>
          <button className="btn btn-white btn-lg" onClick={() => setConfirm(null)} data-testid="buy-cancel">
            취소
          </button>
        </Modal>
      )}
    </section>
  );
}
