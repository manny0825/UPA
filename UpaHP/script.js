// 店ごとのInstagram
const instagramUrls = {
  lunch: "https://www.instagram.com/nettaimaniac/",
  night: "https://www.instagram.com/maruzara_upa/",
};

// ---------------------------------------------------------------
// ファーストビュー: [昼 | TOP | 夜] の横スライド
// ---------------------------------------------------------------

const viewport = document.querySelector(".fv-viewport");
const track = document.querySelector(".fv-track");

if (viewport && track) {
  const LUNCH = 0;
  const COVER = 1;
  const NIGHT = 2;
  const PANEL_PERCENT = 100 / 3; // トラック幅は300%なので1パネル=33.333%

  const panels = Array.from(track.children);
  const panelNames = ["昼の店 熱帯maniac", "TOP", "夜の店 まる皿うぱ"];
  const shortNames = ["昼", "TOP", "夜"];
  const hashes = ["#lunch", "#top", "#night"];

  const tabButtons = Array.from(document.querySelectorAll(".fv-tab"));
  const homeButton = document.querySelector(".fv-home");
  const arrowLeft = document.querySelector(".fv-arrow-left");
  const arrowRight = document.querySelector(".fv-arrow-right");
  const liveRegion = document.getElementById("fv-live");
  const reserveLinks = Array.from(document.querySelectorAll(".js-reserve-link"));

  let index = COVER;

  function applyTransform(offsetPx = 0) {
    track.style.transform = `translateX(calc(${-index * PANEL_PERCENT}% + ${offsetPx}px))`;
  }

  // 矢印は端のパネルで消し、ヒーローより下を読んでいる間も邪魔しないよう隠す
  function updateArrows() {
    const scroller = panels[index]?.querySelector(".fv-panel-scroll");
    const isReading = Boolean(scroller && scroller.scrollTop > 48);

    if (arrowLeft) {
      arrowLeft.classList.toggle("is-hidden", index === LUNCH || isReading);
      const label = arrowLeft.querySelector(".js-arrow-label");
      if (label && index > LUNCH) label.textContent = shortNames[index - 1];
    }
    if (arrowRight) {
      arrowRight.classList.toggle("is-hidden", index === NIGHT || isReading);
      const label = arrowRight.querySelector(".js-arrow-label");
      if (label && index < NIGHT) label.textContent = shortNames[index + 1];
    }
  }

  function goTo(next, { announce = true } = {}) {
    index = Math.max(LUNCH, Math.min(NIGHT, next));
    track.dataset.index = String(index);
    applyTransform();

    panels.forEach((panel, i) => {
      const isCurrent = i === index;
      panel.inert = !isCurrent;
      panel.setAttribute("aria-hidden", String(!isCurrent));
    });

    tabButtons.forEach((button) => {
      const isActive = Number(button.dataset.target) === index;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    if (homeButton) {
      homeButton.classList.toggle("is-active", index === COVER);
      homeButton.setAttribute("aria-pressed", String(index === COVER));
    }

    updateArrows();

    // 「予約」リンク(ヘッダー・下部バー)は表示中の店のアカウントへ(TOPでは夜=まる皿うぱ)
    const reserveUrl = index === LUNCH ? instagramUrls.lunch : instagramUrls.night;
    reserveLinks.forEach((link) => {
      link.href = reserveUrl;
    });

    if (announce && liveRegion) liveRegion.textContent = panelNames[index];
    try {
      history.replaceState(null, "", hashes[index]);
    } catch {
      /* file:// 直開きなどで失敗しても動作に影響なし */
    }
  }

  // --- ボタン類 ---

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => goTo(Number(button.dataset.target)));
  });

  homeButton?.addEventListener("click", () => goTo(COVER));
  arrowLeft?.addEventListener("click", () => goTo(index - 1));
  arrowRight?.addEventListener("click", () => goTo(index + 1));

  document.querySelectorAll(".js-go-lunch").forEach((button) => {
    button.addEventListener("click", () => goTo(LUNCH));
  });
  document.querySelectorAll(".js-go-night").forEach((button) => {
    button.addEventListener("click", () => goTo(NIGHT));
  });

  document.querySelectorAll(".js-scroll-hint").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.closest(".panel-hero")?.nextElementSibling;
      next?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  panels.forEach((panel) => {
    panel.querySelector(".fv-panel-scroll")?.addEventListener("scroll", updateArrows, { passive: true });
  });

  // --- スクロールで現れる要素 ---

  const revealTargets = Array.from(document.querySelectorAll(".js-reveal"));

  if ("IntersectionObserver" in window && revealTargets.length > 0) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove("is-waiting");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.25 },
    );

    revealTargets.forEach((el) => {
      el.classList.add("is-waiting");
      revealObserver.observe(el);
    });
  }

  // --- スワイプ(指に追従して離すとスナップ) ---

  const DRAG_START_PX = 12;
  const EDGE_RESISTANCE = 0.35;

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let deltaX = 0;
  let dragging = false;
  let justDragged = false;

  function dampenAtEdges(dx) {
    if ((index === LUNCH && dx > 0) || (index === NIGHT && dx < 0)) {
      return dx * EDGE_RESISTANCE;
    }
    return dx;
  }

  viewport.addEventListener(
    "pointerdown",
    (event) => {
      if (dragging) return; // スワイプ中の別指は無視
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startTime = event.timeStamp;
      deltaX = 0;
      dragging = false;
    },
    { passive: true },
  );

  viewport.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (!dragging) {
      if (Math.abs(dx) < DRAG_START_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      dragging = true;
      track.classList.add("is-dragging");
      try {
        viewport.setPointerCapture(pointerId);
      } catch {
        /* 取得できない環境でも追従はできる */
      }
    }

    deltaX = dampenAtEdges(dx);
    applyTransform(deltaX);
  });

  function endDrag(event, cancelled) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;

    if (!dragging) return;
    dragging = false;
    track.classList.remove("is-dragging");

    const elapsed = Math.max(event.timeStamp - startTime, 1);
    const velocity = deltaX / elapsed; // px/ms
    const threshold = viewport.clientWidth * 0.2;
    const shouldMove = !cancelled && (Math.abs(deltaX) > threshold || Math.abs(velocity) > 0.5);

    if (shouldMove) {
      goTo(deltaX < 0 ? index + 1 : index - 1);
    } else {
      applyTransform();
    }

    justDragged = true;
    setTimeout(() => {
      justDragged = false;
    }, 0);
    deltaX = 0;
  }

  window.addEventListener("pointerup", (event) => endDrag(event, false));
  window.addEventListener("pointercancel", (event) => endDrag(event, true));

  // ドラッグ直後のclickでボタンが反応しないように握りつぶす
  viewport.addEventListener(
    "click",
    (event) => {
      if (!justDragged) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );

  // --- トラックパッドの横スクロール ---

  let wheelLocked = false;

  viewport.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return; // 縦はパネル内スクロールに任せる
      event.preventDefault();
      if (wheelLocked || Math.abs(event.deltaX) < 12) return;
      wheelLocked = true;
      setTimeout(() => {
        wheelLocked = false;
      }, 600);
      goTo(event.deltaX > 0 ? index + 1 : index - 1);
    },
    { passive: false },
  );

  // --- キーボード ---

  document.querySelector(".fv")?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index + 1);
    }
  });

  // --- ハッシュ(#lunch / #night)で直接タブを開く ---

  function indexFromHash(hash) {
    const i = hashes.indexOf(hash);
    return i === -1 ? COVER : i;
  }

  window.addEventListener("hashchange", () => {
    goTo(indexFromHash(location.hash));
  });

  goTo(indexFromHash(location.hash), { announce: false });
}
