const e = new URLSearchParams(location.search).get("e");
if (e) {
  const el = document.getElementById("err");
  el.hidden = false;
  el.textContent = e === "wait" ? "Trop d'essais, réessaie dans 15 minutes." : "Mot de passe incorrect.";
}
