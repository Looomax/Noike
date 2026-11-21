/* Noike — page d'accueil : l'onglet choisi du comparatif reste visible dans la rangée qui défile. */
document.querySelectorAll(".ctab").forEach((tab) => {
  tab.addEventListener("click", () => {
    tab.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
});

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
