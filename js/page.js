/* Noike — page d'accueil : l'onglet choisi du comparatif reste visible dans la rangée qui défile. */
document.querySelectorAll(".ctab").forEach((tab) => {
  tab.addEventListener("click", () => {
    tab.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
});

/* « Levez le voile » : pendant que la section reste collée à l'écran, le fond du site passe à #111111 (avec un fondu).
   Il redevient normal dès que le scroll reprend après l'animation. Seulement quand la section est épinglée (grand écran). */
(() => {
  const voile = document.querySelector("[data-voile]");
  const sticky = voile && voile.querySelector(".voile__sticky");
  if (!sticky) return;
  const pinned = window.matchMedia("(min-width: 56.25rem) and (min-height: 40rem) and (prefers-reduced-motion: no-preference)");
  const root = document.documentElement;
  let ticking = false;

  const update = () => {
    ticking = false;
    if (!pinned.matches) { root.classList.remove("is-night"); return; }
    const travel = voile.offsetHeight - sticky.offsetHeight;
    const stickTop = parseFloat(getComputedStyle(sticky).top) || 0;
    const offset = voile.getBoundingClientRect().top - stickTop;   // 0 = la section vient de se coller
    // Le fond fonce juste avant que la section se colle (80 px) et revient quand elle se décolle
    root.classList.toggle("is-night", offset <= 80 && offset > -travel);
  };
  const onScroll = () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();

/* Info-bulle du comparatif : au toucher, un tap ouvre ou ferme ; Échap ou un tap ailleurs referme. */
(() => {
  const tip = document.querySelector(".tip");
  const btn = tip && tip.querySelector(".tip__btn");
  if (!btn) return;
  const set = (open) => { tip.classList.toggle("is-open", open); btn.setAttribute("aria-expanded", String(open)); };
  btn.addEventListener("click", () => set(!tip.classList.contains("is-open")));
  document.addEventListener("click", (e) => { if (!tip.contains(e.target)) set(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
})();
