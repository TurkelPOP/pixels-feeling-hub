const e = new URLSearchParams(location.search).get("e");
if (e) {
  const el = document.getElementById("err");
  el.hidden = false;
  el.textContent = e === "wait" ? "Trop d'essais, réessaie dans 15 minutes." : "Identifiants incorrects.";
}
// Affiche le champ du code quand la double authentification est activée.
fetch("/login/info")
  .then((r) => r.json())
  .then((d) => {
    const name = document.getElementById("name");
    if (d.nameRequired) name.required = true;
    else name.placeholder = "vide = propriétaire";
    if (!d.twoFactor) return;
    // Pas obligatoire : à la toute première connexion, il n'y a pas encore de code ; l'app propose
    // alors d'activer la double authentification juste après le mot de passe.
    document.getElementById("code-row").hidden = false;
  })
  .catch(() => {});
