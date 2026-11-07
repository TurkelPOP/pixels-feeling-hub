// Petites aides des pages serveur (double authentification…). Aucune donnée n'est envoyée.
for (const btn of document.querySelectorAll(".copy-key")) {
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.key);
      btn.textContent = "Clé copiée ✓";
    } catch {
      btn.textContent = btn.dataset.key;
    }
  });
}
