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
    if (!d.twoFactor) return;
    document.getElementById("code-row").hidden = false;
    document.getElementById("code").required = true;
  })
  .catch(() => {});
