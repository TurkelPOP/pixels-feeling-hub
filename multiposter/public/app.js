// Multiposter — interface (vanilla JS, aucune dépendance).

const PROVIDER = {
  youtube: { label: "YouTube", color: "#ff3b3b" },
  tiktok: { label: "TikTok", color: "#25f4ee" },
  instagram: { label: "Instagram", color: "#e1306c" },
  facebook: { label: "Facebook", color: "#1877f2" },
  threads: { label: "Threads", color: "#cfcfcf" },
  x: { label: "X", color: "#f5f5f5" },
};
const STATUS = {
  draft: "Brouillon",
  scheduled: "Programmé",
  publishing: "Publication…",
  done: "Publié",
  partial: "Partiel",
  failed: "Échec",
  pending: "En attente",
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
  return h("span", { class: "badge", style: `--c:${p.color}` }, p.label);
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
  }
}
window.addEventListener("hashchange", route);

// ---------- comptes ----------

async function loadAccounts() {
  state.accounts = await api("/accounts");
  renderAccounts();
  renderPicker();
}

function canvaCard() {
  const s = state.canva.status;
  return h(
    "div",
    { class: "card flow canva" },
    h("div", {}, h("strong", {}, "Canva"),
      h("p", { class: "muted small" }, "Récupère tes derniers designs (NEWZ, Good News…) directement dans un post, exportés au bon format.")),
    !s?.configured
      ? h("p", { class: "muted small" }, "Non configuré : ajoute CANVA_CLIENT_ID et CANVA_CLIENT_SECRET dans .env (voir README).")
      : s.connected
        ? h("div", { class: "row" },
            h("span", { class: "via" }, `Connecté : ${s.name ?? "Canva"}`),
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
    s?.connected ? rulesBox() : null,
  );
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

function rulesBox() {
  const rules = state.canva.rules ?? [];
  const picked = new Set();
  const pattern = h("input", { id: "rule-pattern", placeholder: "Début du titre, ex. NEWZ ou Good News", maxlength: 100 });
  const format = h("select", { id: "rule-format" },
    h("option", { value: "jpg" }, "JPG"), h("option", { value: "png" }, "PNG"), h("option", { value: "mp4" }, "MP4"));
  const text = h("textarea", { id: "rule-text", rows: 2, placeholder: "Texte de départ (facultatif). {titre} = titre du design, {date} = jour" });
  const chips = h("div", { class: "chips" },
    ...state.accounts.map((a) => {
      const chip = h("button", { type: "button", class: "chip account-chip small-chip", style: `--c:${PROVIDER[a.provider]?.color}` },
        h("span", {}, PROVIDER[a.provider]?.label), h("small", {}, a.name));
      chip.addEventListener("click", () => {
        picked.has(a.id) ? picked.delete(a.id) : picked.add(a.id);
        chip.classList.toggle("active", picked.has(a.id));
      });
      return chip;
    }));
  const reload = async () => {
    await loadCanvaStatus();
    renderAccounts();
  };
  return h(
    "div",
    { class: "rules" },
    h("h3", {}, "Brouillons automatiques"),
    h("p", { class: "muted small" },
      "Quand un design dont le titre commence par ce mot est modifié (par toi ou ta tâche planifiée), l'app l'exporte et prépare un brouillon. Un brouillon par design et par jour : celui de la veille garde ses images, même quand le design est réécrit le lendemain."),
    rules.length
      ? h("ul", { class: "rule-list" },
          ...rules.map((r) => {
            const names = r.accountIds.map((id) => state.accounts.find((a) => a.id === id)).filter(Boolean)
              .map((a) => PROVIDER[a.provider]?.label).join(", ");
            return h("li", {},
              h("span", {}, "Titre commençant par ", h("strong", {}, `« ${r.pattern} »`), ` → ${names || "aucun compte"} · ${FORMAT_LABEL[r.format]}`),
              h("button", {
                class: "btn ghost small danger", type: "button",
                onclick: async () => {
                  if (!confirm(`Supprimer la règle « ${r.pattern} » ?`)) return;
                  await api(`/canva/rules/${r.id}`, { method: "DELETE" });
                  reload();
                },
              }, "Supprimer"));
          }))
      : h("p", { class: "muted small" }, "Aucune règle pour l'instant."),
    h("div", { class: "rule-form" },
      h("div", { class: "row" }, pattern, format),
      chips,
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

async function renderSystem() {
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
      : "Désactivé : l'app ne tourne que quand tu la lances avec « Demarrer Multiposter ».";
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
        h("strong", {}, "Lancer Multiposter au démarrage de Windows")),
      status),
  );
}

function renderAccounts() {
  $("#flows").replaceChildren(
    canvaCard(),
    ...state.meta.flows.map((f) =>
      h(
        "div",
        { class: "card flow" },
        h("div", { class: "flow-head" }, ...f.providers.map(badge)),
        f.configured
          ? h("a", { class: "btn primary small", href: `/oauth/${f.id}/start` }, `Connecter ${f.label}`)
          : h("p", { class: "muted small" }, "Non configuré : renseigne les clés dans .env (voir README)."),
      ),
    ),
  );
  const list = state.accounts.map((a) => {
    const expiring = a.expiresAt && !a.canRefresh && a.expiresAt < Date.now() + 7 * 86400e3;
    return h(
      "div",
      { class: "card account" },
      avatar(a),
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
        avatar(a),
        h("span", {}, a.name),
        h("small", {}, PROVIDER[a.provider]?.label),
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
      const used = accs.filter((a) => a.provider === p).map((a) => state.overrides[a.id] ?? text);
      const n = Math.max(...used.map(countChars));
      const max = maxFor(p);
      return h("span", { class: `counter ${n > max ? "over" : ""}` }, badge(p), ` ${n} / ${max}`);
    }),
  );

  renderTargetCards();
  scheduleValidation();
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
          ? h("button", { type: "button", class: "linklike", onclick: () => { o._manual = false; changed(true); } }, "Revenir à la sélection automatique")
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

  // Texte différent
  const ta = h("textarea", { rows: 3, placeholder: "Laisser vide pour utiliser le texte principal" });
  ta.value = state.overrides[a.id] ?? "";
  ta.addEventListener("input", () => {
    if (ta.value.trim()) state.overrides[a.id] = ta.value;
    else delete state.overrides[a.id];
    renderComposeMeta();
  });
  const details = h("details", { class: "toverride" }, h("summary", {}, "Texte différent pour ce réseau"), ta);
  if (state.overrides[a.id]) details.open = true;
  body.push(details);

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
          h("button", { class: "btn ghost small danger", title: "Retirer", onclick: () => { state.media.splice(i, 1); renderMedia(); } }, "✕"),
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
    if (state.editingId) await api(`/posts/${state.editingId}`, { method: "PUT", body });
    else await api("/posts", { method: "POST", body });
    toast(action === "draft" ? "Brouillon enregistré." : action === "now" ? "Publication lancée !" : "Post programmé !");
    resetCompose();
    state.filter = action === "draft" ? "draft" : "upcoming";
    location.hash = "#queue";
  } catch (e) {
    if (e.data?.errors) renderErrors(e.data.errors);
    toast(e.message, "err");
  }
}

function resetCompose() {
  state.editingId = null;
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
  state.editingId = p.status === "draft" || p.status === "scheduled" ? p.id : null;
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
  const ps = state.posts.filter((p) =>
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
  $("#queue").replaceChildren(
    ...[...groups].map(([day, ps]) => h("div", { class: "day" }, h("h3", {}, day), ...ps.map(postCard))),
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
  for (const p of state.posts) {
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
      h("div", { class: `cal-day ${d.getMonth() !== month ? "out" : ""} ${dayKey(d) === today ? "today" : ""}` },
        h("div", { class: "cal-day-head" },
          h("span", { class: "cal-num" }, String(d.getDate())),
          h("button", { class: "cal-add", type: "button", title: "Nouveau post ce jour-là", "aria-label": `Nouveau post le ${d.toLocaleDateString("fr-FR")}`, onclick: () => composeOn(d) }, "+")),
        ...posts.map((p) =>
          h("button", { class: `cal-post status-${p.status}`, type: "button", title: p.text.slice(0, 200), onclick: () => openFromCalendar(p) },
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
          t.error ? h("p", { class: "error small" }, t.error) : null,
        ),
      ),
    ),
    h(
      "footer",
      {},
      p.status === "draft"
        ? h("button", { class: "btn primary small", onclick: () => editPost(p) }, "Relire et programmer")
        : p.status === "scheduled" ? h("button", { class: "btn ghost small", onclick: () => editPost(p) }, "Modifier") : null,
      p.status === "failed" || p.status === "partial"
        ? h("button", { class: "btn primary small", onclick: () => act(() => api(`/posts/${p.id}/retry`, { method: "POST" }), "Nouvel essai lancé.") }, "Réessayer les échecs")
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

async function init() {
  state.meta = await api("/meta");
  await loadCanvaStatus();
  await loadAccounts();

  $("#btn-canva").onclick = openCanva;
  $("#canva-close").onclick = () => $("#canva-dialog").close();
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
  $("#btn-reset").onclick = () => confirm("Vider le formulaire ?") && resetCompose();

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
