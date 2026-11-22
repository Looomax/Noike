/* Noike — page Produit : les sept étapes.
   Écran large : la scène est épinglée ; la progression du scroll (de 0 à 1) choisit l'étape affichée et remplit la rail.
   Mobile, sans JavaScript ou avec « animations réduites » : les étapes se lisent à la suite, rien n'est épinglé. */
document.querySelectorAll("[data-timeline]").forEach((tl) => {
  const wide = window.matchMedia("(min-width: 53.8125rem)");
  if (!tl || !document.documentElement.classList.contains("js-anim")) return;

  const stage = tl.querySelector(".timeline__stage");
  const btns = [...tl.querySelectorAll(".rail__btn")];
  const panels = [...tl.querySelectorAll(".panel")];
  const n = panels.length;
  let ticking = false;

  const range = () => tl.offsetHeight - stage.offsetHeight;

  const update = () => {
    ticking = false;
    if (!wide.matches) return;
    const p = Math.min(1, Math.max(0, -tl.getBoundingClientRect().top / range()));
    const f = p * n;
    const idx = Math.min(n - 1, Math.floor(f));
    tl.style.setProperty("--fill", Math.min(1, f / (n - 1)).toFixed(4));
    btns.forEach((b, i) => {
      b.classList.toggle("is-done", i <= idx);
      b.classList.toggle("is-active", i === idx);
      if (i === idx) b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    panels.forEach((el, i) => {
      el.classList.toggle("is-active", i === idx);
    });
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  /* Un clic sur une pastille amène à l'étape */
  btns.forEach((b, i) => {
    b.addEventListener("click", () => {
      const top = tl.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + ((i + 0.5) / n) * range(), behavior: "smooth" });
    });
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  wide.addEventListener("change", onScroll);
  update();
});
