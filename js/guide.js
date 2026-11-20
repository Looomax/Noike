/* Noike — bandes, liens portrait ↔ questions, boutons du candidat.
   Le menu, l'animation du voile et l'apparition des éléments viennent de main.js. */

(() => {
  /* ---------- Bandes des dimensions : une seule ouverte à la fois ---------- */
  const bands = Array.from(document.querySelectorAll("[data-bands] .band"));
  bands.forEach((band) => {
    const button = band.querySelector(".band__btn");
    button.addEventListener("click", () => {
      bands.forEach((other) => {
        const open = other === band;
        other.classList.toggle("is-open", open);
        other.querySelector(".band__btn").setAttribute("aria-expanded", String(open));
      });
    });
  });

  /* ---------- Portrait → guide : des fils relient chaque trait à sa question ---------- */
  const guide = document.querySelector("[data-guide]");
  if (guide) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = guide.querySelector(".guide__links");
    const grid = guide.querySelector(".guide__grid");
    const left = guide.querySelector(".gcard--portrait");
    const right = guide.querySelector(".gcard--ask");

    const draw = () => {
      svg.replaceChildren();
      if (window.innerWidth < 860) return;
      const g = grid.getBoundingClientRect();
      const l = left.getBoundingClientRect();
      const r = right.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${g.width} ${g.height}`);

      guide.querySelectorAll("[data-pair]").forEach((row, index) => {
        const id = row.dataset.pair;
        const ask = guide.querySelector(`[data-ask="${id}"]`);
        const a = row.getBoundingClientRect();
        const b = ask.getBoundingClientRect();
        const x1 = l.right - g.left;
        const y1 = a.top + a.height / 2 - g.top;
        const x2 = r.left - g.left;
        const y2 = b.top + b.height / 2 - g.top;
        const dx = (x2 - x1) * 0.5;

        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", `M${x1} ${y1} C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`);
        path.dataset.id = id;
        path.style.setProperty("--k", index);
        svg.append(path);
        path.style.setProperty("--len", path.getTotalLength());

        [[x1, y1], [x2, y2]].forEach(([cx, cy]) => {
          const dot = document.createElementNS(NS, "circle");
          dot.setAttribute("cx", cx);
          dot.setAttribute("cy", cy);
          dot.setAttribute("r", 4);
          dot.dataset.id = id;
          dot.style.setProperty("--k", index);
          svg.append(dot);
        });
      });
    };

    const link = (id, on) => {
      guide.querySelectorAll(`[data-pair="${id}"], [data-ask="${id}"]`).forEach((el) => el.classList.toggle("is-linked", on));
      svg.querySelectorAll(`[data-id="${id}"]`).forEach((el) => el.classList.toggle("is-linked", on));
    };

    guide.querySelectorAll("[data-pair], [data-ask]").forEach((el) => {
      const id = el.dataset.pair || el.dataset.ask;
      el.addEventListener("mouseenter", () => link(id, true));
      el.addEventListener("mouseleave", () => link(id, false));
    });

    draw();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
    new ResizeObserver(draw).observe(grid);
  }

  /* ---------- Carte du candidat : les boutons Conserver et Partager s'activent ---------- */
  document.querySelectorAll("[data-cand]").forEach((button) => {
    button.addEventListener("click", () => {
      button.setAttribute("aria-pressed", String(button.getAttribute("aria-pressed") !== "true"));
    });
  });
})();
