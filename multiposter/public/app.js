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
  mode: "list",
  month: (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })(),
  editingId: null,
  selected: new Set(),
  overrides: {},
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
  if (view === "accounts") loadAccounts();
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
  const pattern = h("input", { id: "rule-pattern", placeholder: "Mot du titre, ex. NEWZ", maxlength: 100 });
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
      "Quand un design dont le titre contient ce mot est modifié (par toi ou ta tâche planifiée), l'app l'exporte et prépare un brouillon. Un brouillon par design et par jour : celui de la veille garde ses images, même quand le design est réécrit le lendemain."),
    rules.length
      ? h("ul", { class: "rule-list" },
          ...rules.map((r) => {
            const names = r.accountIds.map((id) => state.accounts.find((a) => a.id === id)).filter(Boolean)
              .map((a) => PROVIDER[a.provider]?.label).join(", ");
            return h("li", {},
              h("span", {}, "Titre contenant ", h("strong", {}, `« ${r.pattern} »`), ` → ${names || "aucun compte"} · ${FORMAT_LABEL[r.format]}`),
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
  document.querySelectorAll(".segmented .seg").forEach((b) => b.classList.toggle("active", b.dataset.mode === state.mode));
  $("#filters").hidden = state.mode === "calendar";
  if (state.mode === "calendar") return renderCalendar();
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
    if (!p.scheduledAt) continue;
    const k = dayKey(new Date(p.scheduledAt));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(p);
  }
  const drafts = state.posts.filter((p) => !p.scheduledAt && p.status === "draft").length;
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
    const posts = (byDay.get(dayKey(d)) ?? []).sort((a, b) => a.scheduledAt - b.scheduledAt);
    cells.push(
      h("div", { class: `cal-day ${d.getMonth() !== month ? "out" : ""} ${dayKey(d) === today ? "today" : ""}` },
        h("div", { class: "cal-day-head" },
          h("span", { class: "cal-num" }, String(d.getDate())),
          h("button", { class: "cal-add", type: "button", title: "Nouveau post ce jour-là", "aria-label": `Nouveau post le ${d.toLocaleDateString("fr-FR")}`, onclick: () => composeOn(d) }, "+")),
        ...posts.map((p) =>
          h("button", { class: `cal-post status-${p.status}`, type: "button", title: p.text.slice(0, 200), onclick: () => openFromCalendar(p) },
            h("span", { class: "cal-time" }, fmtTime(p.scheduledAt)),
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
      drafts ? h("button", { class: "chip", type: "button", onclick: () => { state.mode = "list"; state.filter = "draft"; renderQueue(); } }, `${drafts} brouillon${drafts > 1 ? "s" : ""} sans date`) : null,
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
      h("span", { class: "time" }, p.scheduledAt ? fmtTime(p.scheduledAt) : "—"),
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
}

init().catch((e) => toast(e.message, "err"));
