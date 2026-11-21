/* Noike — page d'accueil
   Trois petits comportements : menu mobile, onglets des fonctionnalités, animation « Levez le voile ».
   Tout reste lisible si le script ne se charge pas. */

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Menu mobile ---------- */
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("menu");
  const mobileQuery = window.matchMedia("(max-width: 53.75rem)");

  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      menu.hidden = !open;
    };

    const sync = () => {
      if (mobileQuery.matches) setOpen(false);
      else menu.hidden = false;
    };

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (event) => {
      if (event.target.closest("a") && mobileQuery.matches) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    mobileQuery.addEventListener("change", sync);
    sync();
  }

  /* ---------- Les points des échelles glissent jusqu'à leur place quand on les voit ---------- */
  const revealTargets = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealTargets.forEach((el) => el.classList.add("is-in"));
  } else {
    /* On observe la partie qui s'anime (le visuel), pas la carte entière : sur une grande carte,
       l'animation partait dès que le haut apparaissait, alors que le visuel était encore hors écran.
       Elle part quand le visuel est bien entré dans l'écran (60 % visible, hors du bord bas). */
    const animatedPart = (el) => el.querySelector(".tile__vis, .tri__scales, .guide__grid, .cap__bar, .scale") || el;
    const hosts = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            hosts.get(entry.target).classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.6, rootMargin: "0px 0px -10% 0px" }
    );
    revealTargets.forEach((el) => {
      const part = animatedPart(el);
      hosts.set(part, el);
      io.observe(part);
    });
  }

  /* ---------- Onglets des fonctionnalités ---------- */
  const tabsRoot = document.querySelector("[data-tabs]");
  if (tabsRoot) {
    const tabs = Array.from(tabsRoot.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));

    const select = (index, focus) => {
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
        if (active) {
          panels[i].classList.remove("is-in");
          void panels[i].offsetWidth;
          panels[i].classList.add("is-in");
        }
      });
      if (focus) tabs[index].focus();
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(i, false));
      tab.addEventListener("keydown", (event) => {
        const last = tabs.length - 1;
        let next = null;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") next = i === last ? 0 : i + 1;
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = i === 0 ? last : i - 1;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = last;
        if (next !== null) {
          event.preventDefault();
          select(next, true);
        }
      });
    });
  }

  /* ---------- Levez le voile : la progression du scroll pilote l'animation (variable CSS --p, de 0 à 1) ---------- */
  const voile = document.querySelector("[data-voile]");
  if (voile && !reduceMotion) {
    const sticky = voile.querySelector(".voile__sticky");
    let ticking = false;
    let locked = false;

    const clamp = (value) => Math.min(1, Math.max(0, value));
    const setProgress = (p) => voile.style.setProperty("--p", p.toFixed(4));

    const update = () => {
      ticking = false;
      if (locked) return;
      const rect = voile.getBoundingClientRect();
      const viewport = window.innerHeight;
      const travel = voile.offsetHeight - sticky.offsetHeight;

      if (travel > 8) {
        /* Écran large : la carte reste épinglée pendant que l'animation se joue */
        const stickTop = parseFloat(getComputedStyle(sticky).top) || 0;
        /* Délai de scroll (data-voile-delay, en part de la hauteur d'écran) : la carte reste collée sans rien
           animer APRÈS la fin de l'animation (plus de délai au début : l'animation part dès que la carte se colle) */
        const delay = (parseFloat(voile.dataset.voileDelay) || 0) * viewport;
        const span = Math.max(travel - delay, 1);
        setProgress(clamp((stickTop - rect.top) / span));
      } else {
        /* Petit écran : l'animation se joue pendant que la carte traverse l'écran */
        setProgress(clamp((viewport * 0.9 - rect.top) / (viewport * 0.6)));
      }
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    /* Au clavier, on ne laisse jamais un bouton invisible : le focus affiche tout */
    voile.addEventListener("focusin", () => {
      locked = true;
      setProgress(1);
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }
})();
