/* Noike — page Produit : la timeline des sept étapes.
   Un repère à mi-hauteur d'écran : le trait noir descend jusqu'à lui, les pastilles qu'il a dépassées s'allument.
   Sans JavaScript ou avec « animations réduites », rien n'est masqué ni animé. */
(() => {
  const tl = document.querySelector("[data-timeline]");
  if (!tl || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const steps = [...tl.querySelectorAll(".etape")];
  const nodes = steps.map((s) => s.querySelector(".etape__node"));
  let ticking = false;
  let lastY = window.scrollY;
  let stopTimer;

  const update = () => {
    ticking = false;
    const mark = window.innerHeight * 0.55;
    const centers = nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    const span = centers[centers.length - 1] - centers[0];
    const fill = Math.min(Math.max(mark - centers[0], 0), span);
    tl.style.setProperty("--fill", `${fill}px`);

    let current = -1;
    centers.forEach((c, i) => {
      const done = c <= mark;
      steps[i].classList.toggle("is-done", done);
      if (done) current = i;
    });
    steps.forEach((s, i) => s.classList.toggle("is-current", i === current));

    /* la tête du trait ne brille que pendant le scroll */
    if (Math.abs(window.scrollY - lastY) > 0) {
      tl.classList.add("is-moving");
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => tl.classList.remove("is-moving"), 400);
    }
    lastY = window.scrollY;
  };

  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  /* Au clavier, l'étape qui reçoit le focus s'allume */
  tl.addEventListener("focusin", (e) => {
    const li = e.target.closest(".etape");
    if (li) li.classList.add("is-done");
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();
