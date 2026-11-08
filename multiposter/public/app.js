// PTZ Posting — interface (vanilla JS, aucune dépendance).

const PROVIDER = {
  youtube: { label: "YouTube", color: "#ff3b3b" },
  tiktok: { label: "TikTok", color: "#25f4ee" },
  instagram: { label: "Instagram", color: "#e1306c" },
  facebook: { label: "Facebook", color: "#1877f2" },
  threads: { label: "Threads", color: "#cfcfcf" },
  x: { label: "X", color: "#f5f5f5" },
  canva: { label: "Canva", color: "#20c4cb" },
  gdrive: { label: "Google Drive", color: "#34a853" },
};

/** Petits logos des réseaux (SVG 24×24 dessinés en traits simples, couleur = celle du réseau). */
const ICON_PATHS = {
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="currentColor"/><path d="M10 9.2v5.6l4.8-2.8z" fill="#0b1440"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/>',
  facebook: '<circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M13.2 21.4v-6.6h2.2l.4-2.7h-2.6v-1.7c0-.8.3-1.3 1.4-1.3h1.3V6.7c-.3 0-1.1-.1-2-.1-2 0-3.3 1.2-3.3 3.4v2.1H8.4v2.7h2.2v6.6z" fill="#0b1440"/>',
  threads: '<path d="M16.6 11.3c-.3-2.6-2-3.9-4.4-3.9-1.8 0-3.2.8-3.9 2.1M16.4 11.2c-3.6-.9-7 .1-7 2.6 0 1.7 1.7 2.6 3.4 2.4 2.4-.3 3.5-2.2 3.4-5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16.4 11.2c2.4.9 3.2 3 2.4 5.2-1 2.6-3.6 4.1-6.8 4.1-4.6 0-7.5-3.1-7.5-8.5S7.4 3.5 12 3.5c3.7 0 6.2 1.9 7.2 5.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  x: '<path d="M4 4h4.6l11.4 16h-4.6z" fill="currentColor"/><path d="M19.2 4 4.8 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  tiktok: '<path d="M13.5 3.5v11.2a3.3 3.3 0 1 1-3.3-3.3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M13.5 3.8c.4 2.6 2.2 4.3 4.8 4.5" fill="none" stroke="#fe2c55" stroke-width="2.4" stroke-linecap="round"/>',
  gdrive: '<path d="M8.6 3.5h6.8l6.1 10.6h-6.8z" fill="#fbbc04"/><path d="M8.6 3.5 2.5 14.1l3.4 5.9 6.1-10.6z" fill="#34a853"/><path d="M5.9 20h12.2l3.4-5.9H9.3z" fill="#4285f4"/>',
  canva: '<circle cx="12" cy="12" r="9.5" fill="currentColor"/><path d="M15.4 9.4a3.8 3.8 0 1 0 .1 5.2" fill="none" stroke="#0b1440" stroke-width="2.2" stroke-linecap="round"/>',
};
/** Icônes des outils médias (galerie, appareil photo, vidéo, musique) + logos Canva et Drive. */
const TOOL_SVG = {
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.8"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="m15.5 10.5 6-3.5v10l-6-3.5z"/><circle cx="6.5" cy="10" r="1" fill="currentColor"/></svg>',
  gallery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9.5" r="1.8"/><path d="m3.5 17 5.5-5 4 3.5 2.5-2 5 4"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
};
function paintToolIcons() {
  for (const el of document.querySelectorAll(".tool-ico[data-ico]")) {
    const k = el.dataset.ico;
    if (TOOL_SVG[k]) el.innerHTML = TOOL_SVG[k];
    else el.replaceChildren(netIcon(k, "100%"));
  }
}

function netIcon(provider, size = "1em") {
  const span = h("span", { class: "net-icon", "aria-hidden": "true", style: `--c:${PROVIDER[provider]?.color ?? "#888"};width:${size};height:${size}` });
  if (ICON_PATHS[provider]) span.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%">${ICON_PATHS[provider]}</svg>`;
  return span;
}
const STATUS = {
  draft: "Brouillon",
  scheduled: "Programmé",
  publishing: "Publication…",
  done: "Publié",
  partial: "Partiel",
  failed: "Échec",
  pending: "En attente",
  review: "À valider",
};

const state = {
  meta: null,
  accounts: [],
  posts: [],
  filter: "upcoming",
  search: "",
  mode: "list",
  month: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  editingId: null,
  selected: new Set(),
  overrides: {},
  targetOptions: {},
  errors: {},
  media: [],
  uploading: 0,
  canva: { status: null, items: [], continuation: null, query: "" },
  hashtags: { sets: [], top: [], editing: false },
  mentions: [],
  textTab: "all",
  slots: [],
  templates: [],
  slotEditing: false,
  drive: { status: null, items: [], next: null, query: "", mode: "recent", path: [], picked: new Map() },
  profiles: [],
  profileFilter: "",
  me: null,
  appGroups: null,
};

// ---------- utilitaires ----------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    // Liens : uniquement http(s) ou internes (jamais javascript:, même venant d'une API).
    else if ((k === "href" || k === "src") && !/^(https?:|\/|#|data:image\/|blob:)/i.test(String(v))) continue;
    else if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

const $ = (sel) => document.querySelector(sel);

// Comme h() : un enfant null ou false est ignoré (sinon le navigateur affiche le texte « null »).
{
  const native = Element.prototype.replaceChildren;
  Element.prototype.replaceChildren = function (...nodes) {
    return native.apply(this, nodes.filter((n) => n != null && n !== false));
  };
}

/** Bouton « ? » : ouvre le volet d'aide sur le sujet, à hauteur de la section (voir help.js). */
const helpQ = (topic, label = "Aide") =>
  h("button", { class: "help-q", type: "button", "data-help": topic, "aria-label": label, title: label }, "?");

/** Titre de carte avec son « ? » à droite. */
const cardTitle = (text, topic) => h("div", { class: "card-title" }, h("strong", {}, text), helpQ(topic));

/** Tuto intégré dans une carte (HTML statique de help-content.js). */
function tuto(html) {
  const div = h("div", { class: "help-body tuto" });
  div.innerHTML = window.PTZ_HELP?.fill(html) ?? "";
  for (const a of div.querySelectorAll('a[target="_blank"]')) a.rel = "noopener";
  return div;
}
const NETS = () => window.PTZ_HELP?.networks ?? {};

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { "X-Requested-With": "multiposter", ...(opts.body && typeof opts.body === "string" ? { "Content-Type": "application/json" } : {}), ...opts.headers },
  });
  if (res.status === 401) location.href = "/login";
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Erreur ${res.status}`), { data });
  return data;
}

let toastTimer;
function toast(msg, kind = "ok") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast ${kind}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), kind === "err" ? 8000 : 4000);
}

const countChars = (s) => [...new Intl.Segmenter().segment(s)].length;
const fmtDate = (ms) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(ms);
const fmtTime = (ms) => new Intl.DateTimeFormat("fr-FR", { timeStyle: "short" }).format(ms);
const fmtSize = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} Mo` : `${Math.round(b / 1e3)} Ko`);

function toLocalInput(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function badge(provider) {
  const p = PROVIDER[provider] ?? { label: provider, color: "#888" };
  // X : le logo suffit (sinon « X X »).
  return h("span", { class: "badge", style: `--c:${p.color}`, title: p.label }, netIcon(provider), provider === "x" ? null : p.label);
}

function avatar(a) {
  return a.avatarUrl
    ? h("img", { class: "avatar", src: a.avatarUrl, alt: "", referrerpolicy: "no-referrer", loading: "lazy" })
    : h("span", { class: "avatar placeholder" }, (a.name || "?").replace("@", "")[0]?.toUpperCase() ?? "?");
}

// ---------- navigation ----------

function route() {
  const [view, query] = (location.hash.slice(1) || "compose").split("?");
  for (const v of ["compose", "queue", "accounts"]) $(`#view-${v}`).hidden = v !== view;
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("active", a.dataset.view === view));
  if (query) {
    const q = new URLSearchParams(query);
    if (q.get("ok")) toast(q.get("ok"));
    if (q.get("err")) toast(q.get("err"), "err");
    history.replaceState(null, "", `#${view}`);
  }
  if (view === "queue") loadPosts();
  if (view === "accounts") {
    loadAccounts();
    renderSystem();
    renderSecurity();
    renderUsers();
    loadAppSettings().then(() => { renderAccounts(); renderAppSettings(); });
    renderMaintenance();
    renderDevice();
  }
}
window.addEventListener("hashchange", route);

// ---------- comptes ----------

async function loadAccounts() {
  if (!state.people) state.people = await api("/people").catch(() => []);
  [state.accounts, state.profiles] = await Promise.all([api("/accounts"), api("/profiles")]);
  renderAccounts();
  renderProfiles();
  renderPicker();
  renderProfileFilter();
}

// ---------- Profils (groupes de comptes) ----------

const profileAccounts = (pr) => pr.accountIds.filter((id) => state.accounts.some((a) => a.id === id));

function renderProfiles() {
  const box = $("#profiles");
  const nameInput = h("input", { id: "new-profile", placeholder: "Nom du profil, ex. Pixels Perspective", maxlength: 60 });
  const create = async () => {
    try {
      await api("/profiles", { method: "POST", body: JSON.stringify({ name: nameInput.value, accountIds: [] }) });
      toast("Profil créé : coche ses comptes.");
      loadAccounts();
    } catch (e) {
      toast(e.message, "err");
    }
  };
  const cards = state.profiles.map((pr) => {
    if (pr.shared)
      return h("li", { class: "profile shared" },
        h("div", { class: "row profile-head" }, h("strong", {}, pr.name), h("span", { class: "share-badge" }, `↗ partagé par ${pr.ownerName}`)),
        h("p", { class: "muted small" }, `Tu peux préparer des posts pour ces comptes : ils partent en validation chez ${pr.ownerName}.`),
        h("div", { class: "chips" }, ...pr.accountIds.map((id) => state.accounts.find((a) => a.id === id)).filter(Boolean).map((a) =>
          h("span", { class: "chip account-chip small-chip active", style: `--c:${PROVIDER[a.provider]?.color}` }, h("span", { class: "net-label" }, netIcon(a.provider), PROVIDER[a.provider]?.label), h("small", {}, a.name)))));
    const ids = new Set(pr.accountIds);
    const save = async (patch) => {
      try {
        await api(`/profiles/${pr.id}`, { method: "PUT", body: JSON.stringify(patch) });
        loadAccounts();
      } catch (e) {
        toast(e.message, "err");
      }
    };
    const title = h("input", { class: "profile-name", value: pr.name, maxlength: 60, "aria-label": "Nom du profil" });
    title.addEventListener("change", () => save({ name: title.value }));
    return h("li", { class: "profile" },
      h("div", { class: "row profile-head" }, title,
        h("button", {
          class: "btn ghost small danger", type: "button",
          onclick: async () => {
            if (!confirm(`Supprimer le profil « ${pr.name} » ? Les comptes eux-mêmes restent connectés.`)) return;
            await api(`/profiles/${pr.id}`, { method: "DELETE" });
            loadAccounts();
          },
        }, "Supprimer")),
      state.accounts.some((a) => !a.shared)
        ? h("div", { class: "chips" }, ...state.accounts.filter((a) => !a.shared).map((a) =>
            h("button", {
              type: "button", class: `chip account-chip small-chip ${ids.has(a.id) ? "active" : ""}`, style: `--c:${PROVIDER[a.provider]?.color}`,
              onclick: () => {
                ids.has(a.id) ? ids.delete(a.id) : ids.add(a.id);
                save({ accountIds: [...ids] });
              },
            }, h("span", {}, PROVIDER[a.provider]?.label), h("small", {}, a.name))))
        : h("p", { class: "muted small" }, "Connecte d'abord des comptes ci-dessus."),
      state.people?.length
        ? h("div", { class: "chips share-row" }, h("small", { class: "muted" }, "Partager avec :"),
            ...state.people.map((u) => {
              const on = (pr.sharedWith ?? []).includes(u.id);
              return h("button", { type: "button", class: `chip small-chip${on ? " active" : ""}`, title: on ? "Ne plus partager" : `${u.name} pourra proposer des posts pour ce profil (tu les valides)`,
                onclick: async () => {
                  const next = on ? pr.sharedWith.filter((x) => x !== u.id) : [...(pr.sharedWith ?? []), u.id];
                  if (!on && !confirm(`Partager « ${pr.name} » avec ${u.name} ?\n\n${u.name} pourra préparer des posts pour ces comptes. Rien ne sera publié sans ta validation, et ${u.name} ne verra ni tes autres posts ni les accès des comptes.`)) return;
                  await api(`/profiles/${pr.id}/shares`, { method: "PUT", body: JSON.stringify({ userIds: next }) });
                  toast(on ? `Plus partagé avec ${u.name}.` : `Partagé avec ${u.name}.`);
                  loadAccounts();
                } }, on ? "✓ " : "", u.name);
            }))
        : null);
  });
  box.replaceChildren(
    h("div", { class: "card system" },
      cardTitle("Profils", "profils"),
      h("p", { class: "muted small" }, "Regroupe les comptes d'une même identité (par exemple Pixels Perspective : Instagram, Facebook, Threads). Dans l'éditeur, un clic sur le profil coche tous ses comptes."),
      cards.length ? h("ul", { class: "profile-list" }, ...cards) : null,
      h("div", { class: "row" }, nameInput, h("button", { class: "btn primary small", type: "button", onclick: create }, "Créer le profil"))),
  );
}

function renderProfileFilter() {
  const sel = $("#profile-filter");
  sel.hidden = state.profiles.length === 0;
  sel.replaceChildren(h("option", { value: "" }, "Tous les profils"), ...state.profiles.map((pr) => h("option", { value: String(pr.id) }, pr.name)));
  sel.value = state.profileFilter;
}

/** Posts visibles selon le profil choisi dans le Planning. */
function profilePosts() {
  const pr = state.profiles.find((x) => String(x.id) === state.profileFilter);
  if (!pr) return state.posts;
  const ids = new Set(pr.accountIds);
  return state.posts.filter((p) => p.targets.some((t) => ids.has(t.accountId)));
}

function canvaCard() {
  const s = state.canva.status;
  return h(
    "div",
    { class: "card flow canva" },
    h("div", {}, h("div", { class: "card-title" }, h("strong", { class: "net-label" }, netIcon("canva", "1.25em"), "Canva"), helpQ("net-canva")),
      h("p", { class: "muted small" }, "Récupère tes derniers designs (NEWZ, Good News…) directement dans un post, exportés au bon format.")),
    !s?.configured
      ? notReady("canva")
      : s.connected
        ? h("div", { class: "row connected-row" },
            h("div", { class: "connected-chip" },
              h("span", { class: "avatar-initial", "aria-hidden": "true" }, (s.name ?? "C").trim().charAt(0).toUpperCase()),
              h("span", { class: "connected-text" },
                h("span", { class: "connected-label" }, h("span", { class: "dot-ok", "aria-hidden": "true" }), "Connecté"),
                h("strong", {}, s.name ?? "Canva"))),
            h("button", {
              class: "btn ghost small danger",
              onclick: async () => {
                if (!confirm("Déconnecter Canva ?")) return;
                await api("/canva", { method: "DELETE" });
                await loadCanvaStatus();
                renderAccounts();
              },
            }, "Déconnecter"))
        : h("a", { class: "btn primary small", href: "/oauth/canva/start" }, "Connecter Canva"),
    s?.configured && !s.connected ? userTuto("canva") : null,
    s?.connected ? rulesBox() : null,
    s?.configured && state.me?.role === "owner" ? setupPanel("canva", true) : null,
  );
}

async function loadDriveStatus() {
  try {
    state.drive.status = await api("/gdrive/status");
  } catch {
    state.drive.status = { configured: false, connected: false };
  }
}

const GOOGLE_G = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';

/** Bouton « Se connecter avec Google » (même principe que sur n'importe quel site). */
function googleButton(label = "Se connecter avec Google") {
  const a = h("a", { class: "google-btn", href: "/oauth/gdrive/start" });
  a.innerHTML = GOOGLE_G;
  a.append(h("span", {}, label));
  return a;
}

function driveCard() {
  const s = state.drive.status;
  const owner = state.me?.role === "owner";
  const head = h("div", {},
    h("div", { class: "card-title" }, h("strong", { class: "net-label" }, netIcon("gdrive", "1.25em"), "Google Drive"), helpQ("net-gdrive")),
    h("p", { class: "muted small" }, "Importe tes photos et vidéos de Google Drive dans tes posts."));

  // Pas encore disponible dans l'app (le propriétaire n'a pas activé Google).
  if (!s?.configured)
    return h("div", { class: "card flow canva" }, head,
      h("p", { class: "muted small" }, owner
        ? "À activer une fois : Drive utilise ton projet Google (celui de YouTube). Suis le tuto ci-dessous."
        : "Pas encore disponible : le propriétaire de l'app doit d'abord l'activer."),
      owner && NETS().gdrive ? h("details", { class: "tuto-box" }, h("summary", {}, "Activer Google Drive (propriétaire)"), tuto(NETS().gdrive.owner)) : null);

  // Connecté : le compte, changer de compte, se déconnecter.
  if (s.connected)
    return h("div", { class: "card flow canva" }, head,
      h("div", { class: "row connected-row" },
        h("div", { class: "connected-chip" },
          h("span", { class: "avatar-initial", "aria-hidden": "true" }, (s.name ?? "G").trim().charAt(0).toUpperCase()),
          h("span", { class: "connected-text" },
            h("span", { class: "connected-label" }, h("span", { class: "dot-ok", "aria-hidden": "true" }), "Connecté"),
            h("strong", {}, s.name ?? "Google Drive"))),
        h("a", { class: "btn ghost small", href: "/oauth/gdrive/start" }, "Changer de compte"),
        h("button", { class: "btn ghost small danger", type: "button", onclick: async () => {
          if (!confirm("Déconnecter Google Drive ? L'autorisation est aussi retirée chez Google.")) return;
          await api("/gdrive", { method: "DELETE" });
          await loadDriveStatus();
          renderAccounts();
        } }, "Déconnecter")),
      h("p", { class: "muted small" }, "Dans Nouveau post : « Importer depuis Google Drive »."),
      owner ? h("a", { class: "small", href: "https://console.cloud.google.com/apis/library/drive.googleapis.com", target: "_blank", rel: "noopener" }, "Propriétaire : vérifier que l'API Google Drive est activée ↗") : null);

  // Pas connecté : un seul bouton.
  return h("div", { class: "card flow canva" }, head,
    googleButton(),
    h("p", { class: "muted small" }, "Google te demande de choisir ton compte, puis d'autoriser PTZ Posting à ", h("strong", {}, "lire"), " tes fichiers. L'app ne peut rien modifier ni supprimer dans ton Drive."),
    userTuto("gdrive"));
}

// ---------- import depuis Google Drive ----------

async function openDrive() {
  if (!state.drive.status) await loadDriveStatus();
  const s = state.drive.status;
  state.drive.picked.clear();
  updateDriveImport();
  // Drive non connecté : on importe par lien de partage, sans aucun réglage.
  for (const x of document.querySelectorAll('[data-drive="recent"], [data-drive="folders"]')) x.hidden = !s.connected;
  $("#drive-connect-tip").hidden = s.connected || !s.configured;
  setDriveMode(s.connected ? state.drive.mode : "link");
  $("#drive-dialog").showModal();
}

function setDriveMode(mode) {
  const d = state.drive;
  d.mode = mode;
  d.path = [];
  for (const x of document.querySelectorAll("[data-drive]")) x.classList.toggle("active", x.dataset.drive === mode);
  const link = mode === "link";
  $("#drive-link").hidden = !link;
  for (const id of ["#drive-search", "#drive-list", "#drive-path"]) $(id).hidden = link;
  $(".drive-foot").hidden = link;
  $(".drive-foot").classList.toggle("off", link);
  $("[data-drive]").closest(".segmented").hidden = !d.status?.connected;
  if (link) setTimeout(() => $("#drive-url").focus(), 50);
  else loadDrive();
}

async function importDriveLink() {
  const input = $("#drive-url"), btn = $("#drive-url-go");
  const url = input.value.trim();
  if (!url) return input.focus();
  btn.disabled = true;
  btn.textContent = "Téléchargement…";
  try {
    const { media } = await api("/gdrive/link", { method: "POST", body: JSON.stringify({ url }) });
    state.media.push(...media);
    renderMedia();
    toast(`« ${media[0].filename} » ajouté depuis Google Drive.`);
    input.value = "";
    $("#drive-dialog").close();
  } catch (e) {
    toast(e.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Importer";
  }
}

const driveFolder = () => state.drive.path.at(-1)?.id ?? (state.drive.mode === "folders" ? "root" : null);

async function loadDrive(more = false) {
  const d = state.drive, list = $("#drive-list");
  if (!more) list.replaceChildren(h("p", { class: "muted" }, "Chargement de ton Drive…"));
  renderDrivePath();
  try {
    const q = new URLSearchParams();
    const folder = driveFolder();
    if (folder) q.set("folder", folder);
    if (d.query) q.set("q", d.query);
    if (more && d.next) q.set("page", d.next);
    const r = await api(`/gdrive/files?${q}`);
    d.items = more ? [...d.items, ...r.items] : r.items;
    d.next = r.next;
    renderDrive();
  } catch (e) {
    const url = e.data?.enableUrl;
    list.replaceChildren(h("div", { class: "drive-error" },
      h("p", { class: "error" }, e.message),
      url && state.me?.role === "owner"
        ? h("div", { class: "row" },
            h("a", { class: "btn primary", href: url, target: "_blank", rel: "noopener" }, "Activer l'API Drive chez Google ↗"),
            h("button", { class: "btn ghost", type: "button", onclick: () => loadDrive() }, "C'est fait, réessayer"))
        : url ? h("p", { class: "muted small" }, "Le propriétaire de l'app doit l'activer en un clic (onglet Comptes, carte Google Drive).") : null));
  }
}

function renderDrivePath() {
  const d = state.drive, nav = $("#drive-path");
  if (d.mode !== "folders") return nav.replaceChildren();
  const crumb = (label, i) => h("button", { type: "button", class: "crumb", onclick: () => { d.path = d.path.slice(0, i); loadDrive(); } }, label);
  nav.replaceChildren(crumb("Mon Drive", 0), ...d.path.flatMap((f, i) => [h("span", { class: "muted" }, "›"), crumb(f.name, i + 1)]));
}

function renderDrive() {
  const d = state.drive;
  $("#drive-more").hidden = !d.next;
  if (!d.items.length) return $("#drive-list").replaceChildren(h("p", { class: "muted" }, d.query ? "Aucun fichier trouvé." : "Aucune image ni vidéo ici."));
  const fmtDur = (ms) => `${Math.floor(ms / 60000)}:${String(Math.round(ms / 1000) % 60).padStart(2, "0")}`;
  $("#drive-list").replaceChildren(...d.items.map((f) => {
    if (f.folder)
      return h("button", { type: "button", class: "design drive-folder", onclick: () => { d.path.push({ id: f.id, name: f.name }); loadDrive(); } },
        h("span", { class: "folder-icon", "aria-hidden": "true" }, "📁"), h("strong", { title: f.name }, f.name));
    const picked = d.picked.has(f.id);
    const thumb = h("div", { class: "design-thumb" },
      f.thumbnail ? h("img", { src: f.thumbnail, alt: "", loading: "lazy", referrerpolicy: "no-referrer", onerror: (e) => e.target.remove() }) : null,
      h("span", { class: "drive-kind" }, f.mime.startsWith("video/") ? `🎥${f.duration ? ` ${fmtDur(f.duration)}` : ""}` : "🖼️"),
      h("span", { class: "drive-check", "aria-hidden": "true" }, picked ? "✓" : ""));
    const card = h("button", {
      type: "button",
      class: `design drive-file${picked ? " picked" : ""}${f.supported ? "" : " unsupported"}`,
      "aria-pressed": picked ? "true" : "false",
      title: f.supported ? f.name : `${f.name} : format non pris en charge (exporte-le en JPG ou MP4)`,
      onclick: () => {
        if (!f.supported) return toast("Format non pris en charge : exporte-le en JPG, PNG ou MP4.", "err");
        if (d.picked.has(f.id)) d.picked.delete(f.id);
        else if (d.picked.size >= 20) return toast("20 fichiers maximum à la fois.", "err");
        else d.picked.set(f.id, f);
        renderDrive();
        updateDriveImport();
      },
    }, thumb,
      h("div", { class: "design-body" },
        h("strong", {}, f.name),
        h("small", { class: "muted" }, `${f.modifiedAt ? relTime(f.modifiedAt) : ""}${f.size ? ` · ${fmtSize(f.size)}` : ""}${f.supported ? "" : " · format non pris en charge"}`)));
    return card;
  }));
}


function updateDriveImport() {
  const n = state.drive.picked.size;
  const btn = $("#drive-import");
  btn.disabled = n === 0;
  btn.textContent = n ? `Importer ${n} fichier${n > 1 ? "s" : ""}` : "Choisis des fichiers";
}

async function importDrive() {
  const d = state.drive, btn = $("#drive-import");
  const files = [...d.picked.values()];
  btn.disabled = true;
  btn.textContent = files.some((f) => f.mime.startsWith("video/")) ? "Import en cours (une vidéo peut prendre un moment)…" : "Import en cours…";
  try {
    const { media, errors } = await api("/gdrive/import", { method: "POST", body: JSON.stringify({ ids: files.map((f) => f.id) }) });
    state.media.push(...media);
    renderMedia();
    renderComposeMeta?.();
    if (media.length) toast(`${media.length} fichier${media.length > 1 ? "s" : ""} ajouté${media.length > 1 ? "s" : ""} depuis Google Drive.`);
    if (errors?.length) toast(errors.join(" · "), "err");
    if (media.length) $("#drive-dialog").close();
  } catch (e) {
    toast(e.message, "err");
  } finally {
    updateDriveImport();
  }
}

async function loadCanvaStatus() {
  try {
    state.canva.status = await api("/canva/status");
    state.canva.rules = state.canva.status.connected ? await api("/canva/rules") : [];
  } catch {
    state.canva.status = { configured: false, connected: false };
    state.canva.rules = [];
  }
}

const FORMAT_LABEL = { jpg: "JPG", png: "PNG", mp4: "MP4" };

/** Choix de comptes (profils + comptes) réutilisable ; renvoie l'élément et l'ensemble coché. */
function accountPicker(initial) {
  const picked = new Set(initial);
  const chipOf = new Map();
  if (!state.accounts.length)
    return { picked, el: h("p", { class: "muted small" }, "Aucun réseau connecté pour l'instant : tu pourras les cocher ici plus tard (facultatif), ou les choisir en relisant chaque brouillon.") };
  const profileRow = state.profiles.length
    ? h("div", { class: "chips" }, h("small", { class: "muted" }, "Profils :"),
        ...state.profiles.map((pr) => h("button", {
          type: "button", class: "chip small-chip profile-chip",
          onclick: () => { for (const id of profileAccounts(pr)) { picked.add(id); chipOf.get(id)?.classList.add("active"); } },
        }, pr.name)))
    : null;
  const chips = h("div", { class: "chips" },
    ...state.accounts.map((a) => {
      const chip = h("button", { type: "button", class: `chip account-chip small-chip${picked.has(a.id) ? " active" : ""}`, style: `--c:${PROVIDER[a.provider]?.color}` },
        h("span", { class: "net-label", title: PROVIDER[a.provider]?.label }, netIcon(a.provider), a.provider === "x" ? null : PROVIDER[a.provider]?.label), h("small", {}, a.name));
      chipOf.set(a.id, chip);
      chip.addEventListener("click", () => {
        picked.has(a.id) ? picked.delete(a.id) : picked.add(a.id);
        chip.classList.toggle("active", picked.has(a.id));
      });
      return chip;
    }));
  return { picked, el: h("div", { class: "account-picker-box" }, h("small", { class: "muted" }, "Réseaux cochés d'avance dans le brouillon (facultatif) :"), profileRow, chips) };
}

function rulesBox() {
  const rules = state.canva.rules ?? [];
  const pattern = h("input", { id: "rule-pattern", placeholder: "Début du titre, ex. NEWZ ou Good News", maxlength: 100 });
  const format = h("select", { id: "rule-format" },
    h("option", { value: "jpg" }, "JPG"), h("option", { value: "png" }, "PNG"), h("option", { value: "mp4" }, "MP4"));
  const text = h("textarea", { id: "rule-text", rows: 2, placeholder: "Texte de départ (facultatif). {titre} = titre du design, {date} = jour" });
  const { el: pickerEl, picked } = accountPicker([]);
  const reload = async () => {
    await loadCanvaStatus();
    renderAccounts();
  };
  return h(
    "div",
    { class: "rules" },
    h("div", { class: "card-title" }, h("h3", {}, "Brouillons automatiques"), helpQ("canva")),
    h("p", { class: "muted small" },
      "Quand un design dont le titre commence par ce mot est modifié (par toi ou ta tâche planifiée), l'app l'exporte et prépare un brouillon. Un brouillon par design et par jour : celui de la veille garde ses images, même quand le design est réécrit le lendemain."),
    rules.length
      ? h("ul", { class: "rule-list" },
          ...rules.map((r) => {
            const accts = r.accountIds.map((id) => state.accounts.find((a) => a.id === id)).filter(Boolean);
            const editBox = h("div", { class: "rule-edit", hidden: true });
            const openEdit = () => {
              if (!editBox.hidden) return (editBox.hidden = true);
              const { el, picked } = accountPicker(r.accountIds);
              const fmt = h("select", {}, ...Object.entries(FORMAT_LABEL).map(([v, l]) => h("option", { value: v, selected: v === r.format }, l)));
              editBox.replaceChildren(el, h("div", { class: "row" }, h("small", { class: "muted" }, "Format :"), fmt,
                h("button", { class: "btn primary small", type: "button", onclick: async () => {
                  try {
                    await api(`/canva/rules/${r.id}`, { method: "PUT", body: JSON.stringify({ accountIds: [...picked], format: fmt.value }) });
                    toast("Règle modifiée.");
                    reload();
                  } catch (e) { toast(e.message, "err"); }
                } }, "Enregistrer")));
              editBox.hidden = false;
            };
            return h("li", { class: "rule-item" },
              h("div", { class: "rule-main" },
                h("span", {}, "Titre commençant par ", h("strong", {}, `« ${r.pattern} »`), ` · ${FORMAT_LABEL[r.format]}`),
                accts.length
                  ? h("span", { class: "rule-targets" }, "→ ", ...accts.map((a) => h("span", { class: "net-label", title: `${PROVIDER[a.provider]?.label} · ${a.name}` }, netIcon(a.provider), a.name)))
                  : h("small", { class: "muted" }, "→ aucun réseau coché d'avance : tu les choisiras en relisant le brouillon")),
              h("button", { class: "btn ghost small", type: "button", onclick: openEdit }, "Modifier"),
              h("button", {
                class: "btn ghost small danger", type: "button",
                onclick: async () => {
                  if (!confirm(`Supprimer la règle « ${r.pattern} » ?`)) return;
                  await api(`/canva/rules/${r.id}`, { method: "DELETE" });
                  reload();
                },
              }, "Supprimer"),
              editBox);
          }))
      : h("p", { class: "muted small" }, "Aucune règle pour l'instant."),
    h("div", { class: "rule-form" },
      h("div", { class: "row" }, pattern, format),
      pickerEl,
      text,
      h("div", { class: "row" },
        h("button", {
          class: "btn primary small", type: "button",
          onclick: async () => {
            try {
              await api("/canva/rules", { method: "POST", body: JSON.stringify({ pattern: pattern.value, format: format.value, text: text.value, accountIds: [...picked] }) });
              toast("Règle ajoutée.");
              reload();
            } catch (e) {
              toast(e.message, "err");
            }
          },
        }, "Ajouter la règle"),
        rules.length
          ? h("button", {
              class: "btn ghost small", type: "button",
              onclick: async (e) => {
                const b = e.currentTarget;
                b.disabled = true;
                b.textContent = "Vérification…";
                try {
                  const { count } = await api("/canva/rules/run", { method: "POST" });
                  toast(count ? `${count} brouillon(s) préparé(s) depuis Canva.` : "Aucun nouveau design à préparer.");
                } catch (err) {
                  toast(err.message, "err");
                } finally {
                  b.disabled = false;
                  b.textContent = "Vérifier maintenant";
                }
              },
            }, "Vérifier maintenant")
          : null)),
  );
}

function publicCard(sys) {
  const out = h("ul", { class: "check-list" });
  const run = async (btn) => {
    btn.disabled = true;
    btn.textContent = "Vérification…";
    try {
      const r = await api("/system/public-check");
      const line = (label, x) => h("li", { class: x.ok ? "ok" : "bad" }, `${x.ok ? "✓" : "✗"} ${label}${x.ok ? " : joignable depuis Internet" : ` : ${x.reason}`}`);
      out.replaceChildren(line("Retour de connexion des réseaux (/oauth)", r.oauth), line("Images pour Instagram et Threads (/media)", r.media));
    } catch (e) {
      toast(e.message, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Vérifier";
    }
  };
  const ts = sys.tailscale ?? {};
  let tsLine;
  if (ts.mode !== "auto") tsLine = null;
  else if (!ts.installed)
    tsLine = h("p", { class: "small" }, "Tailscale n'est pas installé. ",
      h("a", { href: "https://tailscale.com/download/windows", target: "_blank", rel: "noopener" }, "Installe-le"),
      ", connecte-toi, puis clique sur « Réessayer » : l'app ouvrira elle-même /oauth et /media.");
  else if (ts.funnelOk) tsLine = h("p", { class: "small ok-text" }, `✓ Tailscale actif : /oauth et /media ouverts sur https://${ts.host}`);
  else
    tsLine = h("p", { class: "small error" }, ts.error ?? "Tailscale n'est pas prêt.",
      ts.enableUrl ? h("span", {}, " ", h("a", { href: ts.enableUrl, target: "_blank", rel: "noopener" }, "Activer Funnel")) : null);

  const retry = async (btn) => {
    btn.disabled = true;
    btn.textContent = "Configuration…";
    try {
      await api("/system/tailscale/retry", { method: "POST" });
      renderSystem();
    } catch (e) {
      toast(e.message, "err");
      btn.disabled = false;
      btn.textContent = "Réessayer";
    }
  };

  return h("div", { class: "card system" },
    h("strong", {}, "Accès pour Facebook, Instagram et Threads"),
    h("p", { class: "muted small" },
      `Ces réseaux doivent joindre deux chemins de l'app depuis Internet : le retour de connexion et les images. L'interface, elle, reste uniquement sur ce PC. Adresse publique actuelle : ${sys.publicUrl}`),
    tsLine,
    h("div", { class: "row" },
      ts.mode === "auto" && !ts.funnelOk ? h("button", { class: "btn primary small", type: "button", onclick: (e) => retry(e.currentTarget) }, "Réessayer") : null,
      h("button", { class: "btn ghost small", type: "button", onclick: (e) => run(e.currentTarget) }, "Vérifier")),
    out);
}

// ---------- Appli sur l'écran d'accueil et notifications ----------

let installPrompt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; renderDevice(); });
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

async function swRegistration() {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js"); } catch { return null; }
}

async function currentPushSub() {
  const reg = await navigator.serviceWorker?.getRegistration?.();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function enablePush() {
  const reg = await swRegistration();
  if (!reg || !("PushManager" in window)) throw new Error(isIOS() && !isStandalone() ? "Sur iPhone, ajoute d'abord PTZ Posting à l'écran d'accueil, puis ouvre-la depuis l'icône." : "Ce navigateur ne gère pas les notifications.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications refusées. Pour changer : réglages du navigateur (ou de l'appli) → Notifications → PTZ Posting.");
  const { publicKey } = await api("/push/key");
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  await api("/push/subscribe", { method: "POST", body: JSON.stringify(sub.toJSON()) });
}

async function renderDevice() {
  const box = $("#device");
  if (!box) return;
  const sub = await currentPushSub().catch(() => null);
  const pushOk = "PushManager" in window && "Notification" in window;
  const installRow = isStandalone()
    ? h("p", { class: "small" }, "✅ Tu utilises PTZ Posting comme une appli.")
    : installPrompt
      ? h("button", { class: "btn primary small", type: "button", onclick: async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; renderDevice(); } }, "📲 Installer l'appli")
      : isIOS()
        ? h("p", { class: "small" }, "Sur iPhone / iPad (Safari) : touche ", h("strong", {}, "Partager ⬆️"), " puis ", h("strong", {}, "« Sur l'écran d'accueil »"), ". L'icône PTZ Posting apparaît comme une appli.")
        : h("p", { class: "small" }, "Sur Android (Chrome) : menu ⋮ → ", h("strong", {}, "« Installer l'application »"), " ou « Ajouter à l'écran d'accueil ». Sur ordinateur : l'icône d'installation dans la barre d'adresse.");
  const notifRow = sub
    ? h("div", { class: "row" },
        h("span", { class: "small" }, "🔔 Notifications activées sur cet appareil."),
        h("button", { class: "btn ghost small", type: "button", onclick: async () => { await api("/push/test", { method: "POST" }); toast("Notification de test envoyée."); } }, "Tester"),
        h("button", { class: "btn ghost small danger", type: "button", onclick: async () => {
          await api("/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) });
          await sub.unsubscribe();
          toast("Notifications désactivées sur cet appareil.");
          renderDevice();
        } }, "Désactiver"))
    : h("div", { class: "row" },
        h("button", { class: "btn ghost small", type: "button", disabled: !pushOk && !isIOS(), onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { await enablePush(); toast("Notifications activées."); } catch (err) { toast(err.message, "err"); }
          renderDevice();
        } }, "🔔 Activer"),
        h("small", { class: "muted" }, "Publication réussie ou en échec, récap du matin."));
  let recap = { enabled: true, hour: 8 };
  try { recap = await api("/recap"); } catch { /* garde le défaut */ }
  const hourSel = h("select", { "aria-label": "Heure du récap" }, ...Array.from({ length: 24 }, (_, i) => h("option", { value: String(i), selected: i === recap.hour }, `${i} h`)));
  const onOff = h("input", { type: "checkbox", role: "switch", checked: recap.enabled });
  const saveRecap = async () => { await api("/recap", { method: "PUT", body: JSON.stringify({ enabled: onOff.checked, hour: Number(hourSel.value) }) }); toast("Récap enregistré."); };
  onOff.addEventListener("change", saveRecap);
  hourSel.addEventListener("change", saveRecap);
  const recapRow = h("div", { class: "row recap-row" },
    h("label", { class: "check" }, onOff, h("span", {}, "☀️ Récap du matin à")), hourSel,
    h("button", { class: "btn ghost small", type: "button", onclick: async () => {
      const r = await api("/recap/test", { method: "POST" });
      toast(r.body.replace(/\n/g, " · "));
    } }, "Aperçu"));
  box.replaceChildren(h("div", { class: "card system" }, cardTitle("Appli et notifications", "appli"), installRow, notifRow, recapRow));
}

// ---------- Maintenance (propriétaire) ----------

const frDateTime = (ms) => new Date(ms).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** Attend que l'app revienne après un redémarrage, puis recharge la page. */
function waitForRestart(msg) {
  toast(msg);
  const started = Date.now();
  const poll = async () => {
    try {
      const r = await fetch("/login/info", { cache: "no-store" });
      if (r.ok && Date.now() - started > 3000) return location.reload();
    } catch { /* pas encore revenu */ }
    if (Date.now() - started > 90_000) return toast("L'app ne revient pas : redémarre le site dans le panneau alwaysdata (Web → Sites).", "err");
    setTimeout(poll, 2000);
  };
  setTimeout(poll, 2500);
}

/** Code de l'appli d'authentification, redemandé avant une action sensible. */
const askCode = (what) => {
  const c = prompt(`${what}\n\nPour confirmer, tape le code à 6 chiffres de ton appli d'authentification :`);
  return c == null ? null : c.trim();
};

async function renderMaintenance() {
  const box = $("#maintenance");
  if (state.me?.role !== "owner") return box.replaceChildren();
  let m;
  try { m = await api("/maintenance"); } catch { return; }
  const updBox = h("div", { class: "maint-updates" });
  const check = h("button", { class: "btn ghost small", type: "button" }, "Mises à jour");
  check.onclick = async () => {
    check.disabled = true; check.textContent = "Vérification…";
    try {
      const { commits, files, target, remote, branch } = await api("/maintenance/update/check", { method: "POST" });
      if (!commits.length) updBox.replaceChildren(h("p", { class: "small" }, "✅ PTZ Posting est à jour."));
      else {
        const go = h("button", { class: "btn primary small", type: "button" }, `Installer (${commits.length})`);
        go.onclick = async () => {
          const code = askCode("Installer la mise à jour ? L'app sera indisponible quelques secondes (une sauvegarde est faite avant).");
          if (!code) return;
          go.disabled = true; go.textContent = "Installation…";
          try {
            const r = await api("/maintenance/update/apply", { method: "POST", body: JSON.stringify({ code, target }) });
            if (r.restarting) waitForRestart("Mise à jour installée, redémarrage de l'app…");
            else { toast("Déjà à jour."); renderMaintenance(); }
          } catch (e) { toast(e.message, "err"); go.disabled = false; go.textContent = "Réessayer"; }
        };
        updBox.replaceChildren(
          h("p", { class: "muted small" }, `Source : ${remote} (${branch}) · version ${target.slice(0, 7)}`),
          h("ul", { class: "maint-commits" }, ...commits.slice(0, 15).map((x) => h("li", {}, h("span", {}, x.subject), h("small", { class: "muted" }, ` · ${x.author} · ${frDateTime(Date.parse(x.date))}`)))),
          commits.length > 15 ? h("p", { class: "muted small" }, `… et ${commits.length - 15} autres.`) : null,
          h("details", { class: "tuto-box" }, h("summary", {}, `${files.length} fichier${files.length > 1 ? "s" : ""} modifié${files.length > 1 ? "s" : ""}`),
            h("ul", { class: "maint-files" }, ...files.map((f) => h("li", {}, h("code", {}, f))))),
          go);
      }
    } catch (e) { updBox.replaceChildren(h("p", { class: "error small" }, e.message)); }
    check.disabled = false; check.textContent = "Mises à jour";
  };

  const backupRow = (b) => h("li", {},
    h("span", {}, b.name.startsWith("avant-") ? "Avant restauration · " : "", frDateTime(b.at)),
    h("small", { class: "muted" }, ` ${Math.max(1, Math.round(b.size / 1024))} Ko`),
    h("span", { class: "row" },
      h("button", { class: "btn ghost small", type: "button", onclick: async () => {
        const code = askCode("Télécharger cette sauvegarde ? Elle contient des données sensibles (chiffrées).");
        if (!code) return;
        try {
          const r = await fetch(`/api/maintenance/backups/${encodeURIComponent(b.name)}/download`, { method: "POST", headers: { "X-Requested-With": "multiposter", "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
          if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Erreur ${r.status}`);
          const url = URL.createObjectURL(await r.blob());
          const a = h("a", { href: url, download: b.name }); document.body.append(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        } catch (e) { toast(e.message, "err"); }
      } }, "Télécharger"),
      h("button", { class: "btn ghost small danger", type: "button", onclick: async () => {
        if (prompt(`Restaurer la sauvegarde du ${frDateTime(b.at)} ?\nTout ce qui a été fait depuis sera perdu (la base actuelle est gardée de côté).\n\nTape RESTAURER pour confirmer :`) !== "RESTAURER") return;
        const code = askCode("Dernière vérification avant la restauration.");
        if (!code) return;
        try {
          await api(`/maintenance/backups/${encodeURIComponent(b.name)}/restore`, { method: "POST", body: JSON.stringify({ code }) });
          waitForRestart("Restauration en cours, redémarrage de l'app…");
        } catch (e) { toast(e.message, "err"); }
      } }, "Restaurer")));

  box.replaceChildren(
    h("div", { class: "card system" },
      cardTitle("Maintenance", "proprietaire"),
      h("h3", {}, "Mise à jour"),
      h("p", { class: "small" }, m.version
        ? ["Version installée : ", h("strong", {}, m.version.commit), ` du ${frDateTime(Date.parse(m.version.date))} — « ${m.version.subject} »`]
        : "Version inconnue (l'app n'a pas été installée avec git)."),
      h("div", { class: "row" }, check,
        h("button", { class: "btn ghost small", type: "button", onclick: async () => {
          if (!confirm("Redémarrer l'app maintenant ?")) return;
          await api("/maintenance/restart", { method: "POST" });
          waitForRestart("Redémarrage…");
        } }, "Redémarrer l'app")),
      updBox,
      h("h3", {}, "Sauvegardes"),
      h("p", { class: "muted small" }, `Copie automatique de la base chaque nuit (les ${m.keep} dernières sont gardées) : réseaux connectés, posts, réglages. Les fichiers images et vidéos ne sont pas inclus. Une sauvegarde contient des données sensibles (chiffrées) : ne la partage pas.`),
      h("div", { class: "row" }, h("button", { class: "btn ghost small", type: "button", onclick: async (e) => {
        e.currentTarget.disabled = true;
        try { await api("/maintenance/backups", { method: "POST" }); toast("Sauvegarde faite."); renderMaintenance(); } catch (err) { toast(err.message, "err"); }
      } }, "Sauvegarder")),
      m.backups.length ? h("ul", { class: "maint-backups" }, ...m.backups.map(backupRow)) : h("p", { class: "muted small" }, "Pas encore de sauvegarde (la première est faite quelques minutes après le démarrage)."),
    ));
}

const EVENT_LABEL = {
  login_ok: "Connexion réussie",
  app_updated: "Mise à jour de l'app",
  app_restart: "Redémarrage de l'app",
  backup_created: "Sauvegarde créée",
  backup_downloaded: "Sauvegarde téléchargée",
  backup_restored: "Sauvegarde restaurée",
  stepup_fail: "Code de confirmation incorrect",
  login_fail: "Échec de connexion",
  login_setup: "Connexion (activation 2FA)",
  "2fa_enabled": "Double authentification activée",
  "2fa_reset": "Double authentification réinitialisée",
  user_created: "Nouvel utilisateur",
  user_removed: "Utilisateur retiré",
  invite_created: "Invitation créée",
  reset_link_created: "Lien de nouveau mot de passe créé",
  password_reset: "Mot de passe réinitialisé",
  "2fa_new_secret": "Nouveau QR code généré",
  logout_all: "Tous les appareils déconnectés",
};

async function renderUsers() {
  let me, users;
  try {
    [me, users] = await Promise.all([api("/me"), api("/users")]);
  } catch {
    return;
  }
  const isOwner = me.role === "owner" || me.role === "admin";
  const ROLE = { owner: "propriétaire", admin: "administrateur", member: "membre" };
  const asAdmin = h("input", { type: "checkbox", id: "invite-admin" });
  const linkBox = h("div", { class: "invite-box", hidden: true });
  const invite = async (btn) => {
    btn.disabled = true;
    try {
      const { link, expiresAt } = await api(`/users/invite${asAdmin.checked ? "?role=admin" : ""}`, { method: "POST" });
      const input = h("input", { readonly: true, value: link, id: "invite-link" });
      const copy = h("button", { class: "btn ghost small", type: "button" }, "Copier");
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(link);
          toast("Lien copié.");
        } catch {
          input.select();
        }
      });
      linkBox.hidden = false;
      linkBox.replaceChildren(
        h("p", { class: "small" }, "Envoie ce lien à la personne, par un canal privé. Il ne marche qu'une fois et expire le ",
          new Date(expiresAt).toLocaleString("fr-FR"), "."),
        h("div", { class: "row" }, input, copy),
      );
    } catch (e) {
      toast(e.message, "err");
    } finally {
      btn.disabled = false;
    }
  };
  const rows = users.map((u) =>
    h("li", {},
      h("div", { class: "grow" },
        h("strong", {}, u.name), u.name === me.name ? h("small", { class: "muted" }, " (toi)") : null,
        h("span", { class: "via" }, ROLE[u.role] ?? u.role),
        h("p", { class: "muted small" },
          u.twoFactor ? `Double authentification active · ${u.recoveryCodesLeft} code(s) de secours` : "Double authentification à activer",
          " · ", u.lastLogin ? `dernière connexion ${new Date(u.lastLogin).toLocaleString("fr-FR")}` : "jamais connecté")),
      // Le propriétaire gère tout le monde ; un administrateur ne gère que les membres.
      isOwner && u.role !== "owner" && u.name !== me.name && (me.role === "owner" || u.role === "member")
        ? h("div", { class: "row" },
            h("button", {
              class: "btn ghost small", type: "button",
              onclick: async () => {
                const code = askCode(`Créer un lien de nouveau mot de passe pour « ${u.name} » ?`);
                if (!code) return;
                try {
                  const { link, expiresAt } = await api(`/users/${u.id}/reset-password`, { method: "POST", body: JSON.stringify({ code }) });
                  const input = h("input", { readonly: true, value: link, id: "invite-link" });
                  const copy = h("button", { class: "btn ghost small", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(link); toast("Lien copié."); } catch { input.select(); } } }, "Copier");
                  linkBox.hidden = false;
                  linkBox.replaceChildren(
                    h("p", { class: "small" }, `Lien pour que « ${u.name} » choisisse un nouveau mot de passe (ses données sont conservées). Usage unique, expire le ${new Date(expiresAt).toLocaleString("fr-FR")}.`),
                    h("div", { class: "row" }, input, copy));
                } catch (e) { toast(e.message, "err"); }
              },
            }, "Nouveau mot de passe"),
            h("button", {
              class: "btn ghost small", type: "button",
              onclick: async () => {
                if (!confirm(`Réinitialiser la double authentification de « ${u.name} » ? Il devra la réactiver à sa prochaine connexion.`)) return;
                const code = askCode("Confirme avec ton propre code.");
                if (!code) return;
                try { await api(`/users/${u.id}/reset-2fa`, { method: "POST", body: JSON.stringify({ code }) }); toast("Double authentification réinitialisée."); renderUsers(); } catch (e) { toast(e.message, "err"); }
              },
            }, "Réinitialiser sa 2FA"),
            h("button", {
              class: "btn ghost small danger", type: "button",
              onclick: async () => {
                if (!confirm(`Retirer l'accès de « ${u.name} » ? Ses sessions seront fermées immédiatement, et tout son espace (réseaux connectés, posts, Canva) sera supprimé.`)) return;
                const code = askCode("Confirme avec ton propre code.");
                if (!code) return;
                try { await api(`/users/${u.id}`, { method: "DELETE", body: JSON.stringify({ code }) }); toast("Accès retiré."); renderUsers(); } catch (e) { toast(e.message, "err"); }
              },
            }, "Retirer"))
        : null));
  $("#users").replaceChildren(
    h("div", { class: "card system" },
      cardTitle("Personnes ayant accès", "utilisateurs"),
      h("ul", { class: "user-list" }, ...rows),
      isOwner
        ? h("div", { class: "row invite-row" },
            me.role === "owner" ? h("label", { class: "tcheck", for: "invite-admin" }, asAdmin, h("span", {}, "Administrateur (peut inviter et gérer les membres)")) : null,
            h("button", { class: "btn primary small", type: "button", onclick: (e) => invite(e.currentTarget) }, "Inviter une personne"))
        : h("p", { class: "muted small" }, "Seuls les administrateurs peuvent inviter ou retirer des personnes."),
      linkBox),
  );
}

async function renderSecurity() {
  let s;
  try {
    s = await api("/security");
  } catch {
    return;
  }
  const status = [
    `Connecté en tant que « ${s.user} » (${{ owner: "propriétaire", admin: "administrateur", member: "membre" }[s.role] ?? s.role})`,
    s.serverMode ? "En ligne (HTTPS)" : "Uniquement sur ce PC",
    s.twoFactor ? `Double authentification active · ${s.recoveryCodesLeft} code(s) de secours restant(s)` : "Double authentification non activée",
    s.passwordHashed ? "Mot de passe stocké sous forme d'empreinte" : "Mot de passe dans .env (acceptable seulement sur ton PC)",
  ];
  const rows = s.events.map((e) =>
    h("tr", { class: e.type === "login_fail" ? "bad" : "" },
      h("td", {}, new Date(e.at).toLocaleString("fr-FR")),
      h("td", {}, e.user ?? "—"),
      h("td", {}, EVENT_LABEL[e.type] ?? e.type, e.detail ? h("small", { class: "muted" }, ` · ${e.detail}`) : null),
      h("td", {}, e.ip ?? "—"),
      h("td", { class: "agent", title: e.agent ?? "" }, (e.agent ?? "").slice(0, 60))));
  $("#security").replaceChildren(
    h("div", { class: "card system" },
      cardTitle("Sécurité", "securite"),
      h("ul", { class: "check-list" }, ...status.map((t) => h("li", {}, t))),
      !s.twoFactor && !s.serverMode
        ? h("p", { class: "small" }, h("a", { href: "/2fa/setup" }, "Activer la double authentification"), " (recommandé)")
        : null,
      h("p", { class: "muted small" }, "Si une session est restée ouverte ailleurs, déconnecte-les toutes : il faudra se reconnecter partout, ici compris."),
      h("form", { method: "post", action: "/logout-all" }, h("button", { class: "btn ghost small danger", type: "submit" }, "Déconnecter tous mes appareils")),
      h("details", { class: "journal" },
        h("summary", {}, `Journal de sécurité (${s.events.length} derniers événements)`),
        rows.length
          ? h("div", { class: "table-scroll" }, h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Date"), h("th", {}, "Qui"), h("th", {}, "Événement"), h("th", {}, "Adresse"), h("th", {}, "Navigateur"))), h("tbody", {}, ...rows)))
          : h("p", { class: "muted small" }, "Aucun événement."))),
  );
}

async function renderSystem() {
  if (state.me && state.me.role !== "owner") return $("#system").replaceChildren(); // réglages du serveur : propriétaire
  let sys;
  try {
    sys = await api("/system");
  } catch {
    return;
  }
  const cards = [publicCard(sys)];
  if (!sys.autostart.supported) return $("#system").replaceChildren(...cards);
  const input = h("input", { type: "checkbox", id: "autostart", role: "switch" });
  input.checked = sys.autostart.enabled;
  const status = h("span", { class: "muted small" });
  const paint = () => {
    status.textContent = input.checked
      ? "Activé : l'app démarrera en arrière-plan à chaque ouverture de session Windows."
      : "Désactivé : l'app ne tourne que quand tu la lances avec « Demarrer PTZ Posting ».";
  };
  paint();
  input.addEventListener("change", async () => {
    input.disabled = true;
    try {
      const r = await api("/system/autostart", { method: "PUT", body: JSON.stringify({ enabled: input.checked }) });
      input.checked = r.autostart.enabled;
      toast(input.checked ? "Démarrage automatique activé." : "Démarrage automatique désactivé.");
    } catch (e) {
      input.checked = !input.checked;
      toast(e.message, "err");
    } finally {
      input.disabled = false;
      paint();
    }
  });
  $("#system").replaceChildren(
    ...cards,
    h("div", { class: "card system" },
      h("label", { class: "switch-row", for: "autostart" },
        h("span", { class: "switch" }, input, h("span", { class: "slider", "aria-hidden": "true" })),
        h("strong", {}, "Lancer PTZ Posting au démarrage de Windows")),
      status),
  );
}

/** Réglages des apps développeur (propriétaire uniquement), chargés une fois. */
async function loadAppSettings() {
  state.appGroups = null;
  if (state.me?.role !== "owner") return;
  try {
    state.appGroups = await api("/app-settings");
  } catch {
    /* pas propriétaire ou hors ligne */
  }
}

function copyBtn(text) {
  return h("button", { class: "btn ghost small", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(text); toast("Adresse copiée."); } catch { toast(text); } } }, "Copier");
}

/**
 * Formulaire d'activation d'un réseau, directement dans sa carte (propriétaire) :
 * adresse de retour à copier, lien vers la console du réseau, les deux clés.
 */
function setupPanel(id, configured) {
  const g = state.appGroups?.find((x) => x.id === id);
  if (!g) return null;
  const fromServer = g.fields.every((f) => f.source === "server");
  const inputs = g.fields.map((f) => {
    const input = h("input", {
      type: f.secret ? "password" : "text",
      autocomplete: "off",
      spellcheck: "false",
      placeholder: f.source === "server" ? "défini sur le serveur" : f.secret && f.source ? "enregistrée ✓ (laisse vide pour la garder)" : "colle ici",
      disabled: f.source === "server",
    });
    if (!f.secret && f.value) input.value = f.value;
    input.dataset.key = f.key;
    return field(f.label, input);
  });
  const save = async (btn) => {
    const body = {};
    for (const el of btn.closest(".appset").querySelectorAll("input[data-key]")) {
      if (el.disabled) continue;
      const f = g.fields.find((x) => x.key === el.dataset.key);
      // Secret vide = on garde l'ancien ; identifiant vide = on l'efface.
      if (f.secret && !el.value.trim()) continue;
      body[el.dataset.key] = el.value.trim();
    }
    btn.disabled = true;
    try {
      await api("/app-settings", { method: "PUT", body: JSON.stringify(body) });
      toast(`${g.label} : enregistré.`);
      state.meta = await api("/meta");
      await Promise.all([loadCanvaStatus(), loadAppSettings()]);
      renderAccounts();
      renderAppSettings();
    } catch (e) {
      toast(e.message, "err");
    } finally {
      btn.disabled = false;
    }
  };
  return h("details", { class: `appset${configured ? "" : " todo"}` },
    h("summary", {}, configured ? "Clés de l'app" : "Activer ce réseau"),
    configured ? null : h("p", { class: "muted small" }, "Une seule fois, pour tout le monde : déclare PTZ Posting chez le réseau en suivant le tuto, puis colle ici ses deux clés. Ensuite chacun connecte ses comptes d'un clic."),
    g.callback
      ? h("div", { class: "callback" }, h("span", { class: "small" }, "Ton adresse de retour (à coller chez le réseau) :"), h("div", { class: "row" }, h("code", {}, g.callback), copyBtn(g.callback)))
      : null,
    NETS()[id]
      ? h("details", { class: "tuto-box", open: !configured }, h("summary", {}, "Tuto pas à pas"), tuto(NETS()[id].owner))
      : h("p", { class: "muted small" }, g.help),
    g.console ? h("a", { href: g.console, target: "_blank", rel: "noopener", class: "small" }, "Console ↗") : null,
    ...inputs,
    fromServer
      ? h("p", { class: "muted small" }, "Ces clés sont définies sur le serveur (variables d'environnement) : pour les gérer ici, retire-les là-bas puis redémarre.")
      : h("div", { class: "row" },
          h("button", { class: "btn primary small", type: "button", onclick: (e) => save(e.currentTarget) }, "Enregistrer"),
          h("a", { href: "/aide", "data-help": NETS()[id] ? `net-${id}` : "alertes", class: "small" }, "Aide")),
  );
}

/** Tuto « connecter mon compte », replié dans la carte du réseau. */
function userTuto(id) {
  const n = NETS()[id];
  return n ? h("details", { class: "tuto-box" }, h("summary", {}, "Comment se connecter ?"), tuto(n.user)) : null;
}

/** Réseau pas encore activé : formulaire pour le propriétaire, explication pour les autres. */
function notReady(id) {
  return state.me?.role === "owner"
    ? setupPanel(id, false)
    : h("p", { class: "muted small" }, "Pas encore activé : le propriétaire de l'app doit l'activer une fois, ensuite tu pourras connecter ton compte ici.");
}

/** Webhook d'alertes (propriétaire) : le seul réglage qui n'est pas lié à un réseau. */
function renderAppSettings() {
  const box = $("#app-settings");
  const panel = state.appGroups ? setupPanel("alerts", true) : null;
  if (!panel) return box.replaceChildren();
  panel.querySelector("summary").textContent = "Webhook (Discord, Slack, ntfy)";
  const g = state.appGroups.find((x) => x.id === "alerts");
  box.replaceChildren(
    h("div", { class: "card system" },
      h("div", { class: "row spread" }, h("div", { class: "card-title" }, h("strong", {}, "Alertes de sécurité"), helpQ("alertes")),
        h("span", { class: `status ${g.fields.every((f) => f.source) ? "done" : "pending"}` }, g.fields.every((f) => f.source) ? "Activées" : "Non configurées")),
      h("p", { class: "muted small" }, "Reçois un message à chaque connexion suspecte, publication en échec ou réglage modifié."),
      panel),
  );
}

function renderAccounts() {
  if (!state.meta) return; // pas encore chargé : init() redessinera
  $("#flows").replaceChildren(
    canvaCard(),
    driveCard(),
    ...state.meta.flows.map((f) =>
      h(
        "div",
        { class: "card flow" },
        h("div", { class: "flow-head" }, ...f.providers.map(badge), helpQ(`net-${f.id}`, `Tuto ${f.label}`)),
        f.configured
          ? h("a", { class: "btn primary small", href: `/oauth/${f.id}/start` }, `Connecter ${f.label}`)
          : notReady(f.id),
        f.configured ? userTuto(f.id) : null,
        f.configured && state.me?.role === "owner" ? setupPanel(f.id, true) : null,
      ),
    ),
  );
  const list = state.accounts.filter((a) => !a.shared).map((a) => {
    const expiring = a.expiresAt && !a.canRefresh && a.expiresAt < Date.now() + 7 * 86400e3;
    return h(
      "div",
      { class: "card account" },
      h("span", { class: "avatar-wrap" }, avatar(a), h("span", { class: "avatar-net" }, netIcon(a.provider))),
      h("div", { class: "grow" }, h("strong", {}, a.name), " ", badge(a.provider),
        expiring ? h("p", { class: "error small" }, "Token bientôt expiré : reconnecte ce compte.") : null,),
      h("button", {
        class: "btn ghost small danger",
        onclick: async () => {
          if (!confirm(`Déconnecter ${a.name} ? Les posts programmés vers ce compte ne partiront pas.`)) return;
          await api(`/accounts/${a.id}`, { method: "DELETE" });
          loadAccounts();
        },
      }, "Déconnecter"),
    );
  });
  $("#accounts").replaceChildren(...(list.length ? list : [h("p", { class: "muted" }, "Aucun compte connecté pour l'instant.")]));
}

// ---------- rédaction ----------

function selectedAccounts() {
  return state.accounts.filter((a) => state.selected.has(a.id));
}

function renderPicker() {
  $("#no-accounts").hidden = state.accounts.length > 0;
  $("#profile-picker").replaceChildren(
    ...state.profiles.filter((pr) => profileAccounts(pr).length).map((pr) => {
      const ids = profileAccounts(pr);
      const all = ids.every((id) => state.selected.has(id));
      return h("button", {
        type: "button", class: `chip profile-chip ${all ? "active" : ""}`, title: `Cocher les ${ids.length} comptes de ce profil`,
        onclick: () => {
          for (const id of ids) all ? state.selected.delete(id) : state.selected.add(id);
          renderPicker();
          renderComposeMeta();
        },
      }, h("span", {}, pr.name), h("small", {}, String(ids.length)));
    }),
  );
  $("#account-picker").replaceChildren(
    ...state.accounts.map((a) =>
      h(
        "button",
        {
          class: `chip account-chip ${state.selected.has(a.id) ? "active" : ""}`,
          style: `--c:${PROVIDER[a.provider]?.color}`,
          type: "button",
          onclick: () => {
            state.selected.has(a.id) ? state.selected.delete(a.id) : state.selected.add(a.id);
            renderPicker();
            renderComposeMeta();
          },
        },
        h("span", { class: "avatar-wrap" }, avatar(a), h("span", { class: "avatar-net" }, netIcon(a.provider))),
        h("span", {}, a.name),
        h("small", { class: "net-label", title: PROVIDER[a.provider]?.label }, netIcon(a.provider), a.provider === "x" ? null : PROVIDER[a.provider]?.label),
        a.shared ? h("small", { class: "share-badge", title: `Compte de ${a.shared.ownerName} : le post partira en validation` }, `↗ ${a.shared.ownerName}`) : null,
      ),
    ),
  );
}

function maxFor(provider) {
  return state.meta.publishers.find((p) => p.id === provider)?.maxText ?? Infinity;
}

function renderComposeMeta() {
  const text = $("#text").value;
  const accs = selectedAccounts();

  const providers = [...new Set(accs.map((a) => a.provider))];
  $("#counters").replaceChildren(
    ...providers.map((p) => {
      const used = accs.filter((a) => a.provider === p).map((a) => finalText(a));
      const n = Math.max(...used.map(countChars));
      const max = maxFor(p);
      return h("span", { class: `counter ${n > max ? "over" : ""}` }, badge(p), ` ${n} / ${max}`);
    }),
  );

  renderTextTabs();
  renderMentionPreview();
  renderSlots();
  const sharedSel = selectedAccounts().find((a) => a.shared);
  $("#btn-schedule").textContent = sharedSel ? `📤 Proposer à ${sharedSel.shared.ownerName}` : "Programmer";
  $("#btn-now").hidden = !!sharedSel;
  renderHashtags();
  renderTargetCards();
  scheduleValidation();
}

// ---------- Finir dans Instagram (pour ajouter une musique) ----------
// Instagram ne donne pas accès à sa bibliothèque musicale aux autres apps : on prépare le post
// (images + légende copiée) et on l'ouvre dans l'appli Instagram, où l'on ajoute la musique.

const IG_OK = new Set(["image/jpeg", "image/png", "video/mp4", "video/quicktime"]);

/**
 * Ouvre la fenêtre « Finir dans Instagram ».
 * media : [{url, filename, mime, kind}] ; caption : texte ; onPublished : appelé quand on confirme.
 */
async function finishInInstagram({ media, caption, onPublished }) {
  const dlg = $("#share-dialog"), body = $("#share-body");
  $("#share-title").textContent = "Finir dans Instagram";
  const fill = (...els) => body.replaceChildren(...els);
  const usable = media.filter((m) => IG_OK.has(m.mime)).slice(0, 10);
  const skipped = media.length - usable.length;
  const copyCaption = async () => {
    try { await navigator.clipboard.writeText(caption); return true; } catch { return false; }
  };
  dlg.showModal();
  if (!usable.length) {
    fill(h("p", { class: "error" }, "Aucune image JPG/PNG ni vidéo MP4/MOV à envoyer à Instagram."));
    return;
  }
  fill(h("p", { class: "muted" }, `Préparation de ${plural(usable.length, "fichier")}…`), h("progress"));

  let files;
  try {
    files = await Promise.all(usable.map(async (m, i) => {
      const blob = await (await fetch(m.url)).blob();
      const ext = m.mime === "image/png" ? "png" : m.mime.startsWith("video/") ? (m.mime === "video/mp4" ? "mp4" : "mov") : "jpg";
      return new File([blob], `${String(i + 1).padStart(2, "0")}-ptz.${ext}`, { type: m.mime });
    }));
  } catch {
    fill(h("p", { class: "error" }, "Impossible de préparer les fichiers. Vérifie ta connexion et réessaie."));
    return;
  }

  const canShare = !!navigator.canShare?.({ files });
  const doneRow = onPublished
    ? h("div", { class: "share-done" },
        h("p", { class: "small" }, "Une fois publié dans Instagram :"),
        h("button", { class: "btn primary", type: "button", onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { await onPublished(); dlg.close(); } catch (err) { toast(err.message, "err"); e.currentTarget.disabled = false; }
        } }, "✓ C'est publié sur Instagram"))
    : null;

  if (canShare) {
    fill(
      h("ol", { class: "steps share-steps" },
        h("li", {}, "Touche ", h("strong", {}, "Ouvrir Instagram"), " (la légende est copiée en même temps), puis choisis ", h("strong", {}, "Instagram"), " dans la liste."),
        h("li", {}, "Choisis ", h("strong", {}, "Publication"), " (ou Story), garde l'ordre des images."),
        h("li", {}, "Touche ", h("strong", {}, "♫ Ajouter de la musique"), " et choisis ton son."),
        h("li", {}, h("strong", {}, "Colle la légende"), " (appui long → Coller), puis publie.")),
      skipped ? h("p", { class: "muted small" }, `${plural(skipped, "fichier")} ignoré${skipped > 1 ? "s" : ""} (format non accepté par Instagram ou plus de 10).`) : null,
      h("button", { class: "btn primary share-go", type: "button", onclick: async () => {
        const copied = copyCaption();
        try {
          await navigator.share({ files });
          toast((await copied) ? "Légende copiée : colle-la dans Instagram." : "Pense à copier ta légende.");
        } catch (err) {
          if (err?.name !== "AbortError") toast("Partage impossible : " + (err?.message ?? err), "err");
        }
      } }, `📲 Ouvrir Instagram (${plural(files.length, "fichier")})`),
      h("button", { class: "btn ghost small", type: "button", onclick: async () => toast((await copyCaption()) ? "Légende copiée." : "Copie impossible.") }, "Copier la légende"),
      doneRow,
    );
  } else {
    // Ordinateur (ou navigateur sans partage de fichiers) : Instagram ne s'ouvre pas avec des fichiers.
    fill(
      h("p", {}, "Cette fonction s'utilise ", h("strong", {}, "sur ton téléphone"), " : ouvre PTZ Posting sur ton téléphone, retrouve ce post dans le Planning et touche « Finir dans Instagram »."),
      h("p", { class: "muted small" }, "Sur ordinateur, tu peux quand même récupérer les fichiers et la légende :"),
      h("div", { class: "row" },
        h("button", { class: "btn ghost small", type: "button", onclick: () => {
          for (const f of files) { const a = h("a", { href: URL.createObjectURL(f), download: f.name }); document.body.append(a); a.click(); a.remove(); }
        } }, `Télécharger ${plural(files.length, "fichier")}`),
        h("button", { class: "btn ghost small", type: "button", onclick: async () => toast((await copyCaption()) ? "Légende copiée." : "Copie impossible.") }, "Copier la légende")),
      doneRow,
    );
  }
}

// ---------- Musique sur les slides ----------
// Les slides (images) deviennent de courtes vidéos avec ta musique : dans un carrousel Instagram,
// le son est joué quand on fait défiler. La musique doit être à toi ou libre de droits.

const fmtDuration = (s) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
const music = { tracks: [], available: true, trackId: null, mode: "all", seconds: 5, start: 0 };

async function openMusic() {
  $("#music-dialog").showModal();
  $("#music-body").replaceChildren(h("p", { class: "muted" }, "Chargement de tes musiques…"));
  try {
    const r = await api("/music");
    music.tracks = r.tracks;
    music.available = r.available;
    if (!music.tracks.some((t) => t.id === music.trackId)) music.trackId = music.tracks[0]?.id ?? null;
  } catch (e) {
    return $("#music-body").replaceChildren(h("p", { class: "error" }, e.message));
  }
  renderMusic();
}

function renderMusic() {
  const body = $("#music-body");
  const images = state.media.filter((m) => m.kind === "image" && m.mime !== "image/gif");
  if (!music.available)
    return body.replaceChildren(h("p", { class: "error" }, "Le convertisseur vidéo (ffmpeg) n'est pas installé sur le serveur : cette fonction n'est pas disponible."));

  const fileInput = h("input", { type: "file", accept: "audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/wav,.mp3,.m4a,.aac,.wav", hidden: true });
  fileInput.addEventListener("change", async () => {
    const f = fileInput.files[0];
    if (!f) return;
    const type = f.type || ({ mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav" })[f.name.split(".").pop().toLowerCase()] || "";
    toast("Envoi de la musique…");
    try {
      const t = await fetch(`/api/music?filename=${encodeURIComponent(f.name)}`, { method: "PUT", headers: { "Content-Type": type, "X-Requested-With": "multiposter" }, body: f })
        .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; });
      music.tracks.unshift(t);
      music.trackId = t.id;
      toast(`« ${t.name} » ajoutée.`);
      renderMusic();
    } catch (e) {
      toast(e.message, "err");
    }
  });

  const track = music.tracks.find((t) => t.id === music.trackId);
  const player = track ? h("audio", { controls: true, preload: "metadata", src: `/api/music/${track.id}/file`, class: "music-player" }) : null;
  const startInput = h("input", { type: "number", min: 0, step: 0.5, value: music.start, inputmode: "decimal", class: "num" });
  startInput.addEventListener("input", () => { music.start = Math.max(0, Number(startInput.value) || 0); renderSummary(); });
  if (player) player.addEventListener("loadedmetadata", () => { player.currentTime = music.start; });
  const secInput = h("input", { type: "number", min: 3, max: 60, step: 1, value: music.seconds, inputmode: "numeric", class: "num" });
  secInput.addEventListener("input", () => { music.seconds = Math.min(60, Math.max(3, Number(secInput.value) || 5)); renderSummary(); });
  const summary = h("p", { class: "muted small" });
  const renderSummary = () => {
    const n = music.mode === "all" ? Math.min(images.length, 10) : Math.min(images.length, 1);
    summary.textContent = n
      ? `${plural(n, "slide")} → ${plural(n, "vidéo")} de ${music.seconds} s, musique de ${fmtDuration(music.start)} à ${fmtDuration(music.start + n * (music.mode === "all" ? music.seconds : 0) + (music.mode === "all" ? 0 : music.seconds))}.`
      : "Ajoute d'abord des images au post.";
  };
  renderSummary();
  const modeRadio = (value, label) => {
    const r = h("input", { type: "radio", name: "music-mode", value, checked: music.mode === value });
    r.addEventListener("change", () => { music.mode = value; music.seconds = value === "all" ? 5 : 15; secInput.value = music.seconds; renderSummary(); });
    return h("label", { class: "check" }, r, label);
  };

  const go = h("button", { class: "btn primary share-go", type: "button", disabled: !track || !images.length }, "♫ Créer les vidéos");
  go.addEventListener("click", async () => {
    go.disabled = true;
    go.textContent = "Création des vidéos… (quelques secondes par slide)";
    try {
      const ids = (music.mode === "all" ? images.slice(0, 10) : images.slice(0, 1)).map((m) => m.id);
      const { media } = await api("/music/render", { method: "POST", body: JSON.stringify({ mediaIds: ids, trackId: music.trackId, mode: music.mode, seconds: music.seconds, start: music.start }) });
      const swap = new Map(media.map((v) => [v.replaces, v]));
      state.media = state.media.map((m) => swap.get(m.id) ?? m);
      // Les choix de médias par réseau suivent le remplacement.
      for (const o of Object.values(state.targetOptions)) if (Array.isArray(o.media)) o.media = o.media.map((id) => swap.get(id)?.id ?? id);
      cardsKey = "";
      renderMedia();
      renderComposeMeta();
      toast(`${plural(media.length, "slide")} avec musique : prêt${media.length > 1 ? "es" : "e"}.`);
      $("#music-dialog").close();
    } catch (e) {
      toast(e.message, "err");
      go.disabled = false;
      go.textContent = "♫ Créer les vidéos";
    }
  });

  body.replaceChildren(
    h("p", { class: "small" }, "Tes slides deviennent de courtes vidéos avec ta musique : dans un carrousel Instagram, le son est joué quand on fait défiler. Utilise une musique ", h("strong", {}, "à toi ou libre de droits"), " (Instagram peut couper le son d'une musique protégée)."),
    h("div", { class: "music-list" },
      ...music.tracks.map((t) => {
        const r = h("input", { type: "radio", name: "music-track", checked: t.id === music.trackId });
        r.addEventListener("change", () => { music.trackId = t.id; music.start = 0; renderMusic(); });
        return h("div", { class: "music-item" },
          h("label", { class: "check" }, r, h("span", {}, t.name), h("small", { class: "muted" }, fmtDuration(t.duration))),
          h("button", { class: "btn ghost small danger", type: "button", title: "Supprimer cette musique", onclick: async () => {
            if (!confirm(`Supprimer « ${t.name} » de ta bibliothèque ?`)) return;
            await api(`/music/${t.id}`, { method: "DELETE" });
            music.tracks = music.tracks.filter((x) => x.id !== t.id);
            if (music.trackId === t.id) music.trackId = music.tracks[0]?.id ?? null;
            renderMusic();
          } }, "✕"));
      }),
      fileInput,
      h("button", { class: "btn ghost small", type: "button", onclick: () => fileInput.click() }, music.tracks.length ? "＋ Ajouter" : "＋ Ajouter une musique")),
    track
      ? h("div", { class: "music-settings" },
          player,
          h("div", { class: "row" },
            h("label", { class: "inline" }, "Début de la musique (secondes)"), startInput,
            h("button", { class: "btn ghost small", type: "button", onclick: () => { music.start = Math.round((player.currentTime || 0) * 2) / 2; startInput.value = music.start; renderSummary(); } }, "Position actuelle")),
          h("div", { class: "music-modes" },
            modeRadio("all", "Toutes les slides (la musique continue d'une slide à l'autre)"),
            modeRadio("first", "Seulement la 1re slide")),
          h("div", { class: "row" }, h("label", { class: "inline" }, "Durée de chaque vidéo (secondes)"), secInput),
          summary)
      : null,
    go,
    h("p", { class: "muted small" }, "Les vidéos remplacent les images dans ce post (Instagram, Threads, TikTok…). Facebook ne mélange pas photos et vidéo : dans ses options, garde une seule vidéo ou retire-le de ce post."),
  );
}

// ---------- Texte par réseau et mentions ----------

const MENTION_NETS = [["instagram", "Instagram"], ["threads", "Threads"], ["tiktok", "TikTok"], ["youtube", "YouTube"], ["facebook", "Facebook (nom de la Page)"]];
const AT_NETS = new Set(["instagram", "threads", "x", "tiktok", "youtube"]);

/** Même règle que le serveur : @[Nom] → le compte de cette personne sur ce réseau, ou son nom. */
function resolveMentions(text, provider) {
  if (!text.includes("@[")) return text;
  return text.replace(/@\[([^\]\n]{1,60})\]/g, (_a, name) => {
    const c = state.mentions.find((m) => m.name.toLowerCase() === name.trim().toLowerCase());
    const hdl = c?.handles?.[provider]?.trim();
    if (!hdl) return name.trim();
    return AT_NETS.has(provider) ? `@${hdl.replace(/^@+/, "")}` : hdl;
  });
}
/** Texte final envoyé à un compte (texte propre au réseau ou commun, mentions résolues). */
const finalText = (a) => resolveMentions(state.overrides[a.id] ?? $("#text").value, a.provider);

async function loadMentions() {
  try { state.mentions = await api("/mentions"); } catch { /* garde l'existant */ }
}

function renderTextTabs() {
  const accs = selectedAccounts();
  if (state.textTab !== "all" && !accs.some((a) => a.id === state.textTab)) state.textTab = "all";
  const tab = (id, label, custom) =>
    h("button", { type: "button", role: "tab", class: `text-tab${state.textTab === id ? " active" : ""}${custom ? " custom" : ""}`, "aria-selected": String(state.textTab === id),
      title: custom ? "Texte modifié pour ce compte" : "", onclick: () => { state.textTab = id; renderTextTabs(); } }, ...label);
  $("#text-tabs").replaceChildren(
    accs.length > 1 || accs.some((a) => state.overrides[a.id]) ? tab("all", ["Tous les réseaux"], false) : null,
    ...(accs.length > 1 || accs.some((a) => state.overrides[a.id])
      ? accs.map((a) => tab(a.id, [netIcon(a.provider), accs.filter((x) => x.provider === a.provider).length > 1 ? h("span", {}, a.name) : a.provider === "x" ? null : h("span", {}, PROVIDER[a.provider]?.label ?? a.provider), state.overrides[a.id] ? h("span", { class: "dot-custom", "aria-hidden": "true" }) : null], !!state.overrides[a.id]))
      : []),
  );
  const a = accs.find((x) => x.id === state.textTab);
  $("#text").hidden = !!a;
  $("#net-text-box").hidden = !a;
  if (!a) return;
  const custom = state.overrides[a.id] != null;
  const ta = $("#net-text");
  const label = `${PROVIDER[a.provider]?.label} · ${a.name}`;
  if (custom) {
    if (document.activeElement !== ta) ta.value = state.overrides[a.id];
    ta.readOnly = false;
    $("#net-text-info").textContent = `Texte propre à ${label}. Les slides restent les mêmes.`;
  } else {
    ta.value = resolveMentions($("#text").value, a.provider);
    ta.readOnly = true;
    $("#net-text-info").textContent = `Aperçu pour ${label} : c'est le texte commun, mentions adaptées à ce réseau.`;
  }
  $("#net-text-custom").hidden = custom;
  $("#net-text-reset").hidden = !custom;
}

function renderMentionPreview() {
  // Sous le texte commun : comment chaque mention sera écrite sur les réseaux cochés.
  const text = $("#text").value + Object.values(state.overrides).join(" ");
  const names = [...new Set([...text.matchAll(/@\[([^\]\n]{1,60})\]/g)].map((m) => m[1].trim()))];
  const providers = [...new Set(selectedAccounts().map((a) => a.provider))];
  const box = $("#mentions-preview") ?? (() => { const d = h("div", { id: "mentions-preview", class: "mentions-preview" }); $("#hashtags-box").before(d); return d; })();
  box.replaceChildren(...names.map((n) => {
    const c = state.mentions.find((m) => m.name.toLowerCase() === n.toLowerCase());
    return h("p", { class: "small" }, h("strong", {}, `@[${n}]`), " → ",
      ...(providers.length ? providers : ["instagram"]).flatMap((p, i) => [i ? " · " : null, h("span", { class: "net-label" }, netIcon(p), resolveMentions(`@[${n}]`, p))]),
      c ? null : h("span", { class: "muted" }, "  (contact inconnu : nom écrit tel quel)"));
  }));
}

/** Insère du texte à la position du curseur dans le texte affiché (commun ou propre au réseau). */
function insertAtCursor(snippet) {
  const net = !$("#net-text-box").hidden;
  if (net && $("#net-text").readOnly) $("#net-text-custom").click();
  const ta = net ? $("#net-text") : $("#text");
  const { selectionStart: s = ta.value.length, selectionEnd: e = ta.value.length } = ta;
  const before = ta.value.slice(0, s), after = ta.value.slice(e);
  const pad = before && !/\s$/.test(before) ? " " : "";
  ta.value = before + pad + snippet + (after.startsWith(" ") ? "" : " ") + after;
  const pos = (before + pad + snippet).length + 1;
  ta.focus();
  ta.setSelectionRange(pos, pos);
  ta.dispatchEvent(new Event("input"));
}

function renderMentionBox(editing = null) {
  const box = $("#mention-box");
  const search = h("input", { type: "search", placeholder: "Chercher un contact…", class: "mention-search" });
  const list = h("div", { class: "chips mention-chips" });
  const paint = () => {
    const q = search.value.trim().toLowerCase();
    list.replaceChildren(
      ...state.mentions.filter((m) => !q || m.name.toLowerCase().includes(q)).map((m) =>
        h("span", { class: "mention-chip-wrap" },
          h("button", { type: "button", class: "chip small-chip mention-chip", title: MENTION_NETS.filter(([n]) => m.handles[n]).map(([n, l]) => `${l} : ${m.handles[n]}`).join("\n") || "Aucun compte renseigné",
            onclick: () => { insertAtCursor(`@[${m.name}]`); } },
            "@ ", m.name, ...MENTION_NETS.filter(([n]) => m.handles[n]).map(([n]) => netIcon(n))),
          h("button", { type: "button", class: "mention-edit", title: `Modifier ${m.name}`, "aria-label": `Modifier ${m.name}`, onclick: () => renderMentionBox(m) }, "✎"))),
      state.mentions.length ? null : h("p", { class: "muted small" }, "Aucun contact pour l'instant : crée le premier ci-dessous."));
  };
  search.addEventListener("input", paint);
  paint();

  const name = h("input", { placeholder: "Nom (ex. Nintendo France)", maxlength: 60, value: editing?.name ?? "" });
  const fields = MENTION_NETS.map(([n, l]) => {
    const inp = h("input", { placeholder: n === "facebook" ? "Nom exact de la Page" : "nom du compte, sans @ (ou lien du profil)", value: editing?.handles?.[n] ?? "", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
    inp.dataset.net = n;
    return h("label", { class: "mention-field" }, h("span", { class: "net-label" }, netIcon(n), l), inp);
  });
  const save = async () => {
    const handles = Object.fromEntries(fields.map((f) => { const i = f.querySelector("input"); return [i.dataset.net, i.value]; }));
    try {
      await api(editing ? `/mentions/${editing.id}` : "/mentions", { method: editing ? "PUT" : "POST", body: JSON.stringify({ name: name.value, handles }) });
      await loadMentions();
      toast(editing ? "Contact modifié." : `Contact « ${name.value.trim()} » créé.`);
      renderMentionBox();
      renderComposeMeta();
    } catch (e) { toast(e.message, "err"); }
  };
  box.replaceChildren(
    h("div", { class: "mention-head" }, h("strong", {}, "Mentionner"), h("small", { class: "muted" }, "Un clic insère @[Nom] : l'app écrit le bon compte sur chaque réseau."),
      h("button", { type: "button", class: "btn ghost small", onclick: () => { box.hidden = true; } }, "Fermer")),
    state.mentions.length > 6 ? search : null,
    list,
    h("details", { class: "tuto-box mention-form", open: !!editing || !state.mentions.length },
      h("summary", {}, editing ? `Modifier « ${editing.name} »` : "＋ Nouveau contact"),
      name, ...fields,
      h("div", { class: "row" },
        h("button", { class: "btn primary small", type: "button", onclick: save }, editing ? "Enregistrer" : "Créer le contact"),
        editing ? h("button", { class: "btn ghost small", type: "button", onclick: () => renderMentionBox() }, "Annuler") : null,
        editing ? h("button", { class: "btn ghost small danger", type: "button", onclick: async () => {
          if (!confirm(`Supprimer le contact « ${editing.name} » ? Dans les posts, il sera écrit tel quel.`)) return;
          await api(`/mentions/${editing.id}`, { method: "DELETE" });
          await loadMentions();
          renderMentionBox();
          renderComposeMeta();
        } }, "Supprimer") : null),
      h("p", { class: "muted small" }, "Un réseau laissé vide : le nom est écrit en texte simple sur ce réseau.")),
  );
  box.hidden = false;
}

// ---------- Créneaux habituels ----------

const DAYS = [[1, "L"], [2, "M"], [3, "M"], [4, "J"], [5, "V"], [6, "S"], [0, "D"]];
const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

async function loadPresets() {
  try { [state.slots, state.templates] = await Promise.all([api("/slots"), api("/templates")]); } catch { /* garde l'existant */ }
}

/** Le créneau s'applique-t-il aux comptes cochés ? (créneau général, ou profil dont un compte est coché) */
const slotFits = (s) => s.profileId == null || (() => {
  const pr = state.profiles.find((p) => p.id === s.profileId);
  return !!pr && profileAccounts(pr).some((id) => state.selected.has(id));
})();

/** Prochaines dates libres d'un créneau (un post déjà programmé à ±10 min occupe la place). */
function nextFree(slot, count = 1, from = Date.now(), reserved = []) {
  const [hh, mm] = slot.time.split(":").map(Number);
  const pr = slot.profileId != null ? state.profiles.find((p) => p.id === slot.profileId) : null;
  const prAcc = pr ? new Set(profileAccounts(pr)) : null;
  const taken = (t) => reserved.some((r) => Math.abs(r - t) < 10 * 60e3) || (state.posts ?? []).some((p) => p.status === "scheduled" && p.id !== state.editingId && Math.abs((p.scheduledAt ?? 0) - t) < 10 * 60e3
    && (!prAcc || p.targets.some((x) => prAcc.has(x.accountId))));
  const out = [];
  const d = new Date(Math.max(from, Date.now()));
  for (let i = 0; i < 120 && out.length < count; i++) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, hh, mm);
    if (!slot.days.includes(day.getDay()) || day.getTime() < Math.max(from, Date.now() + 2 * 60e3)) continue;
    if (!taken(day.getTime())) out.push(day.getTime());
  }
  return out;
}

const slotLabel = (t) => {
  const d = new Date(t), today = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 864e5);
  const day = diff === 0 ? "aujourd'hui" : diff === 1 ? "demain" : `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
  return `${day} ${d.getHours()} h${d.getMinutes() ? String(d.getMinutes()).padStart(2, "0") : ""}`;
};

function renderSlots() {
  const box = $("#slot-box");
  if (!box) return;
  const fits = state.slots.filter(slotFits);
  const chips = fits.flatMap((s) => nextFree(s, 1).map((t) => ({ s, t }))).sort((a, b) => a.t - b.t);
  box.replaceChildren(
    chips.length
      ? h("div", { class: "slot-chips" }, h("small", { class: "muted" }, "Créneau :"),
          ...chips.map(({ s, t }) => h("button", { type: "button", class: "chip small-chip slot-chip", title: `${s.label} · ${s.time}`, onclick: () => {
            $("#when").value = toLocalInput(t);
            $("#when").dispatchEvent(new Event("change"));
            toast(`Programmé sur le créneau « ${s.label} » : ${slotLabel(t)}.`);
          } }, h("strong", {}, s.label), ` · ${slotLabel(t)}`)))
      : null,
    h("button", { type: "button", class: "link-btn small", onclick: () => { state.slotEditing = !state.slotEditing; renderSlots(); } },
      state.slotEditing ? "Fermer" : state.slots.length ? "Créneaux" : "＋ Créneaux"),
    state.slotEditing ? slotEditor() : null,
  );
}

function slotEditor() {
  const row = (s) => {
    const label = h("input", { value: s?.label ?? "", placeholder: "Nom (ex. NEWZ)", maxlength: 40 });
    const time = h("input", { type: "time", value: s?.time ?? "08:30" });
    const days = new Set(s?.days ?? [1, 2, 3, 4, 5]);
    const dayBtns = h("div", { class: "day-pick" }, ...DAYS.map(([n, l]) => {
      const b = h("button", { type: "button", class: `day${days.has(n) ? " on" : ""}`, "aria-pressed": String(days.has(n)), title: DAY_NAMES[n] }, l);
      b.onclick = () => { days.has(n) ? days.delete(n) : days.add(n); b.classList.toggle("on", days.has(n)); b.setAttribute("aria-pressed", String(days.has(n))); };
      return b;
    }));
    const profile = h("select", {}, h("option", { value: "" }, "Tous mes posts"), ...state.profiles.map((p) => h("option", { value: String(p.id), selected: p.id === s?.profileId }, `Profil : ${p.name}`)));
    return h("div", { class: "slot-row" }, label, time, dayBtns, profile,
      h("div", { class: "row" },
        h("button", { class: "btn primary small", type: "button", onclick: async () => {
          try {
            await api(s ? `/slots/${s.id}` : "/slots", { method: s ? "PUT" : "POST", body: JSON.stringify({ label: label.value, time: time.value, days: [...days], profileId: profile.value ? Number(profile.value) : null }) });
            await loadPresets(); toast("Créneau enregistré."); renderSlots();
          } catch (e) { toast(e.message, "err"); }
        } }, s ? "Enregistrer" : "Ajouter"),
        s ? h("button", { class: "btn ghost small danger", type: "button", onclick: async () => { await api(`/slots/${s.id}`, { method: "DELETE" }); await loadPresets(); renderSlots(); } }, "✕") : null));
  };
  return h("div", { class: "tagset-editor" },
    h("p", { class: "muted small" }, "Tes heures habituelles : l'app propose le prochain créneau libre (pas déjà pris par un post programmé). Lié à un profil, un créneau n'est proposé que quand ce profil est coché."),
    ...state.slots.map(row), row(null));
}

// ---------- Aperçu par réseau ----------
// Une maquette simplifiée de chaque réseau : texte final (mentions, texte propre au réseau),
// coupure « … plus », médias envoyés à ce réseau (carrousel qu'on fait défiler).

const TRUNC = { instagram: 125, facebook: 480, threads: 500, x: 280, tiktok: 100, youtube: 160 };

/** Texte avec hashtags et @mentions mis en valeur (nœuds DOM, jamais de HTML injecté). */
function richText(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/(^|\s)([#@][\p{L}\p{N}_.]+)/gu)) {
    const i = m.index + m[1].length;
    out.push(text.slice(last, i), h("span", { class: "pv-link" }, m[2]));
    last = i + m[2].length;
  }
  out.push(text.slice(last));
  return out;
}

function previewCard(a) {
  const o = optionsFor(a);
  const media = chosenMedia(o);
  const text = finalText(a);
  const limit = TRUNC[a.provider] ?? 300;
  const cut = countChars(text) > limit || text.split("\n").length > (a.provider === "instagram" ? 2 : 6);
  const short = cut ? [...new Intl.Segmenter().segment(text)].map((s) => s.segment).slice(0, limit).join("").split("\n").slice(0, a.provider === "instagram" ? 2 : 6).join("\n") : text;
  const caption = h("div", { class: "pv-text" }, ...richText(short), cut ? h("button", { type: "button", class: "pv-more", onclick: (e) => e.currentTarget.parentElement.replaceChildren(...richText(text)) }, a.provider === "facebook" ? "… Voir plus" : "… plus") : null);
  const mediaEl = media.length
    ? h("div", { class: `pv-media ${media.length > 1 ? "carousel" : ""} pv-${a.provider}` },
        ...media.map((m, i) => h("div", { class: "pv-slide" },
          m.kind === "video" ? h("video", { src: m.url, muted: true, playsinline: true, controls: true, preload: "metadata" }) : h("img", { src: m.url, alt: "" }),
          media.length > 1 ? h("span", { class: "pv-count" }, `${i + 1}/${media.length}`) : null)))
    : null;
  const head = h("div", { class: "pv-head" }, h("span", { class: "avatar-wrap" }, avatar(a), h("span", { class: "avatar-net" }, netIcon(a.provider))),
    h("div", {}, h("strong", {}, a.name), h("small", { class: "muted" }, a.provider === "x" || a.provider === "threads" ? " · maintenant" : "")));
  const story = a.provider === "instagram" && o.format === "story";
  if (story) return h("div", { class: "pv pv-story" }, mediaEl ?? h("p", { class: "muted" }, "Pas de média"), h("div", { class: "pv-story-head" }, head));
  if (a.provider === "instagram")
    return h("div", { class: "pv pv-instagram" }, head, mediaEl ?? h("p", { class: "error small" }, "Instagram exige une image ou une vidéo."),
      h("div", { class: "pv-actions" }, "♡  💬  ➤", media.length > 1 ? h("span", { class: "pv-dots" }, ...media.map((_, i) => h("i", { class: i === 0 ? "on" : "" }))) : null),
      h("div", { class: "pv-caption" }, h("strong", {}, a.name.replace(/^@/, "")), " ", caption),
      o.firstComment ? h("div", { class: "pv-caption pv-comment" }, h("strong", {}, a.name.replace(/^@/, "")), " ", h("span", {}, ...richText(resolveMentions(o.firstComment, a.provider)))) : null);
  if (a.provider === "youtube" || a.provider === "tiktok")
    return h("div", { class: `pv pv-${a.provider}` }, mediaEl ?? h("p", { class: "error small" }, "Une vidéo est nécessaire."), head,
      a.provider === "youtube" ? h("strong", { class: "pv-title" }, o.title || text.split("\n")[0] || "(sans titre)") : null, caption);
  return h("div", { class: `pv pv-${a.provider}` }, head, caption, mediaEl);
}

function openPreview() {
  const accs = selectedAccounts();
  if (!accs.length) return toast("Coche d'abord au moins un compte.", "err");
  const dlg = $("#share-dialog"), body = $("#share-body");
  $("#share-title").textContent = "Aperçu par réseau";
  let current = accs[0].id;
  const paint = () => {
    const a = accs.find((x) => x.id === current);
    body.replaceChildren(
      h("div", { class: "text-tabs pv-tabs" }, ...accs.map((x) => h("button", { type: "button", class: `text-tab${x.id === current ? " active" : ""}`, onclick: () => { current = x.id; paint(); } },
        netIcon(x.provider), accs.filter((y) => y.provider === x.provider).length > 1 ? h("span", {}, x.name) : x.provider === "x" ? null : h("span", {}, PROVIDER[x.provider]?.label ?? x.provider)))),
      previewCard(a),
      h("p", { class: "muted small" }, "Aperçu simplifié : l'affichage réel peut varier un peu selon l'appareil."));
  };
  paint();
  dlg.classList.add("pv-dialog");
  dlg.addEventListener("close", () => dlg.classList.remove("pv-dialog"), { once: true });
  dlg.showModal();
}

// ---------- Recadrage ----------
// Fait dans le navigateur (canvas) : l'image recadrée remplace l'originale dans le post.

const RATIOS = [
  ["4:5", 4 / 5, "Instagram (portrait)", 1080, 1350],
  ["1:1", 1, "Carré", 1080, 1080],
  ["9:16", 9 / 16, "Story, Reel, TikTok", 1080, 1920],
  ["16:9", 16 / 9, "YouTube, X", 1920, 1080],
  ["1.91:1", 1.91, "Paysage Instagram / Facebook", 1200, 628],
];

function openCrop(index) {
  const m = state.media[index];
  const dlg = $("#share-dialog"), body = $("#share-body");
  $("#share-title").textContent = "Recadrer l'image";
  const img = new Image();
  img.src = m.url;
  let ratio = RATIOS[0], z = 1, ox = 0, oy = 0, s = 1;
  const stage = h("div", { class: "crop-stage" });
  const view = h("img", { src: m.url, alt: "", class: "crop-img", draggable: "false" });
  stage.append(view, h("div", { class: "crop-grid", "aria-hidden": "true" }));
  const zoom = h("input", { type: "range", min: 1, max: 3, step: 0.01, value: 1, "aria-label": "Zoom" });
  const dims = () => { const r = stage.getBoundingClientRect(); return [r.width, r.height]; };
  const clamp = () => {
    const [W, H] = dims();
    ox = Math.min(0, Math.max(W - img.naturalWidth * s, ox));
    oy = Math.min(0, Math.max(H - img.naturalHeight * s, oy));
    view.style.transform = `translate(${ox}px, ${oy}px) scale(${s})`;
  };
  const fit = (keepCenter) => {
    const [W, H] = dims();
    const cx = keepCenter ? (W / 2 - ox) / s : img.naturalWidth / 2, cy = keepCenter ? (H / 2 - oy) / s : img.naturalHeight / 2;
    s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * z;
    ox = W / 2 - cx * s; oy = H / 2 - cy * s;
    clamp();
  };
  const setRatio = (r) => {
    ratio = r;
    stage.style.aspectRatio = String(r[1]);
    const w = Math.floor(Math.min(380, (body.clientWidth || 380) - 4, innerHeight * 0.5 * r[1]));
    stage.style.width = `${w}px`;
    stage.style.height = `${Math.round(w / r[1])}px`;
    paintRatios();
    requestAnimationFrame(() => fit(false));
  };
  zoom.addEventListener("input", () => { z = Number(zoom.value); fit(true); });
  // Déplacer l'image au doigt ou à la souris.
  let drag = null;
  stage.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, ox, oy }; stage.setPointerCapture(e.pointerId); });
  stage.addEventListener("pointermove", (e) => { if (!drag) return; ox = drag.ox + e.clientX - drag.x; oy = drag.oy + e.clientY - drag.y; clamp(); });
  stage.addEventListener("pointerup", () => { drag = null; });
  const ratioBox = h("div", { class: "chips crop-ratios" });
  const paintRatios = () => ratioBox.replaceChildren(...RATIOS.map((r) => h("button", { type: "button", class: `chip small-chip${r === ratio ? " active" : ""}`, title: r[2], onclick: () => setRatio(r) }, h("strong", {}, r[0]), h("small", {}, ` ${r[2]}`))));
  const save = h("button", { class: "btn primary share-go", type: "button" }, "✂ Recadrer");
  save.onclick = async () => {
    save.disabled = true; save.textContent = "Envoi…";
    try {
      const [W, H] = dims();
      const [, , , OW, OH] = ratio;
      const canvas = h("canvas", { width: OW, height: OH });
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, -ox / s, -oy / s, W / s, H / s, 0, 0, OW, OH);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      const file = new File([blob], m.filename.replace(/\.[a-z0-9]+$/i, "") + ` ${ratio[0].replace(":", "x")}.jpg`, { type: "image/jpeg" });
      const nm = await upload(file);
      const old = state.media[index];
      state.media[index] = nm;
      for (const o of Object.values(state.targetOptions)) if (Array.isArray(o.media)) o.media = o.media.map((id) => (id === old.id ? nm.id : id));
      cardsKey = "";
      renderMedia(); renderComposeMeta(); forgetMedia([old]);
      toast(`Image recadrée en ${ratio[0]}.`);
      dlg.close();
    } catch (e) { toast(e.message, "err"); save.disabled = false; save.textContent = "✂ Recadrer"; }
  };
  body.replaceChildren(ratioBox, stage, h("label", { class: "field-inline" }, h("span", {}, "Zoom"), zoom),
    h("p", { class: "muted small" }, "Fais glisser l'image pour choisir la partie gardée. L'image recadrée (JPG) remplace l'originale dans ce post."), save);
  paintRatios();
  dlg.showModal();
  img.decode().then(() => setRatio(RATIOS[0]), () => toast("Image illisible.", "err"));
}

// ---------- Programmation en lot ----------

state.batch = new Set();

function batchToolbar(drafts) {
  const n = [...state.batch].filter((id) => drafts.some((p) => p.id === id)).length;
  const all = h("input", { type: "checkbox", checked: n > 0 && n === drafts.length, "aria-label": "Tout sélectionner" });
  all.addEventListener("change", () => { state.batch = all.checked ? new Set(drafts.map((p) => p.id)) : new Set(); renderQueue(); });
  return h("div", { class: "batch-bar" },
    h("label", { class: "check" }, all, h("span", {}, n ? `${plural(n, "brouillon")} choisi${n > 1 ? "s" : ""}` : "Tout sélectionner")),
    h("button", { class: "btn primary small", type: "button", disabled: !n, onclick: () => openBatch(drafts.filter((p) => state.batch.has(p.id))) }, "📅 Programmer"));
}

function batchPick(p) {
  const cb = h("input", { type: "checkbox", checked: state.batch.has(p.id), "aria-label": "Choisir ce brouillon" });
  cb.addEventListener("change", () => { cb.checked ? state.batch.add(p.id) : state.batch.delete(p.id); renderQueue(); });
  return h("label", { class: "batch-pick" }, cb, h("span", {}, "Choisir"));
}

function openBatch(list) {
  const dlg = $("#share-dialog"), body = $("#share-body");
  $("#share-title").textContent = "Programmer la sélection";
  list = [...list].sort((a, b) => a.createdAt - b.createdAt);
  const sel = h("select", {},
    ...state.slots.map((s) => h("option", { value: `slot:${s.id}` }, `${s.label} · ${s.time} (${DAYS.filter(([n]) => s.days.includes(n)).map(([n]) => DAY_NAMES[n]).join(" ")})`)),
    h("option", { value: "daily" }, "Un par jour à l'heure choisie"));
  const time = h("input", { type: "time", value: "08:30" });
  const start = h("input", { type: "date", value: toLocalInput(Date.now()).slice(0, 10) });
  const preview = h("ol", { class: "batch-preview" });
  const plan = () => {
    const slot = sel.value === "daily" ? { days: [0, 1, 2, 3, 4, 5, 6], time: time.value || "08:30", profileId: null } : state.slots.find((s) => `slot:${s.id}` === sel.value);
    const from = new Date(`${start.value}T00:00`).getTime() || Date.now();
    const times = nextFree(slot, list.length, from);
    return list.map((p, i) => ({ p, t: times[i] }));
  };
  const paint = () => {
    time.closest("label").hidden = sel.value !== "daily";
    preview.replaceChildren(...plan().map(({ p, t }) => h("li", {}, h("strong", {}, t ? slotLabel(t) : "—"), " · ", (p.title || p.source || p.text.split("\n")[0] || "(sans texte)").slice(0, 60))));
  };
  for (const el of [sel, time, start]) el.addEventListener("change", paint);
  const go = h("button", { class: "btn primary share-go", type: "button" }, `Programmer ${plural(list.length, "post")}`);
  go.onclick = async () => {
    const items = plan().filter((x) => x.t).map(({ p, t }) => ({ id: p.id, scheduledAt: t }));
    go.disabled = true;
    try {
      const { results } = await api("/posts/batch-schedule", { method: "POST", body: JSON.stringify({ items }) });
      const ok = results.filter((r) => r.ok).length;
      const bad = results.filter((r) => r.error);
      toast(`${plural(ok, "post")} programmé${ok > 1 ? "s" : ""}.${bad.length ? ` ${bad.length} à corriger.` : ""}`, bad.length ? "err" : "ok");
      if (bad.length) {
        body.replaceChildren(h("p", {}, "Ces brouillons n'ont pas pu être programmés :"),
          h("ul", { class: "batch-errors" }, ...bad.map((r) => { const p = list.find((x) => x.id === r.id); return h("li", {}, h("strong", {}, (p?.text.split("\n")[0] || "(sans texte)").slice(0, 50)), ` : ${r.error}`); })),
          h("button", { class: "btn ghost", type: "button", onclick: () => dlg.close() }, "Fermer"));
      } else dlg.close();
      state.batch = new Set();
      loadPosts();
    } catch (e) { toast(e.message, "err"); go.disabled = false; }
  };
  body.replaceChildren(
    h("p", { class: "small" }, "Les brouillons sont répartis, du plus ancien au plus récent, sur les prochains créneaux libres."),
    h("label", { class: "field-inline" }, h("span", {}, "Créneau"), sel),
    h("label", { class: "field-inline" }, h("span", {}, "Heure"), time),
    h("label", { class: "field-inline" }, h("span", {}, "À partir du"), start),
    preview, go);
  paint();
  dlg.showModal();
}

// ---------- Modèles de légende ----------

/** Remplit {date}, {jour}, {heure} d'après la date choisie dans « Quand ? ». */
function fillTemplate(text) {
  const t = Date.parse($("#when").value) || Date.now();
  const d = new Date(t);
  return text
    .replace(/\{date\}/g, d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" }))
    .replace(/\{jour\}/g, d.toLocaleDateString("fr-FR", { weekday: "long" }))
    .replace(/\{heure\}/g, `${d.getHours()} h${d.getMinutes() ? String(d.getMinutes()).padStart(2, "0") : ""}`);
}

function applyTemplate(tpl) {
  const ta = $("#text");
  const text = fillTemplate(tpl.text);
  if (ta.value.trim()) {
    const replace = confirm(`Appliquer le modèle « ${tpl.name} » ?\n\nOK : remplacer le texte actuel\nAnnuler : l'ajouter à la fin`);
    ta.value = replace ? text : `${ta.value.replace(/\s+$/, "")}\n\n${text}`;
  } else ta.value = text;
  state.textTab = "all";
  ta.dispatchEvent(new Event("input"));
  $("#template-box").hidden = true;
  toast(`Modèle « ${tpl.name} » appliqué.`);
}

function renderTemplateBox(editing = null) {
  const box = $("#template-box");
  const fits = state.templates.filter((t) => t.profileId == null || slotFits(t));
  const name = h("input", { placeholder: "Nom (ex. Trame NEWZ)", maxlength: 60, value: editing?.name ?? "" });
  const text = h("textarea", { rows: 5, placeholder: "🎮 NEWZ du {date}\n\n…\n\n@[Nintendo France] #gaming #jeuxvideo" });
  text.value = editing?.text ?? "";
  const profile = h("select", {}, h("option", { value: "" }, "Pour tous mes posts"), ...state.profiles.map((p) => h("option", { value: String(p.id), selected: p.id === editing?.profileId }, `Profil : ${p.name}`)));
  const save = async () => {
    try {
      await api(editing ? `/templates/${editing.id}` : "/templates", { method: editing ? "PUT" : "POST", body: JSON.stringify({ name: name.value, text: text.value, profileId: profile.value ? Number(profile.value) : null }) });
      await loadPresets(); toast("Modèle enregistré."); renderTemplateBox();
    } catch (e) { toast(e.message, "err"); }
  };
  box.replaceChildren(
    h("div", { class: "mention-head" }, h("strong", {}, "Modèles de légende"), h("small", { class: "muted" }, "Un clic applique le modèle. {date}, {jour} et {heure} prennent la date de « Quand ? »."),
      h("button", { type: "button", class: "btn ghost small", onclick: () => { box.hidden = true; } }, "Fermer")),
    h("div", { class: "chips mention-chips" },
      ...fits.map((t) => h("span", { class: "mention-chip-wrap" },
        h("button", { type: "button", class: "chip small-chip mention-chip", title: t.text.slice(0, 200), onclick: () => applyTemplate(t) }, "📄 ", t.name),
        h("button", { type: "button", class: "mention-edit", "aria-label": `Modifier ${t.name}`, onclick: () => renderTemplateBox(t) }, "✎"))),
      fits.length ? null : h("p", { class: "muted small" }, state.templates.length ? "Aucun modèle pour les comptes cochés." : "Aucun modèle pour l'instant.")),
    h("details", { class: "tuto-box mention-form", open: !!editing || !state.templates.length },
      h("summary", {}, editing ? `Modifier « ${editing.name} »` : "＋ Nouveau modèle"),
      name, text, profile,
      h("div", { class: "row" },
        h("button", { class: "btn primary small", type: "button", onclick: save }, editing ? "Enregistrer" : "Créer le modèle"),
        editing ? null : h("button", { class: "btn ghost small", type: "button", onclick: () => { text.value = $("#text").value; } }, "Texte actuel"),
        editing ? h("button", { class: "btn ghost small", type: "button", onclick: () => renderTemplateBox() }, "Annuler") : null,
        editing ? h("button", { class: "btn ghost small danger", type: "button", onclick: async () => {
          if (!confirm(`Supprimer le modèle « ${editing.name} » ?`)) return;
          await api(`/templates/${editing.id}`, { method: "DELETE" }); await loadPresets(); renderTemplateBox();
        } }, "Supprimer") : null)),
  );
  box.hidden = false;
}

// ---------- hashtags ----------

/** Hashtags d'un texte (même règle que le serveur). */
const extractHashtags = (t) => [...t.matchAll(/(^|[^\p{L}\p{N}_&\/#])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu)].map((m) => `#${m[2]}`);

/** Règles de hashtags par réseau : [niveau, message] ou null. */
function hashtagRule(provider, tags) {
  const n = tags.length;
  if (!n) return null;
  if (provider === "instagram" && n > 30) return ["err", `Instagram : ${n} hashtags, 30 maximum (sinon le post est refusé).`];
  if (provider === "threads" && n > 1) return ["warn", `Threads : un seul tag par post. « ${tags[0]} » deviendra le sujet du post, les autres resteront du simple texte.`];
  if (provider === "youtube" && n > 15) return ["warn", `YouTube : au-delà de 15 hashtags, YouTube les ignore tous (${n} ici).`];
  if (provider === "x" && n > 3) return ["info", `X : ${n} hashtags comptent dans les 280 caractères ; 1 ou 2 suffisent en général.`];
  return null;
}

async function loadHashtags() {
  try {
    const r = await api("/hashtags");
    state.hashtags.sets = r.sets;
    state.hashtags.top = r.top;
  } catch {
    /* hors ligne : on garde l'existant */
  }
}

/** Ajoute des hashtags à la fin du texte, sans doublon. */
function insertHashtags(tags) {
  const ta = $("#text");
  const have = new Set(extractHashtags(ta.value).map((t) => t.toLowerCase()));
  const add = tags.filter((t) => !have.has(t.toLowerCase()));
  if (!add.length) return toast("Ces hashtags sont déjà dans le texte.");
  const v = ta.value.replace(/\s+$/, "");
  const lastLine = v.split("\n").at(-1) ?? "";
  const onTagLine = lastLine.trim() && lastLine.trim().split(/\s+/).every((w) => w.startsWith("#"));
  ta.value = v + (v ? (onTagLine ? " " : "\n\n") : "") + add.join(" ");
  ta.dispatchEvent(new Event("input"));
}

/** Jeux proposés : ceux « pour tous » + ceux des profils dont un compte est coché. */
function relevantSets() {
  const sel = state.selected;
  return state.hashtags.sets.filter((s) => {
    if (s.profileId == null) return true;
    const pr = state.profiles.find((p) => p.id === s.profileId);
    return pr && profileAccounts(pr).some((id) => sel.has(id));
  });
}

function renderHashtags() {
  const box = $("#hashtags-box");
  if (!box) return;
  const H = state.hashtags;
  const text = $("#text").value;
  const tags = extractHashtags(text);
  const accs = selectedAccounts();
  const providers = [...new Set(accs.map((a) => a.provider))];
  const notes = providers
    .map((p) => {
      const t = [...new Set(accs.filter((a) => a.provider === p).flatMap((a) => extractHashtags(finalText(a))))];
      return hashtagRule(p, t);
    })
    .filter(Boolean);
  const inText = new Set(tags.map((t) => t.toLowerCase()));
  const sets = relevantSets();
  const freq = H.top.filter((t) => !inText.has(t.tag.toLowerCase())).slice(0, 12);

  box.replaceChildren(...[
    tags.length
      ? h("div", { class: "tag-found" }, h("span", { class: "tag-count" }, `# ${tags.length} hashtag${tags.length > 1 ? "s" : ""}`),
          ...tags.slice(0, 40).map((t) => h("span", { class: "tag-pill" }, t)))
      : null,
    ...notes.map(([lvl, msg]) => h("p", { class: `tag-note ${lvl}` }, msg)),
    sets.length || freq.length
      ? h("div", { class: "tag-insert" },
          h("small", { class: "muted" }, "Insérer :"),
          ...sets.map((s) => h("button", { type: "button", class: "chip small-chip tag-set", title: s.tags.join(" "), onclick: () => insertHashtags(s.tags) }, `# ${s.name}`)),
          ...freq.map((t) => h("button", { type: "button", class: "chip small-chip tag-freq", title: `Utilisé dans ${t.n} post${t.n > 1 ? "s" : ""}`, onclick: () => insertHashtags([t.tag]) }, t.tag)))
      : null,
    h("button", { type: "button", class: "link-btn small", onclick: () => { H.editing = !H.editing; renderHashtags(); } },
      H.editing ? "Fermer" : sets.length || H.sets.length ? "Jeux de hashtags" : "＋ Jeux de hashtags"),
    H.editing ? hashtagEditor() : null,
  ].filter(Boolean));
}

function hashtagEditor() {
  const H = state.hashtags;
  const profileSelect = (value) =>
    h("select", {}, h("option", { value: "" }, "Pour tous mes posts"),
      ...state.profiles.map((p) => h("option", { value: String(p.id), selected: p.id === value }, `Profil : ${p.name}`)));
  const save = async (id, name, tags, profile) => {
    try {
      await api(id ? `/hashtags/sets/${id}` : "/hashtags/sets", {
        method: id ? "PUT" : "POST",
        body: JSON.stringify({ name: name.value, tags: tags.value, profileId: profile.value ? Number(profile.value) : null }),
      });
      toast(id ? "Jeu modifié." : "Jeu de hashtags créé.");
      await loadHashtags();
      renderHashtags();
    } catch (e) {
      toast(e.message, "err");
    }
  };
  const row = (s) => {
    const name = h("input", { value: s?.name ?? "", placeholder: "Nom, ex. NEWZ jeux vidéo", maxlength: 60 });
    const tags = h("input", { value: s ? s.tags.join(" ") : "", placeholder: "#gaming #jeuxvideo #news" });
    const profile = profileSelect(s?.profileId ?? null);
    return h("div", { class: "tagset-row" }, name, tags, profile,
      h("div", { class: "row" },
        h("button", { class: "btn primary small", type: "button", onclick: () => save(s?.id, name, tags, profile) }, s ? "Enregistrer" : "Créer"),
        s ? h("button", { class: "btn ghost small danger", type: "button", onclick: async () => {
          if (!confirm(`Supprimer le jeu « ${s.name} » ?`)) return;
          await api(`/hashtags/sets/${s.id}`, { method: "DELETE" });
          await loadHashtags();
          renderHashtags();
        } }, "Supprimer") : null));
  };
  return h("div", { class: "tagset-editor" },
    h("p", { class: "muted small" }, "Un jeu = des hashtags que tu réutilises souvent. Lié à un profil, il n'est proposé que quand ce profil est coché."),
    ...H.sets.map(row), row(null));
}

// ---------- Options par réseau ----------

const PRIVACY_YT = [["public", "Publique"], ["unlisted", "Non répertoriée"], ["private", "Privée"]];
const PRIVACY_TT = [["PUBLIC_TO_EVERYONE", "Tout le monde"], ["FOLLOWER_OF_CREATOR", "Abonnés"], ["MUTUAL_FOLLOW_FRIENDS", "Amis"], ["SELF_ONLY", "Moi uniquement"]];
const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Médias proposés par défaut à un réseau, selon ce qu'il accepte. */
function defaultMediaIds(provider, media) {
  const vids = media.filter((m) => m.kind === "video");
  const imgs = media.filter((m) => m.kind === "image");
  if (provider === "youtube" || provider === "tiktok") return vids.slice(0, 1).map((m) => m.id);
  if (provider === "x") return (vids.length ? vids.slice(0, 1) : imgs.slice(0, 4)).map((m) => m.id);
  if (provider === "instagram") return media.slice(0, 10).map((m) => m.id);
  if (provider === "facebook") return (vids.length && imgs.length ? imgs : media).map((m) => m.id);
  return media.slice(0, 20).map((m) => m.id);
}

function optionsFor(a) {
  const o = (state.targetOptions[a.id] ??= {});
  const ids = new Set(state.media.map((m) => m.id));
  if (o.media) o.media = o.media.filter((id) => ids.has(id));
  // Tant que tu n'as pas choisi toi-même, la sélection suit les médias ajoutés.
  if (!o._manual) o.media = defaultMediaIds(a.provider, state.media);
  if (a.provider === "youtube") o.privacy ??= "public";
  if (a.provider === "tiktok") {
    o.privacy ??= "PUBLIC_TO_EVERYONE";
    o.allowComment ??= true;
    o.allowDuet ??= true;
    o.allowStitch ??= true;
  }
  if (a.provider === "instagram") o.format ??= "feed";
  return o;
}

const chosenMedia = (o) => state.media.filter((m) => !o.media || o.media.includes(m.id));

function formatSummary(a, o) {
  const m = chosenMedia(o);
  const imgs = m.filter((x) => x.kind === "image").length, vids = m.length - imgs;
  switch (a.provider) {
    case "instagram":
      if (o.format === "story") return `Story : ${plural(m.length, "média")} publié${m.length > 1 ? "s" : ""} l'un après l'autre`;
      return m.length > 1 ? `Carrousel de ${m.length}` : vids ? "Reel" : imgs ? "Post photo" : "—";
    case "facebook":
      return vids ? "Vidéo" : imgs ? (imgs > 1 ? `Post avec ${imgs} photos` : "Post photo") : "Post texte";
    case "threads":
      return m.length > 1 ? `Carrousel de ${m.length}` : vids ? "Vidéo" : imgs ? "Image" : "Texte seul";
    case "x":
      return vids ? "Vidéo" : imgs ? plural(imgs, "image") : "Texte seul";
    case "youtube":
      return vids ? "Vidéo (Short si verticale et < 3 min)" : "—";
    case "tiktok":
      return vids ? "Vidéo" : "—";
  }
  return "";
}

function field(label, control) {
  return h("label", { class: "tfield" }, h("span", {}, label), control);
}

function select(options, value, onChange) {
  const el = h("select", {}, ...options.map(([v, l]) => h("option", { value: v }, l)));
  el.value = value;
  el.addEventListener("change", () => onChange(el.value));
  return el;
}

function checkbox(label, checked, onChange) {
  const input = h("input", { type: "checkbox" });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return h("label", { class: "tcheck" }, input, h("span", {}, label));
}

let cardsKey = "";

function renderTargetCards() {
  const accs = selectedAccounts();
  $("#targets-box").hidden = accs.length === 0;
  // Ne reconstruit les cartes que si les comptes ou les médias changent (pour ne pas perdre la saisie).
  const key = JSON.stringify([accs.map((a) => a.id), state.media.map((m) => m.id), accs.map((a) => state.targetOptions[a.id]?.format)]);
  if (key === cardsKey) return paintCardStatus();
  cardsKey = key;
  $("#target-cards").replaceChildren(...accs.map(targetCard));
  paintCardStatus();
}

function changed(rebuild = false) {
  if (rebuild) cardsKey = "";
  renderComposeMeta();
}

function targetCard(a) {
  const o = optionsFor(a);
  const body = [];
  const head = h("header", {}, badge(a.provider), h("strong", {}, a.name), h("span", { class: "tstatus" }));
  // Réseau vidéo sans vidéo dans le post : seul le message utile est affiché.
  if ((a.provider === "youtube" || a.provider === "tiktok") && state.media.length && !state.media.some((m) => m.kind === "video")) {
    return h("article", { class: "tcard compact", "data-id": a.id, style: `--c:${PROVIDER[a.provider]?.color}` }, head);
  }

  // Format
  if (a.provider === "instagram" && state.media.length) {
    body.push(field("Format", select([["feed", "Publication (post, carrousel ou Reel)"], ["story", "Story"]], o.format, (v) => { o.format = v; changed(true); })));
    if (o.format === "feed") body.push(checkbox("Publier aussi la 1re slide en story", !!o.alsoStory, (v) => { o.alsoStory = v; changed(); }));
    body.push(h("div", { class: "ig-finish" },
      h("button", { class: "btn ghost small", type: "button", onclick: () => finishInInstagram({
        media: chosenMedia(o),
        caption: finalText(a),
        onPublished: async () => {
          // Publié à la main : on retire Instagram de ce post pour ne pas le publier une 2e fois.
          state.selected.delete(a.id);
          renderPicker();
          renderComposeMeta();
          toast("Instagram retiré de ce post (déjà publié depuis l'appli).");
        },
      }) }, "📲 Finir dans Instagram"),
      h("small", { class: "muted" }, "Instagram ne laisse ajouter sa musique que dans son appli.")));
  }
  body.push(h("p", { class: "tformat" }, formatSummary(a, o)));

  // Médias envoyés à ce réseau
  if (state.media.length) {
    const sel = new Set(chosenMedia(o).map((m) => m.id));
    body.push(
      h("div", { class: "tmedia" },
        h("span", { class: "tlabel" }, `Médias envoyés : ${sel.size} / ${state.media.length}`),
        h("div", { class: "tthumbs" },
          ...state.media.map((m, i) => {
            const b = h("button", { type: "button", class: `tthumb ${sel.has(m.id) ? "on" : ""}`, title: `${i + 1}. ${m.filename}`, "aria-pressed": String(sel.has(m.id)) },
              m.kind === "video" ? h("span", { class: "tvid" }, "▶") : h("img", { src: m.url, alt: "" }),
              h("span", { class: "tnum" }, String(i + 1)));
            b.addEventListener("click", () => {
              const cur = new Set(chosenMedia(o).map((x) => x.id));
              cur.has(m.id) ? cur.delete(m.id) : cur.add(m.id);
              o.media = state.media.filter((x) => cur.has(x.id)).map((x) => x.id);
              o._manual = true;
              changed(true);
            });
            return b;
          })),
        o._manual
          ? h("button", { type: "button", class: "linklike", onclick: () => { o._manual = false; changed(true); } }, "Sélection auto")
          : null),
    );
  }

  // Réglages propres au réseau
  if (a.provider === "youtube") {
    const t = h("input", { maxlength: 100, placeholder: "Par défaut : la 1re ligne du texte" });
    t.value = o.title ?? "";
    t.addEventListener("input", () => { o.title = t.value; $("#title").value = t.value; scheduleValidation(); });
    body.push(field("Titre de la vidéo", t));
    body.push(field("Visibilité", select(PRIVACY_YT, o.privacy, (v) => { o.privacy = v; })));
    body.push(h("p", { class: "muted small" }, "Tant que Google n'a pas validé ton app, YouTube met la vidéo en privé."));
  }
  if (a.provider === "tiktok") {
    body.push(field("Qui peut voir la vidéo", select(PRIVACY_TT, o.privacy, (v) => { o.privacy = v; })));
    body.push(h("div", { class: "tchecks" },
      checkbox("Commentaires", o.allowComment, (v) => { o.allowComment = v; }),
      checkbox("Duo", o.allowDuet, (v) => { o.allowDuet = v; }),
      checkbox("Collage", o.allowStitch, (v) => { o.allowStitch = v; })));
    body.push(h("p", { class: "muted small" }, "Tant que TikTok n'a pas audité ton app, la vidéo est publiée en « Moi uniquement »."));
  }

  // Couverture : un moment de la vidéo (Reel Instagram seul, TikTok).
  const vids = chosenMedia(o).filter((m) => m.kind === "video");
  if (((a.provider === "instagram" && o.format !== "story" && chosenMedia(o).length === 1) || a.provider === "tiktok") && vids.length === 1) {
    const v = h("video", { src: vids[0].url, muted: true, playsinline: true, preload: "metadata", class: "cover-video" });
    const range = h("input", { type: "range", min: 0, max: 100, step: 0.1, value: 0, "aria-label": "Moment de la couverture" });
    const lbl = h("small", { class: "muted" }, o.coverMs != null ? `Couverture à ${(o.coverMs / 1000).toFixed(1)} s` : "Couverture : choisie par le réseau (début de la vidéo)");
    v.addEventListener("loadedmetadata", () => {
      range.max = String(Math.max(0.1, v.duration));
      if (o.coverMs != null) { range.value = String(o.coverMs / 1000); v.currentTime = o.coverMs / 1000; }
    });
    range.addEventListener("input", () => {
      v.currentTime = Number(range.value);
      o.coverMs = Math.round(Number(range.value) * 1000);
      lbl.textContent = `Couverture à ${(o.coverMs / 1000).toFixed(1)} s`;
    });
    body.push(h("details", { class: "toverride", open: o.coverMs != null }, h("summary", {}, "🖼 Image de couverture"), v, range, lbl));
  }

  // Premier commentaire (Instagram, Facebook) ou réponse (X, Threads), publié juste après le post.
  if (["instagram", "facebook", "x", "threads"].includes(a.provider) && !(a.provider === "instagram" && o.format === "story")) {
    const label = a.provider === "x" || a.provider === "threads" ? "Réponse automatique sous le post (facultatif)" : "Premier commentaire (facultatif)";
    const fc = h("textarea", { rows: 2, placeholder: a.provider === "instagram" ? "#gaming #jeuxvideo #news…" : "Lien, source, hashtags…", maxlength: 2200 });
    fc.value = o.firstComment ?? "";
    fc.addEventListener("input", () => { o.firstComment = fc.value; scheduleValidation(); });
    const moveTags = a.provider === "instagram" || a.provider === "facebook"
      ? h("button", { type: "button", class: "linklike", onclick: () => {
          const text = state.overrides[a.id] ?? $("#text").value;
          const tags = extractHashtags(text);
          if (!tags.length) return toast("Pas de hashtag dans le texte.");
          // Retire les hashtags du texte de CE réseau seulement (texte propre), et les met en commentaire.
          const cleaned = text.split("\n").map((l) => l.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").replace(/\s+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
          state.overrides[a.id] = cleaned;
          o.firstComment = [o.firstComment?.trim(), tags.join(" ")].filter(Boolean).join("\n");
          fc.value = o.firstComment;
          renderComposeMeta();
          toast(`${plural(tags.length, "hashtag")} déplacé${tags.length > 1 ? "s" : ""} dans le premier commentaire (${PROVIDER[a.provider].label} seulement).`);
        } }, "↧ Hashtags en commentaire")
      : null;
    body.push(h("details", { class: "toverride", open: !!o.firstComment }, h("summary", {}, `💬 ${label}`), fc, moveTags,
      h("small", { class: "muted" }, "Nouvelle autorisation : si c'est la première fois, reconnecte ce compte dans l'onglet Comptes pour l'activer.")));
  }

  // Texte propre à ce réseau : il se modifie dans l'onglet du réseau, au-dessus du texte.
  body.push(h("button", { type: "button", class: "linklike", onclick: () => {
    state.textTab = a.id;
    renderTextTabs();
    $("#text-tabs").scrollIntoView({ behavior: "smooth", block: "center" });
  } }, state.overrides[a.id] ? "✏️ Texte de ce réseau" : "✏️ Texte de ce réseau"));

  return h("article", { class: "tcard", "data-id": a.id, style: `--c:${PROVIDER[a.provider]?.color}` }, head, ...body);
}

function paintCardStatus() {
  document.querySelectorAll(".tcard").forEach((card) => {
    const err = state.errors[card.dataset.id];
    const s = card.querySelector(".tstatus");
    s.className = `tstatus ${err ? "bad" : "ok"}`;
    s.textContent = err ? err : "Prêt";
    card.classList.toggle("has-error", !!err);
  });
}

let validateTimer;
function scheduleValidation() {
  clearTimeout(validateTimer);
  validateTimer = setTimeout(async () => {
    const body = payload("schedule");
    if (!body.accountIds.length) return $("#validation").replaceChildren();
    try {
      const { errors } = await api("/validate", { method: "POST", body: JSON.stringify(body) });
      renderErrors(errors);
    } catch {}
  }, 300);
}

function renderErrors(errors = {}) {
  state.errors = errors;
  paintCardStatus();
  const items = Object.entries(errors).map(([id, msg]) => {
    const a = state.accounts.find((x) => x.id === Number(id));
    return h("li", {}, a ? `${a.name} — ` : "", msg);
  });
  $("#validation").replaceChildren(...(items.length ? [h("ul", { class: "error" }, ...items)] : []));
}

function renderMedia() {
  const btnMusic = document.getElementById("btn-music");
  if (btnMusic) btnMusic.hidden = !state.media.some((m) => m.kind === "image" && m.mime !== "image/gif");
  $("#media-list").replaceChildren(
    ...state.media.map((m, i) =>
      h(
        "div",
        { class: "media-item" },
        m.kind === "video"
          ? h("video", { src: m.url, muted: true, preload: "metadata" })
          : h("img", { src: m.url, alt: m.filename }),
        h("div", { class: "media-meta" }, h("span", { title: m.filename }, m.filename), h("small", {}, fmtSize(m.size))),
        h(
          "div",
          { class: "media-actions" },
          h("button", { class: "btn ghost small", title: "Avancer", disabled: i === 0, onclick: () => moveMedia(i, -1) }, "←"),
          h("button", { class: "btn ghost small", title: "Reculer", disabled: i === state.media.length - 1, onclick: () => moveMedia(i, 1) }, "→"),
          m.kind === "image" && m.mime !== "image/gif" ? h("button", { class: "btn ghost small", title: "Recadrer", "aria-label": "Recadrer", onclick: () => openCrop(i) }, "✂") : null,
          h("button", { class: "btn ghost small danger", title: "Retirer", onclick: () => { const [m] = state.media.splice(i, 1); renderMedia(); forgetMedia([m]); } }, "✕"),
        ),
      ),
    ),
    ...(state.uploading ? [h("div", { class: "media-item uploading" }, h("progress", { id: "upload-progress", max: 100 }), h("small", {}, "Envoi…"))] : []),
  );
  renderComposeMeta();
}

function moveMedia(i, d) {
  const [m] = state.media.splice(i, 1);
  state.media.splice(i + d, 0, m);
  renderMedia();
}

function upload(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/media?filename=${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-Requested-With", "multiposter");
    xhr.upload.onprogress = (e) => {
      const p = document.getElementById("upload-progress");
      if (p && e.lengthComputable) p.value = (e.loaded / e.total) * 100;
    };
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || "{}");
      xhr.status < 300 ? resolve(data) : reject(new Error(data.error || `Erreur ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Connexion perdue pendant l'envoi"));
    xhr.send(file);
  });
}

async function addFiles(files) {
  for (const f of files) {
    state.uploading++;
    renderMedia();
    try {
      state.media.push(await upload(f));
    } catch (e) {
      toast(`${f.name} : ${e.message}`, "err");
    } finally {
      state.uploading--;
      renderMedia();
    }
  }
}

function payload(action) {
  const when = $("#when").value;
  return {
    action,
    text: $("#text").value,
    title: $("#title").value,
    mediaIds: state.media.map((m) => m.id),
    accountIds: [...state.selected],
    overrides: state.overrides,
    options: Object.fromEntries(
      [...state.selected].map((id) => {
        const { _manual, ...o } = state.targetOptions[id] ?? {};
        return [id, o];
      }),
    ),
    scheduledAt: when ? new Date(when).getTime() : null,
  };
}

async function submit(action) {
  if (state.uploading) return toast("Attends la fin de l'envoi des médias.", "err");
  if (action === "now" && !confirm("Publier tout de suite sur les comptes sélectionnés ?")) return;
  try {
    const body = JSON.stringify(payload(action));
    const r = state.editingId ? await api(`/posts/${state.editingId}`, { method: "PUT", body }) : await api("/posts", { method: "POST", body });
    const owner = selectedAccounts().find((a) => a.shared)?.shared.ownerName;
    toast(action === "draft" ? "Brouillon enregistré." : r.review ? `Proposé à ${owner ?? "la personne qui t'a partagé le profil"} : il ou elle va le valider.` : action === "now" ? "Publication lancée !" : "Post programmé !");
    resetCompose();
    state.filter = action === "draft" ? "draft" : r?.review ? "review" : "upcoming";
    location.hash = "#queue";
  } catch (e) {
    if (e.data?.errors) renderErrors(e.data.errors);
    toast(e.message, "err");
  }
}

/** Supprime du serveur les médias retirés (le serveur garde ceux encore utilisés par un post enregistré). */
function forgetMedia(list) {
  for (const m of list) api(`/media/${encodeURIComponent(m.id)}`, { method: "DELETE" }).catch(() => {});
}

function resetCompose() {
  state.editingId = null;
  state.textTab = "all";
  state.selected = new Set();
  state.overrides = {};
  state.targetOptions = {};
  state.errors = {};
  state.media = [];
  cardsKey = "";
  $("#text").value = "";
  $("#title").value = "";
  $("#when").value = toLocalInput(Date.now() + 3600e3);
  $("#compose-title").textContent = "Nouveau post";
  renderPicker();
  renderMedia();
  renderComposeMeta();
}

function editPost(p) {
  resetCompose();
  state.editingId = ["draft", "scheduled", "review"].includes(p.status) ? p.id : null;
  $("#compose-title").textContent = state.editingId ? "Modifier le post" : "Nouveau post (copie)";
  $("#text").value = p.text;
  $("#title").value = p.title;
  state.media = p.media;
  for (const t of p.targets) {
    if (!state.accounts.some((a) => a.id === t.accountId)) continue;
    state.selected.add(t.accountId);
    if (t.textOverride) state.overrides[t.accountId] = t.textOverride;
    if (t.options && Object.keys(t.options).length) state.targetOptions[t.accountId] = { ...t.options, _manual: !!t.options.media };
  }
  if (p.scheduledAt && p.scheduledAt > Date.now()) $("#when").value = toLocalInput(p.scheduledAt);
  renderPicker();
  renderMedia();
  renderComposeMeta();
  location.hash = "#compose";
}

// ---------- planning ----------

let pollTimer;
async function loadPosts() {
  state.posts = await api("/posts");
  updateDraftIndicators();
  if (!$("#view-queue").hidden) renderQueue();
  clearTimeout(pollTimer);
  if (state.posts.some((p) => p.status === "publishing" || (p.status === "scheduled" && p.scheduledAt < Date.now() + 60e3))) {
    pollTimer = setTimeout(() => !$("#view-queue").hidden && loadPosts(), 5000);
  }
}

const norm = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const drafts = () => state.posts.filter((p) => p.status === "draft");

/** Compteurs et rappel des brouillons pas encore programmés (dont ceux oubliés les jours précédents). */
function updateDraftIndicators() {
  const all = drafts();
  const old = all.filter((p) => p.createdAt < startOfToday());
  const badge = $("#draft-badge");
  badge.hidden = !all.length;
  badge.textContent = String(all.length);
  badge.classList.toggle("warn", old.length > 0);
  badge.title = old.length ? `${all.length} brouillon(s), dont ${old.length} des jours précédents` : `${all.length} brouillon(s)`;
  $("#draft-count").textContent = all.length ? String(all.length) : "";
  const banner = $("#draft-banner");
  if (!old.length || state.filter === "draft") return banner.replaceChildren();
  banner.replaceChildren(
    h("div", { class: "banner" },
      h("span", {}, `${old.length} brouillon${old.length > 1 ? "s" : ""} des jours précédents ${old.length > 1 ? "n'ont" : "n'a"} pas encore été programmé${old.length > 1 ? "s" : ""}.`),
      h("button", { class: "btn ghost small", type: "button", onclick: () => { state.mode = "list"; state.filter = "draft"; renderQueue(); } }, "Les voir")),
  );
}

/** Compte à rebours avant la suppression automatique d'un brouillon (mis à jour chaque minute). */
function expiryText(at) {
  const left = at - Date.now();
  if (left <= 0) return "Sera supprimé dans les prochaines minutes";
  const min = Math.ceil(left / 60e3);
  if (min < 60) return `Supprimé dans ${min} min`;
  if (left < 86400e3) {
    const hh = Math.floor(min / 60), mm = min % 60;
    return `Supprimé dans ${hh} h${mm ? ` ${String(mm).padStart(2, "0")} min` : ""}`;
  }
  const days = Math.max(1, Math.round(left / 86400e3));
  return `Supprimé dans ${days} jour${days > 1 ? "s" : ""}`;
}
function expiryLabel(at) {
  const el = h("span", { class: "expiry small", title: "Sans modification ni programmation, ce brouillon et ses médias seront supprimés. L'ouvrir et l'enregistrer remet le compteur à zéro." });
  el.dataset.at = String(at);
  updateExpiry(el);
  return el;
}
function updateExpiry(el) {
  const at = Number(el.dataset.at);
  const left = at - Date.now();
  el.textContent = `⏳ ${expiryText(at)}`;
  el.classList.toggle("soon", left < 86400e3);
  el.classList.toggle("urgent", left < 3 * 3600e3);
}
setInterval(() => document.querySelectorAll(".expiry[data-at]").forEach(updateExpiry), 60e3);

function dayLabel(ms) {
  const d = new Date(ms); d.setHours(0, 0, 0, 0);
  const diff = Math.round((startOfToday() - d.getTime()) / 86400e3);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(ms);
}

function filtered() {
  const f = state.filter;
  const q = norm(state.search);
  const ps = profilePosts().filter((p) =>
    (!q || norm(`${p.text} ${p.title} ${p.source ?? ""} ${p.targets.map((t) => t.name).join(" ")}`).includes(q)) && (
    f === "all" ? true
      : f === "upcoming" ? p.status === "scheduled" || p.status === "publishing"
      : f === "failed" ? p.status === "failed" || p.status === "partial"
      : p.status === f),
  );
  if (f === "upcoming") return ps.sort((a, b) => a.scheduledAt - b.scheduledAt);
  if (f === "draft") return ps.sort((a, b) => b.createdAt - a.createdAt);
  return ps;
}

function renderQueue() {
  let qTimer;
  $("#queue-search").addEventListener("input", (e) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      if (state.search && state.mode === "calendar") state.mode = "list";
      if (state.search && state.filter === "upcoming") state.filter = "all";
      renderQueue();
    }, 200);
  });

  document.querySelectorAll(".segmented .seg").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));
  $("#filters").hidden = state.mode === "calendar";
  if (state.mode === "calendar") return renderCalendar();
  document.querySelectorAll("#filters .chip").forEach((c) => c.classList.toggle("active", c.dataset.filter === state.filter));
  const nReview = state.posts.filter((x) => x.status === "review").length;
  $('[data-filter="review"]').hidden = !nReview && state.filter !== "review";
  $("#review-count").textContent = nReview ? String(nReview) : "";
  updateDraftIndicators();
  const posts = filtered();
  if (!posts.length) {
    return $("#queue").replaceChildren(h("p", { class: "muted" },
      state.search ? `Aucun post ne correspond à « ${state.search} ».` : state.filter === "draft" ? "Aucun brouillon en attente." : "Rien ici pour l'instant."));
  }

  const groups = new Map();
  for (const p of posts) {
    // Les brouillons sont rangés par jour de création, pour retrouver ceux des jours passés.
    const key = state.filter === "draft" || (!p.scheduledAt && p.status === "draft")
      ? `Brouillons · ${dayLabel(p.createdAt)}`
      : p.scheduledAt ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(p.scheduledAt) : "Sans date";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  void renderTopStats();
  const pickable = state.filter === "draft";
  $("#queue").replaceChildren(
    pickable ? batchToolbar(posts.filter((p) => p.status === "draft")) : null,
    ...[...groups].map(([day, ps]) => h("div", { class: "day" }, h("h3", {}, day), ...ps.map((p) => {
      const card = postCard(p);
      if (pickable && p.status === "draft") card.prepend(batchPick(p));
      return card;
    }))),
  );
}

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function composeOn(day) {
  resetCompose();
  const d = new Date(day);
  d.setHours(18, 0, 0, 0);
  $("#when").value = toLocalInput(d.getTime() > Date.now() ? d.getTime() : Date.now() + 3600e3);
  location.hash = "#compose";
}

function openFromCalendar(p) {
  if (p.status === "draft" || p.status === "scheduled") return editPost(p);
  state.mode = "list";
  state.filter = "all";
  renderQueue();
  requestAnimationFrame(() => document.getElementById(`post-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
}

function renderCalendar() {
  const first = state.month;
  const year = first.getFullYear(), month = first.getMonth();
  const start = new Date(year, month, 1 - ((first.getDay() + 6) % 7)); // lundi de la 1re semaine
  const byDay = new Map();
  for (const p of profilePosts()) {
    const when = p.scheduledAt ?? (p.status === "draft" ? p.createdAt : null);
    if (!when) continue;
    const k = dayKey(new Date(when));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(p);
  }
  const draftCount = drafts().length;
  const today = dayKey(new Date());
  const monthLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(first);
  const move = (n) => {
    state.month = new Date(year, month + n, 1);
    renderCalendar();
  };

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (i === 35 && d.getMonth() !== month) break; // 5 semaines suffisent
    const at = (p) => p.scheduledAt ?? p.createdAt;
    const posts = (byDay.get(dayKey(d)) ?? []).sort((a, b) => at(a) - at(b));
    cells.push(
      h("div", { class: `cal-day ${d.getMonth() !== month ? "out" : ""} ${dayKey(d) === today ? "today" : ""}`,
        ondragover: (e) => { if (e.dataTransfer.types.includes("text/ptz-post")) { e.preventDefault(); e.currentTarget.classList.add("drop"); } },
        ondragleave: (e) => e.currentTarget.classList.remove("drop"),
        ondrop: async (e) => {
          e.preventDefault();
          e.currentTarget.classList.remove("drop");
          const p = state.posts.find((x) => x.id === Number(e.dataTransfer.getData("text/ptz-post")));
          if (!p) return;
          const old = new Date(p.scheduledAt);
          const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), old.getHours(), old.getMinutes()).getTime();
          if (dayKey(old) === dayKey(d)) return;
          try {
            await api(`/posts/${p.id}/reschedule`, { method: "POST", body: JSON.stringify({ scheduledAt: t }) });
            toast(`Déplacé au ${new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à ${fmtTime(t)}.`);
            loadPosts();
          } catch (err) { toast(err.message, "err"); }
        } },
        h("div", { class: "cal-day-head" },
          h("span", { class: "cal-num" }, String(d.getDate())),
          h("button", { class: "cal-add", type: "button", title: "Nouveau post ce jour-là", "aria-label": `Nouveau post le ${d.toLocaleDateString("fr-FR")}`, onclick: () => composeOn(d) }, "+")),
        ...posts.map((p) =>
          h("button", { class: `cal-post status-${p.status}`, type: "button", title: p.status === "scheduled" ? `${p.text.slice(0, 200)}\n\n(glisse-le sur un autre jour pour le déplacer)` : p.text.slice(0, 200), onclick: () => openFromCalendar(p),
            draggable: p.status === "scheduled" ? "true" : null,
            ondragstart: (e) => { e.dataTransfer.setData("text/ptz-post", String(p.id)); e.dataTransfer.effectAllowed = "move"; e.currentTarget.classList.add("dragging"); },
            ondragend: (e) => e.currentTarget.classList.remove("dragging") },
            h("span", { class: "cal-time" }, p.scheduledAt ? fmtTime(p.scheduledAt) : "Brouillon"),
            h("span", { class: "cal-dots" }, ...[...new Set(p.targets.map((t) => t.provider))].map((pr) =>
              h("i", { style: `--c:${PROVIDER[pr]?.color ?? "#888"}`, title: PROVIDER[pr]?.label }))),
            h("span", { class: "cal-text" }, p.title || p.source || p.text.split("\n")[0] || "(sans texte)")),
        ),
      ),
    );
  }

  $("#queue").replaceChildren(
    h("div", { class: "cal-bar" },
      h("button", { class: "btn ghost small", type: "button", onclick: () => move(-1), "aria-label": "Mois précédent" }, "←"),
      h("strong", { class: "cal-month" }, monthLabel),
      h("button", { class: "btn ghost small", type: "button", onclick: () => move(1), "aria-label": "Mois suivant" }, "→"),
      h("button", { class: "btn ghost small", type: "button", onclick: () => { const n = new Date(); state.month = new Date(n.getFullYear(), n.getMonth(), 1); renderCalendar(); } }, "Aujourd'hui"),
      draftCount ? h("button", { class: "chip", type: "button", onclick: () => { state.mode = "list"; state.filter = "draft"; renderQueue(); } }, `${draftCount} brouillon${draftCount > 1 ? "s" : ""} à programmer`) : null,
    ),
    h("div", { class: "cal-scroll" },
      h("div", { class: "cal" },
        ...["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map((w) => h("div", { class: "cal-wd" }, w)),
        ...cells)),
  );
}

const fmtNum = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".0", "")} M` : n >= 1e4 ? `${Math.round(n / 1e3)} k` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(".0", "")} k` : String(n));
function statsLine(s, at) {
  const bits = [["views", "👁", "vues"], ["likes", "❤", "j'aime"], ["comments", "💬", "commentaires"], ["shares", "↻", "partages"]]
    .filter(([k]) => s[k] != null).map(([k, icon, label]) => h("span", { title: `${s[k]} ${label}` }, `${icon} ${fmtNum(s[k])}`));
  return bits.length ? h("span", { class: "stats-line", title: at ? `Mis à jour ${relTime(at)}` : "" }, ...bits) : null;
}

async function renderTopStats() {
  const box = $("#stats-top");
  if (!box) return;
  if (state.filter !== "done" || state.mode !== "list") return box.replaceChildren();
  let r;
  try { r = await api("/stats/top?days=30"); } catch { return; }
  if (!r.top.length) return box.replaceChildren(h("p", { class: "muted small" }, "📊 Les statistiques apparaissent quelques heures après publication (vues, j'aime, commentaires)."));
  box.replaceChildren(h("div", { class: "card stats-card" },
    h("div", { class: "card-title" }, h("strong", {}, "📊 30 derniers jours"), helpQ("planning")),
    h("div", { class: "stats-total" },
      ...[["views", "vues"], ["likes", "j'aime"], ["comments", "commentaires"], ["shares", "partages"]].map(([k, l]) => h("div", {}, h("strong", {}, fmtNum(r.total[k])), h("small", { class: "muted" }, l))),
      h("div", {}, h("strong", {}, String(r.total.posts)), h("small", { class: "muted" }, "posts"))),
    h("ol", { class: "stats-top" }, ...r.top.slice(0, 5).map((p) => h("li", {},
      h("button", { type: "button", class: "linklike", onclick: () => document.getElementById(`post-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }) }, p.label),
      h("span", { class: "stats-line" }, ...[...new Set(p.providers)].map((pr) => netIcon(pr)), statsLine(p)))))));
}

/** Fil de commentaires internes d'un post (entre le propriétaire du profil et l'auteur). */
function commentButton(p) {
  const btn = h("button", { class: "btn ghost small", type: "button" }, `💬 ${p.comments || ""}`.trim());
  btn.onclick = async () => {
    const card = btn.closest(".post");
    let box = card.querySelector(".comments");
    if (box) return box.remove();
    box = h("div", { class: "comments" }, h("p", { class: "muted small" }, "Chargement…"));
    card.append(box);
    const paint = async () => {
      const list = await api(`/posts/${p.id}/comments`).catch(() => []);
      const input = h("textarea", { rows: 2, placeholder: "Écrire un commentaire (seules vous deux le voyez)…", maxlength: 2000 });
      const send = h("button", { class: "btn primary small", type: "button" }, "Envoyer");
      send.onclick = async () => {
        if (!input.value.trim()) return;
        send.disabled = true;
        try { await api(`/posts/${p.id}/comments`, { method: "POST", body: JSON.stringify({ text: input.value }) }); await paint(); }
        catch (e) { toast(e.message, "err"); send.disabled = false; }
      };
      box.replaceChildren(
        ...list.map((c) => h("div", { class: `comment${c.mine ? " mine" : ""}` }, h("strong", {}, c.author), h("small", { class: "muted" }, ` · ${relTime(c.at)}`), h("p", {}, c.text))),
        list.length ? null : h("p", { class: "muted small" }, "Pas encore de commentaire."),
        input, h("div", { class: "row" }, send));
    };
    paint();
  };
  return btn;
}

function postCard(p) {
  const act = async (fn, okMsg) => {
    try {
      await fn();
      if (okMsg) toast(okMsg);
      loadPosts();
    } catch (e) {
      toast(e.message, "err");
    }
  };
  return h(
    "article",
    { class: `card post status-${p.status}`, id: `post-${p.id}` },
    h(
      "header",
      {},
      p.status === "draft" && !p.scheduledAt
        ? h("span", { class: `time draft-age ${p.createdAt < startOfToday() ? "old" : ""}` }, `Brouillon créé ${relTime(p.createdAt)}`)
        : h("span", { class: "time" }, p.scheduledAt ? fmtTime(p.scheduledAt) : "—"),
      h("span", { class: `status ${p.status}` }, STATUS[p.status] ?? p.status),
    ),
    p.authorName && p.ownerId === state.me?.id ? h("span", { class: "share-badge" }, `📝 Proposé par ${p.authorName}`) : null,
    p.ownerName ? h("span", { class: "share-badge" }, `↗ Pour le profil de ${p.ownerName}${p.status === "review" ? " · en attente de validation" : ""}`) : null,
    p.source ? h("span", { class: "source" }, p.source) : null,
    p.title ? h("strong", {}, p.title) : null,
    h("p", { class: "post-text" }, p.text || h("em", { class: "muted" }, "(sans texte)")),
    p.media.length
      ? h("div", { class: "thumbs" }, ...p.media.map((m) => (m.kind === "video" ? h("video", { src: m.url, muted: true, preload: "metadata" }) : h("img", { src: m.url, alt: "" }))))
      : null,
    h(
      "ul",
      { class: "targets" },
      ...p.targets.map((t) =>
        h(
          "li",
          {},
          badge(t.provider),
          h("span", {}, t.name),
          h("span", { class: `status ${t.status}` }, STATUS[t.status] ?? t.status),
          t.url ? h("a", { href: t.url, target: "_blank", rel: "noopener" }, "Voir ↗") : null,
          t.stats ? statsLine(t.stats, t.statsAt) : null,
          t.provider === "instagram" && (t.status === "pending" || t.status === "failed")
            ? h("button", { class: "btn ghost small ig-finish-btn", type: "button", onclick: () => finishInInstagram({
                media: (t.options?.media ? p.media.filter((m) => t.options.media.includes(m.id)) : p.media),
                caption: t.textOverride ?? p.text,
                onPublished: async () => {
                  await api(`/posts/${p.id}/targets/${t.id}/manual`, { method: "POST" });
                  toast("Instagram marqué comme publié : il ne sera pas republié.");
                  loadPosts?.();
                },
              }) }, "📲 Finir dans Instagram")
            : null,
          t.error ? h("p", { class: "error small" }, t.error) : null,
        ),
      ),
    ),
    h(
      "footer",
      {},
      p.status === "draft" && p.updatedAt && state.meta?.retention
        ? expiryLabel(p.updatedAt + state.meta.retention.draftDays * 86400e3)
        : null,
      p.status === "review" && p.ownerId === state.me?.id
        ? h("button", { class: "btn primary small", onclick: () => act(() => api(`/posts/${p.id}/approve`, { method: "POST" }), p.scheduledAt && p.scheduledAt > Date.now() + 60e3 ? "Validé : programmé." : "Validé : publication lancée.") }, "✅ Valider")
        : null,
      p.status === "review" && p.ownerId === state.me?.id
        ? h("button", { class: "btn ghost small", onclick: () => {
            const comment = prompt(`Que faut-il modifier ? (${p.authorName} recevra ton message)`);
            if (comment == null) return;
            act(() => api(`/posts/${p.id}/request-changes`, { method: "POST", body: JSON.stringify({ comment }) }), "Renvoyé pour modification.");
          } }, "↩ À revoir")
        : null,
      p.status === "draft"
        ? h("button", { class: "btn primary small", onclick: () => editPost(p) }, p.ownerName ? "Modifier" : "Programmer")
        : p.status === "scheduled" && !p.ownerName || p.status === "review" ? h("button", { class: "btn ghost small", onclick: () => editPost(p) }, "Modifier") : null,
      p.authorId || p.comments ? commentButton(p) : null,
      p.status === "failed" || p.status === "partial"
        ? h("button", { class: "btn primary small", onclick: () => act(() => api(`/posts/${p.id}/retry`, { method: "POST" }), "Nouvel essai lancé.") }, "Réessayer les échecs")
        : null,
      p.targets.some((t) => t.status === "done")
        ? h("button", { class: "btn ghost small", title: "Actualiser les statistiques", onclick: () => act(() => api(`/posts/${p.id}/stats`, { method: "POST" }), "Statistiques actualisées.") }, "📊 Actualiser")
        : null,
      h("button", {
        class: "btn ghost small",
        onclick: () => act(async () => {
          const { id } = await api(`/posts/${p.id}/duplicate`, { method: "POST" });
          const posts = await api("/posts");
          const copy = posts.find((x) => x.id === id);
          if (copy) editPost(copy);
        }),
      }, "Dupliquer"),
      p.status !== "publishing"
        ? h("button", {
            class: "btn ghost small danger",
            onclick: () => confirm("Supprimer ce post de l'app ? (Ce qui est déjà publié reste en ligne.)") && act(() => api(`/posts/${p.id}`, { method: "DELETE" }), "Post supprimé."),
          }, "Supprimer")
        : null,
    ),
  );
}

// ---------- Photo / vidéo prises depuis l'app ----------

const isTouch = () => matchMedia("(pointer: coarse)").matches;
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
let camStream = null;
let recorder = null;
let recTimer = null;

function stopCamera() {
  if (recorder && recorder.state !== "inactive") recorder.stop();
  camStream?.getTracks().forEach((t) => t.stop());
  camStream = null;
  clearInterval(recTimer);
}

async function startCamera(mode, deviceId) {
  stopCamera();
  const status = $("#camera-status");
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: mode === "video",
    });
  } catch (e) {
    status.textContent = e.name === "NotAllowedError"
      ? "Accès à la caméra refusé : autorise-le dans les réglages du navigateur (icône à gauche de l'adresse), puis réessaie."
      : `Caméra indisponible : ${e.message}`;
    return;
  }
  $("#camera-preview").srcObject = camStream;
  status.textContent = mode === "photo" ? "Cadre ta photo, puis clique sur « Prendre la photo »." : "Clique sur « Démarrer l'enregistrement ».";
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  const sel = $("#camera-device");
  sel.hidden = cams.length < 2;
  sel.replaceChildren(...cams.map((d, i) => h("option", { value: d.deviceId }, d.label || `Caméra ${i + 1}`)));
  const current = camStream.getVideoTracks()[0]?.getSettings().deviceId;
  if (current) sel.value = current;
}

async function openCamera(mode) {
  // Sur téléphone : l'appareil photo du système, plus simple et de meilleure qualité.
  if (isTouch()) return $(mode === "photo" ? "#capture-photo" : "#capture-video").click();
  if (!navigator.mediaDevices?.getUserMedia) return toast("Ce navigateur ne permet pas d'utiliser la caméra.", "err");
  const dlg = $("#camera-dialog");
  dlg.dataset.mode = mode;
  $("#camera-title").textContent = mode === "photo" ? "Prendre une photo" : "Filmer une vidéo";
  $("#camera-shoot").hidden = mode !== "photo";
  $("#camera-record").hidden = mode !== "video";
  $("#camera-record").textContent = "● Démarrer l'enregistrement";
  dlg.showModal();
  await startCamera(mode);
}

function takePhoto() {
  const v = $("#camera-preview");
  if (!v.videoWidth) return;
  const cv = document.createElement("canvas");
  cv.width = v.videoWidth;
  cv.height = v.videoHeight;
  cv.getContext("2d").drawImage(v, 0, 0);
  cv.toBlob((blob) => {
    if (!blob) return toast("Photo impossible, réessaie.", "err");
    $("#camera-dialog").close();
    addFiles([new File([blob], `photo-${stamp()}.jpg`, { type: "image/jpeg" })]);
  }, "image/jpeg", 0.92);
}

function toggleRecording() {
  const btn = $("#camera-record");
  if (recorder && recorder.state === "recording") return recorder.stop();
  if (!camStream) return;
  // MP4 si le navigateur sait le produire (accepté partout), sinon WebM (YouTube, TikTok, Facebook).
  const type = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const chunks = [];
  recorder = new MediaRecorder(camStream, type ? { mimeType: type, videoBitsPerSecond: 6_000_000 } : undefined);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    clearInterval(recTimer);
    const mime = (recorder.mimeType || type || "video/webm").split(";")[0];
    const file = new File([new Blob(chunks, { type: mime })], `video-${stamp()}.${mime === "video/mp4" ? "mp4" : "webm"}`, { type: mime });
    $("#camera-dialog").close();
    if (mime !== "video/mp4") toast("Vidéo enregistrée en WebM : acceptée par YouTube, TikTok et Facebook, pas par Instagram, Threads ni X.");
    addFiles([file]);
  };
  recorder.start(1000);
  const t0 = Date.now();
  btn.textContent = "■ Arrêter (0:00)";
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    btn.textContent = `■ Arrêter (${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})`;
  }, 500);
}

// ---------- Canva ----------

const relTime = (ms) => {
  const min = Math.round((Date.now() - ms) / 60e3);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
};

async function openCanva() {
  if (!state.canva.status) await loadCanvaStatus();
  const s = state.canva.status;
  if (!s.connected) {
    toast(s.configured ? "Connecte d'abord Canva dans l'onglet Comptes." : "Canva n'est pas configuré (voir README).", "err");
    location.hash = "#accounts";
    return;
  }
  $("#canva-dialog").showModal();
  if (!state.canva.items.length) loadDesigns();
}

async function loadDesigns(more = false) {
  const list = $("#canva-list");
  if (!more) list.replaceChildren(h("p", { class: "muted" }, "Chargement de tes designs…"));
  try {
    const q = new URLSearchParams();
    if (state.canva.query) q.set("query", state.canva.query);
    if (more && state.canva.continuation) q.set("continuation", state.canva.continuation);
    const r = await api(`/canva/designs?${q}`);
    state.canva.items = more ? [...state.canva.items, ...r.items] : r.items;
    state.canva.continuation = r.continuation;
    renderDesigns();
  } catch (e) {
    list.replaceChildren(h("p", { class: "error" }, e.message));
  }
}

function renderDesigns() {
  const items = state.canva.items;
  $("#canva-more").hidden = !state.canva.continuation;
  if (!items.length) return $("#canva-list").replaceChildren(h("p", { class: "muted" }, "Aucun design trouvé."));
  $("#canva-list").replaceChildren(
    ...items.map((d) => {
      const fresh = Date.now() - d.updatedAt < 24 * 3600e3;
      const btn = h("button", { class: "btn primary small", type: "button" }, "Importer");
      btn.addEventListener("click", () => importDesign(d, btn));
      return h(
        "article",
        { class: "design" },
        h("div", { class: "design-thumb" },
          d.thumbnail ? h("img", { src: d.thumbnail, alt: "", loading: "lazy", referrerpolicy: "no-referrer" }) : null,
          fresh ? h("span", { class: "fresh" }, "Modifié récemment") : null),
        h("div", { class: "design-body" },
          h("strong", { title: d.title }, d.title),
          h("small", { class: "muted" }, `${relTime(d.updatedAt)}${d.pageCount ? ` · ${d.pageCount} page${d.pageCount > 1 ? "s" : ""}` : ""}`),
          h("div", { class: "row" }, btn,
            d.editUrl ? h("a", { class: "btn ghost small", href: d.editUrl, target: "_blank", rel: "noopener" }, "Ouvrir ↗") : null)),
      );
    }),
  );
}

async function importDesign(d, btn) {
  btn.disabled = true;
  btn.textContent = "Export en cours…";
  try {
    const { media } = await api(`/canva/designs/${encodeURIComponent(d.id)}/import`, {
      method: "POST",
      body: JSON.stringify({ format: $("#canva-format").value, horizontal: !!d.horizontal }),
    });
    state.media.push(...media);
    renderMedia();
    toast(`« ${d.title} » ajouté (${media.length} fichier${media.length > 1 ? "s" : ""}).`);
    $("#canva-dialog").close();
  } catch (e) {
    toast(e.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Importer";
  }
}

// ---------- démarrage ----------

/**
 * Son de connexion : joué une fois, juste après s'être connecté (/?bienvenue=1).
 * Si le navigateur bloque la lecture automatique, il part au premier clic ou à la première touche.
 */
function welcomeSound() {
  const url = new URL(location.href);
  if (!url.searchParams.has("bienvenue")) return;
  url.searchParams.delete("bienvenue");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
  const audio = new Audio("/assets/connexion.mp3");
  audio.volume = 0.8;
  audio.play().catch(() => {
    const go = () => {
      removeEventListener("pointerdown", go, true);
      removeEventListener("keydown", go, true);
      audio.play().catch(() => {});
    };
    addEventListener("pointerdown", go, true);
    addEventListener("keydown", go, true);
  });
}

async function init() {
  welcomeSound();
  paintToolIcons();
  void swRegistration();
  state.meta = await api("/meta");
  state.me = await api("/me").catch(() => null);
  await loadAppSettings();
  await Promise.all([loadCanvaStatus(), loadDriveStatus(), loadHashtags(), loadMentions(), loadPresets()]);
  await loadAccounts();

  $("#btn-canva").onclick = openCanva;
  $("#btn-photo").onclick = () => openCamera("photo");
  $("#btn-video").onclick = () => openCamera("video");
  for (const id of ["#capture-photo", "#capture-video"]) {
    $(id).addEventListener("change", (e) => {
      addFiles([...e.target.files]);
      e.target.value = "";
    });
  }
  $("#camera-close").onclick = () => $("#camera-dialog").close();
  $("#camera-dialog").addEventListener("close", stopCamera);
  $("#camera-shoot").onclick = takePhoto;
  $("#camera-record").onclick = toggleRecording;
  $("#camera-device").addEventListener("change", (e) => startCamera($("#camera-dialog").dataset.mode, e.target.value));
  $("#profile-filter").addEventListener("change", (e) => {
    state.profileFilter = e.target.value;
    renderQueue();
  });
  $("#canva-close").onclick = () => $("#canva-dialog").close();
  $("#share-close").onclick = () => $("#share-dialog").close();
  $("#btn-preview").onclick = openPreview;
  $("#btn-templates").onclick = () => ($("#template-box").hidden ? renderTemplateBox() : ($("#template-box").hidden = true));
  $("#btn-mention").onclick = () => ($("#mention-box").hidden ? renderMentionBox() : ($("#mention-box").hidden = true));
  $("#net-text-custom").onclick = () => {
    const id = state.textTab;
    state.overrides[id] = $("#text").value;
    renderTextTabs();
    $("#net-text").focus();
    renderComposeMeta();
  };
  $("#net-text-reset").onclick = () => {
    if (!confirm("Revenir au texte commun pour ce réseau ? Les modifications propres à ce réseau seront perdues.")) return;
    delete state.overrides[state.textTab];
    renderComposeMeta();
  };
  $("#net-text").addEventListener("input", (e) => {
    if (e.target.readOnly) return;
    state.overrides[state.textTab] = e.target.value;
    renderComposeMeta();
  });
  $("#btn-music").onclick = openMusic;
  $("#music-close").onclick = () => $("#music-dialog").close();
  $("#btn-drive").onclick = openDrive;
  $("#drive-close").onclick = () => $("#drive-dialog").close();
  $("#drive-more").onclick = () => loadDrive(true);
  $("#drive-import").onclick = importDrive;
  for (const b of document.querySelectorAll("[data-drive]")) b.addEventListener("click", () => setDriveMode(b.dataset.drive));
  $("#drive-url-go").onclick = importDriveLink;
  $("#drive-url").addEventListener("keydown", (e) => e.key === "Enter" && importDriveLink());
  $("#drive-connect-link").addEventListener("click", () => $("#drive-dialog").close());
  let driveTimer;
  $("#drive-search").addEventListener("input", (e) => {
    clearTimeout(driveTimer);
    driveTimer = setTimeout(() => { state.drive.query = e.target.value.trim(); loadDrive(); }, 350);
  });
  $("#canva-more").onclick = () => loadDesigns(true);
  let searchTimer;
  $("#canva-search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.canva.query = e.target.value.trim();
      loadDesigns();
    }, 350);
  });

  $("#text").addEventListener("input", renderComposeMeta);
  $("#title").addEventListener("input", scheduleValidation);
  $("#when").value = toLocalInput(Date.now() + 3600e3);
  $("#btn-schedule").onclick = () => submit("schedule");
  $("#btn-now").onclick = () => submit("now");
  $("#btn-draft").onclick = () => submit("draft");
  $("#btn-reset").onclick = () => {
    if (!confirm("Vider le formulaire ?")) return;
    const dropped = state.media.slice();
    resetCompose();
    forgetMedia(dropped);
  };

  document.querySelectorAll("[data-quick]").forEach((b) =>
    b.addEventListener("click", () => {
      const q = b.dataset.quick;
      const d = new Date();
      if (q === "60") d.setTime(Date.now() + 3600e3);
      else {
        d.setDate(d.getDate() + 1);
        d.setHours(q === "tomorrow9" ? 9 : 18, 0, 0, 0);
      }
      $("#when").value = toLocalInput(d.getTime());
    }),
  );

  const dz = $("#dropzone");
  const input = $("#file");
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && input.click());
  input.addEventListener("change", () => {
    addFiles([...input.files]);
    input.value = "";
  });
  dz.addEventListener("dragover", (e) => {
    e.preventDefault();
    dz.classList.add("over");
  });
  dz.addEventListener("dragleave", () => dz.classList.remove("over"));
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("over");
    addFiles([...e.dataTransfer.files]);
  });

  document.querySelectorAll(".segmented .seg").forEach((b) =>
    b.addEventListener("click", () => {
      state.mode = b.dataset.mode;
      renderQueue();
    }),
  );

  document.querySelectorAll("#filters .chip").forEach((c) =>
    c.addEventListener("click", () => {
      state.filter = c.dataset.filter;
      renderQueue();
    }),
  );

  renderComposeMeta();
  route();
  // Charge le planning tout de suite pour afficher le compteur de brouillons dans le menu.
  loadPosts().catch(() => {});
  setInterval(() => loadPosts().catch(() => {}), 5 * 60_000);
}

init().catch((e) => toast(e.message, "err"));
