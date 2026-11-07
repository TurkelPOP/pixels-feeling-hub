// Volet d'aide latéral : s'ouvre à hauteur de la section où l'on a cliqué sur « ? ».
// N'importe quel élément avec data-help="<id du sujet>" l'ouvre (boutons « ? », liens dans l'aide…).
(() => {
  const H = window.PTZ_HELP;
  if (!H) return;
  const byId = new Map(H.topics.map((t) => [t.id, t]));
  const fill = (html) => html.replaceAll("{{origin}}", location.origin).replaceAll("{{host}}", location.host);

  /** Contenu d'un sujet (HTML statique de help-content.js, jamais de données utilisateur). */
  function topicHtml(id) {
    if (id === "index") {
      return `<p class="muted small">Clique sur un « ? » dans une section pour l'aide qui la concerne.</p>
<ol class="help-index">${H.topics.map((t) => `<li><a data-help="${t.id}" href="#">${t.title}</a></li>`).join("")}</ol>`;
    }
    return fill(byId.get(id)?.html ?? "<p>Sujet introuvable.</p>");
  }
  const topicTitle = (id) => (id === "index" ? "Aide" : (byId.get(id)?.title ?? "Aide"));

  // ---------- page /aide complète (accessible sans être connecté) ----------
  const full = document.getElementById("help-full");
  if (full) {
    full.innerHTML =
      `<div class="toc card"><strong>Sommaire</strong><ol>${H.topics.map((t) => `<li><a href="#${t.id}">${t.title}</a></li>`).join("")}</ol></div>` +
      H.topics.map((t) => `<section id="${t.id}" class="card help-body"><h2>${t.title}</h2>${topicHtml(t.id)}</section>`).join("");
    // Sur cette page, les liens entre sujets font défiler au lieu d'ouvrir le volet.
    full.addEventListener("click", (e) => {
      const a = e.target.closest("[data-help]");
      if (!a) return;
      e.preventDefault();
      document.getElementById(a.dataset.help)?.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", `#${a.dataset.help}`);
    });
    return;
  }

  // ---------- volet ----------
  let panel, body, title, backBtn, anchor = null, anchorTopic = null;
  const ANCHOR = ".flow, .card, section, header";
  /** La section peut être redessinée par l'app : on la retrouve par son bouton « ? ». */
  function currentAnchor() {
    if (anchor?.isConnected) return anchor;
    const q = anchorTopic && document.querySelector(`main [data-help="${CSS.escape(anchorTopic)}"]`);
    anchor = q ? (q.closest(ANCHOR) ?? q) : null;
    return anchor;
  }
  const stack = [];

  function build() {
    panel = document.createElement("aside");
    panel.className = "help-panel";
    panel.setAttribute("role", "complementary");
    panel.setAttribute("aria-label", "Aide");
    panel.hidden = true;
    panel.innerHTML = `
<header class="help-panel-head">
  <button type="button" class="help-icon" data-act="back" aria-label="Retour" hidden>‹</button>
  <h2 class="help-panel-title"></h2>
  <button type="button" class="help-icon" data-act="index" aria-label="Sommaire de l'aide">☰</button>
  <button type="button" class="help-icon" data-act="close" aria-label="Fermer l'aide">✕</button>
</header>
<div class="help-panel-body help-body"></div>`;
    document.body.append(panel);
    body = panel.querySelector(".help-panel-body");
    title = panel.querySelector(".help-panel-title");
    backBtn = panel.querySelector('[data-act="back"]');
    panel.addEventListener("click", (e) => {
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act === "close") close();
      else if (act === "index") show("index", true);
      else if (act === "back" && stack.length > 1) {
        stack.pop();
        show(stack.pop(), true);
      }
    });
  }

  /** Aligne le haut du volet sur la section concernée, sans sortir de l'écran. */
  function place() {
    if (!panel || panel.hidden) return;
    if (matchMedia("(max-width: 760px)").matches) {
      panel.style.top = panel.style.maxHeight = "";
      return;
    }
    const head = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
    const min = Math.max(head, 0) + 12;
    const max = Math.max(min, innerHeight - 360);
    const a = currentAnchor();
    const want = a ? a.getBoundingClientRect().top : min;
    const top = Math.min(Math.max(want, min), max);
    panel.style.top = `${top}px`;
    panel.style.maxHeight = `${innerHeight - top - 16}px`;
  }

  function show(id, keepAnchor) {
    if (!panel) build();
    if (stack.at(-1) !== id) stack.push(id);
    title.textContent = topicTitle(id);
    body.innerHTML = topicHtml(id);
    body.scrollTop = 0;
    backBtn.hidden = stack.length < 2;
    panel.hidden = false;
    document.body.classList.add("help-open");
    if (!keepAnchor) place();
    for (const a of body.querySelectorAll('a[target="_blank"]')) a.rel = "noopener";
  }

  function open(id, from) {
    stack.length = 0;
    anchor = from ?? null;
    anchorTopic = id;
    show(id, false);
    place();
    panel.querySelector('[data-act="close"]').focus({ preventScroll: true });
  }

  function close() {
    if (!panel) return;
    panel.hidden = true;
    document.body.classList.remove("help-open");
    anchor = anchorTopic = null;
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-help]");
    if (!t) return;
    e.preventDefault();
    // Lien à l'intérieur du volet : on navigue sans bouger le volet.
    if (panel?.contains(t)) return show(t.dataset.help, true);
    open(t.dataset.help, t.closest(ANCHOR) ?? t);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && panel && !panel.hidden) close();
  });
  addEventListener("scroll", place, { passive: true });
  addEventListener("resize", place);

  window.PTZ_HELP.open = open;
  window.PTZ_HELP.close = close;
  window.PTZ_HELP.fill = fill;
})();
