/* Noike — page d'accueil : l'onglet choisi du comparatif reste visible dans la rangée qui défile. */
document.querySelectorAll(".ctab").forEach((tab) => {
  tab.addEventListener("click", () => {
    tab.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  });
});
