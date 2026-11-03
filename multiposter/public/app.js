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
  editingId: null,
  selected: new Set(),
  overrides: {},
  media: [],
  uploading: 0,
};

// ---------- utilitaires ----------

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
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

function viaTag(a) {
  return a.via === "zernio" ? h("span", { class: "via" }, "via Zernio") : h("span", { class: "via direct" }, "direct");
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
  if (view === "accounts") loadAccounts();
}
window.addEventListener("hashchange", route);

// ---------- comptes ----------

async function loadAccounts() {
  state.accounts = await api("/accounts");
  renderAccounts();
  renderPicker();
}

function zernioCard() {
  const sync = async (btn) => {
    btn.disabled = true;
    btn.textContent = "Import…";
    try {
      const { count } = await api("/zernio/sync", { method: "POST" });
      toast(`${count} compte(s) importé(s) depuis Zernio.`);
      await loadAccounts();
    } catch (e) {
      toast(e.message, "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Importer mes comptes Zernio";
    }
  };
  return h(
    "div",
    { class: "card flow zernio" },
    h("div", {}, h("strong", {}, "Zernio · API unifiée"),
      h("p", { class: "muted small" }, "Connecte tes 6 réseaux une seule fois sur Zernio, sans créer d'app développeur ni passer d'audit TikTok/YouTube.")),
    state.meta.zernio
      ? h("div", { class: "row" },
          h("button", { class: "btn primary small", onclick: (e) => sync(e.currentTarget) }, "Importer mes comptes Zernio"),
          h("a", { class: "btn ghost small", href: "https://zernio.com/dashboard", target: "_blank", rel: "noopener" }, "Ouvrir Zernio ↗"))
      : h("p", { class: "muted small" }, "Non configuré : ajoute ZERNIO_API_KEY dans .env (voir README)."),
  );
}

function renderAccounts() {
  $("#flows").replaceChildren(
    zernioCard(),
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
      h("div", { class: "grow" }, h("strong", {}, a.name), " ", badge(a.provider), " ", viaTag(a),
        expiring ? h("p", { class: "error small" }, "Token bientôt expiré : reconnecte ce compte.") : null,
        a.needsReconnection ? h("p", { class: "error small" }, "Zernio signale que ce compte doit être reconnecté sur zernio.com.") : null),
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
        h("small", {}, PROVIDER[a.provider]?.label, a.via === "zernio" ? " · Zernio" : ""),
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
  $("#title-row").hidden = !accs.some((a) => a.provider === "youtube");

  const providers = [...new Set(accs.map((a) => a.provider))];
  $("#counters").replaceChildren(
    ...providers.map((p) => {
      const used = accs.filter((a) => a.provider === p).map((a) => state.overrides[a.id] ?? text);
      const n = Math.max(...used.map(countChars));
      const max = maxFor(p);
      return h("span", { class: `counter ${n > max ? "over" : ""}` }, badge(p), ` ${n} / ${max}`);
    }),
  );

  // Champs d'adaptation par compte (on garde les valeurs déjà saisies).
  const box = $("#overrides");
  const existing = new Map([...box.querySelectorAll("textarea")].map((t) => [Number(t.dataset.id), t]));
  box.replaceChildren(
    ...accs.map((a) => {
      let ta = existing.get(a.id);
      if (!ta) {
        ta = h("textarea", { rows: 3, "data-id": a.id, placeholder: "Laisser vide pour utiliser le texte principal" });
        ta.value = state.overrides[a.id] ?? "";
        ta.addEventListener("input", () => {
          if (ta.value.trim()) state.overrides[a.id] = ta.value;
          else delete state.overrides[a.id];
          renderComposeMeta();
        });
      }
      return h("div", { class: "override" }, h("label", {}, badge(a.provider), " ", a.name), ta);
    }),
  );
  $("#overrides-box").hidden = accs.length === 0;
  scheduleValidation();
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
  scheduleValidation();
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
  state.media = [];
  $("#text").value = "";
  $("#title").value = "";
  $("#overrides").replaceChildren();
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
  renderQueue();
  clearTimeout(pollTimer);
  if (state.posts.some((p) => p.status === "publishing" || (p.status === "scheduled" && p.scheduledAt < Date.now() + 60e3))) {
    pollTimer = setTimeout(() => !$("#view-queue").hidden && loadPosts(), 5000);
  }
}

function filtered() {
  const f = state.filter;
  const ps = state.posts.filter((p) =>
    f === "all" ? true
      : f === "upcoming" ? p.status === "scheduled" || p.status === "publishing"
      : f === "failed" ? p.status === "failed" || p.status === "partial"
      : p.status === f,
  );
  return f === "upcoming" ? ps.sort((a, b) => a.scheduledAt - b.scheduledAt) : ps;
}

function renderQueue() {
  document.querySelectorAll("#filters .chip").forEach((c) => c.classList.toggle("active", c.dataset.filter === state.filter));
  const posts = filtered();
  if (!posts.length) return $("#queue").replaceChildren(h("p", { class: "muted" }, "Rien ici pour l'instant."));

  const groups = new Map();
  for (const p of posts) {
    const key = p.scheduledAt ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(p.scheduledAt) : "Sans date";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  $("#queue").replaceChildren(
    ...[...groups].map(([day, ps]) => h("div", { class: "day" }, h("h3", {}, day), ...ps.map(postCard))),
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
    { class: `card post status-${p.status}` },
    h(
      "header",
      {},
      h("span", { class: "time" }, p.scheduledAt ? fmtTime(p.scheduledAt) : "—"),
      h("span", { class: `status ${p.status}` }, STATUS[p.status] ?? p.status),
    ),
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
      p.status === "draft" || p.status === "scheduled" ? h("button", { class: "btn ghost small", onclick: () => editPost(p) }, "Modifier") : null,
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

// ---------- démarrage ----------

async function init() {
  state.meta = await api("/meta");
  await loadAccounts();

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

  document.querySelectorAll("#filters .chip").forEach((c) =>
    c.addEventListener("click", () => {
      state.filter = c.dataset.filter;
      renderQueue();
    }),
  );

  renderComposeMeta();
  route();
}

init().catch((e) => toast(e.message, "err"));
