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

/* Tous les H2 : ils passent du flou au net, d'un bloc, quand on arrive dessus (sauf « Levez le voile », animé par le scroll).
   Le H2 n'est caché que si ce script tourne : sans JavaScript ou avec « animations réduites », il reste visible. */
(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const titles = [...document.querySelectorAll("main h2")].filter((h) => !h.classList.contains("rv"));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in-h2");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.6, rootMargin: "0px 0px -10% 0px" }
  );
  titles.forEach((h) => {
    h.classList.add("h2-anim");
    io.observe(h);
  });
})();
