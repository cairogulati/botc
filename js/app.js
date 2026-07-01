let allScripts = [];
let currentScriptFile = null;
let activeScript = null;
let activeScriptJson = null;

const PLAYER_SETUP = {
  5: { townsfolk: 3, outsiders: 0, minions: 1, demon: 1 },
  6: { townsfolk: 3, outsiders: 1, minions: 1, demon: 1 },
  7: { townsfolk: 5, outsiders: 0, minions: 1, demon: 1 },
  8: { townsfolk: 5, outsiders: 1, minions: 1, demon: 1 },
  9: { townsfolk: 5, outsiders: 2, minions: 1, demon: 1 },
  10: { townsfolk: 7, outsiders: 0, minions: 2, demon: 1 },
  11: { townsfolk: 7, outsiders: 1, minions: 2, demon: 1 },
  12: { townsfolk: 7, outsiders: 2, minions: 2, demon: 1 },
  13: { townsfolk: 9, outsiders: 0, minions: 3, demon: 1 },
  14: { townsfolk: 9, outsiders: 1, minions: 3, demon: 1 },
  15: { townsfolk: 9, outsiders: 2, minions: 3, demon: 1 },
};

let selectedPlayers = 10;

function titleFromFilename(name) {
  return name
    .trim()
    .replace(/\.[^/.]+$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function show(id, btn) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".bottom-nav button").forEach((b) => b.classList.remove("active"));
  const navBtn = btn || document.querySelector(`.bottom-nav button[data-page="${id}"]`);
  if (navBtn) navBtn.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSetupStats(container, count) {
  const setup = PLAYER_SETUP[count];
  if (!setup) return;

  container.innerHTML = `
    <div class="setup-stat setup-stat-townsfolk">
      <span class="setup-stat-value">${setup.townsfolk}</span>
      <span class="setup-stat-label">Townsfolk</span>
    </div>
    <div class="setup-stat setup-stat-outsiders">
      <span class="setup-stat-value">${setup.outsiders}</span>
      <span class="setup-stat-label">Outsiders</span>
    </div>
    <div class="setup-stat setup-stat-minions">
      <span class="setup-stat-value">${setup.minions}</span>
      <span class="setup-stat-label">Minions</span>
    </div>
    <div class="setup-stat setup-stat-demon">
      <span class="setup-stat-value">${setup.demon}</span>
      <span class="setup-stat-label">Demon</span>
    </div>
  `;
}

function setPlayerCount(count) {
  if (!PLAYER_SETUP[count]) return;

  selectedPlayers = count;
  try {
    localStorage.setItem("botc-players", String(count));
  } catch {
    /* ignore */
  }

  document.querySelectorAll(".player-picker-btn").forEach((btn) => {
    btn.classList.toggle("active", parseInt(btn.dataset.players, 10) === count);
    btn.setAttribute("aria-pressed", parseInt(btn.dataset.players, 10) === count ? "true" : "false");
  });

  document.querySelectorAll(".setup-stats").forEach((el) => renderSetupStats(el, count));

  document.querySelectorAll(".setup-table tbody tr").forEach((row) => {
    row.classList.toggle("active-row", parseInt(row.dataset.players, 10) === count);
  });

  const countLabel = document.getElementById("json-setup-count");
  if (countLabel) countLabel.textContent = count;
}

function initPlayerSetup() {
  const stored = parseInt(localStorage.getItem("botc-players") || "10", 10);
  selectedPlayers = PLAYER_SETUP[stored] ? stored : 10;

  document.querySelectorAll(".player-picker").forEach((container) => {
    container.innerHTML = "";
    for (let p = 5; p <= 15; p++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "player-picker-btn";
      btn.dataset.players = p;
      btn.textContent = p;
      btn.setAttribute("aria-pressed", "false");
      btn.addEventListener("click", () => setPlayerCount(p));
      container.appendChild(btn);
    }
  });

  document.querySelectorAll(".setup-table tbody tr").forEach((row) => {
    row.addEventListener("click", () => setPlayerCount(parseInt(row.dataset.players, 10)));
  });

  setPlayerCount(selectedPlayers);
}

function switchScriptTab(tab) {
  document.querySelectorAll(".modal-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });
  document.getElementById("modal-sheet").classList.toggle("active", tab === "sheet");
  document.getElementById("modal-json").classList.toggle("active", tab === "json");
}

function showJsonToast(message) {
  const toast = document.getElementById("json-toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2200);
}

function parseScriptJson(data) {
  if (!Array.isArray(data)) return null;

  const meta = data.find((item) => item && typeof item === "object" && item.id === "_meta") || null;
  const roles = data.filter((item) => typeof item === "string");

  return { meta, roles, raw: data };
}

async function fetchScriptJson(script) {
  if (!script.json) return null;
  try {
    const res = await fetch(script.json);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderGrimoirePanel(script, data) {
  const emptyEl = document.getElementById("json-empty");
  const contentEl = document.getElementById("json-content");
  const metaEl = document.getElementById("json-meta");
  const rolesEl = document.getElementById("json-roles");
  const rawEl = document.getElementById("json-raw");
  const copyBtn = document.getElementById("copy-json-btn");
  const label = document.getElementById("json-source-label");

  if (!data) {
    emptyEl.classList.remove("hidden");
    contentEl.classList.add("hidden");
    copyBtn.disabled = true;
    label.textContent = script.json
      ? "Could not load JSON from the repo."
      : "No grimoire JSON for this script yet.";
    return;
  }

  const parsed = parseScriptJson(data);
  if (!parsed) {
    emptyEl.classList.remove("hidden");
    contentEl.classList.add("hidden");
    copyBtn.disabled = true;
    label.textContent = "Invalid JSON — expected a role array with a _meta object.";
    return;
  }

  emptyEl.classList.add("hidden");
  contentEl.classList.remove("hidden");
  copyBtn.disabled = false;

  const { meta, roles } = parsed;
  label.textContent = `${roles.length} role${roles.length === 1 ? "" : "s"} · from GitHub`;

  if (meta) {
    metaEl.innerHTML = `
      <div class="json-meta-grid">
        <div><span class="json-meta-label">Script</span><span class="json-meta-value">${escapeHtml(meta.name || script.title)}</span></div>
        <div><span class="json-meta-label">Author</span><span class="json-meta-value">${escapeHtml(meta.author || "—")}</span></div>
      </div>
    `;
  } else {
    metaEl.innerHTML =
      '<p class="json-pane-lead">No <code>_meta</code> entry. Expected <code>{"id":"_meta","author":"…","name":"…"}</code> as the first item.</p>';
  }

  rolesEl.innerHTML = roles.length
    ? roles
        .map((role, i) => `<li><span class="role-index">${i + 1}</span><code>${escapeHtml(role)}</code></li>`)
        .join("")
    : '<li class="json-pane-lead">No roles listed yet.</li>';

  rawEl.textContent = JSON.stringify(data);
}

async function loadGrimoirePanel(script) {
  activeScriptJson = await fetchScriptJson(script);
  renderGrimoirePanel(script, activeScriptJson);
}

async function openScriptDetail(script, tab = "sheet") {
  activeScript = script;
  const modal = document.getElementById("script-modal");
  const img = document.getElementById("script-image");
  const jsonTab = document.querySelector('.modal-tab[data-tab="json"]');

  document.getElementById("modal-title").textContent = script.title;
  img.src = script.file;
  jsonTab.disabled = !script.json;
  jsonTab.classList.toggle("json-tab-disabled", !script.json);

  await loadGrimoirePanel(script);

  if (tab === "json" && !script.json) tab = "sheet";
  switchScriptTab(tab);
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

function openScript(file, title) {
  const script =
    allScripts.find((s) => s.file === file) ||
    allScripts.find((s) => s.title === title) || {
      title: title || titleFromFilename(file.split("/").pop()),
      file,
      json: null,
      current: false,
    };
  openScriptDetail(script, "sheet");
}

function closeScriptModal() {
  document.getElementById("script-modal").classList.remove("show");
  document.getElementById("script-image").src = "";
  document.body.style.overflow = "";
  activeScript = null;
  activeScriptJson = null;
}

function openCurrentScript() {
  const current = getCurrentScript();
  if (current) openScriptDetail(current, "sheet");
  else if (currentScriptFile) {
    openScript(`scripts/${currentScriptFile}`, titleFromFilename(currentScriptFile));
  }
}

function openCurrentGrimoire() {
  const current = getCurrentScript();
  if (current?.json) openScriptDetail(current, "json");
}

function getCurrentScript() {
  return (
    allScripts.find((s) => s.current) ||
    allScripts.find(
      (s) => s.file.split("/").pop().toLowerCase() === (currentScriptFile || "").toLowerCase()
    )
  );
}

async function copyGrimoireJson() {
  if (!activeScriptJson) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(activeScriptJson));
    showJsonToast("Copied to clipboard");
  } catch {
    showJsonToast("Could not copy");
  }
}

function renderFeatured(script) {
  const titleEl = document.getElementById("currentName");
  const labelEl = document.getElementById("currentScriptLabel");
  const thumbEl = document.getElementById("featured-thumb");
  const openBtn = document.getElementById("open-current-btn");
  const jsonBtn = document.getElementById("open-current-json-btn");

  if (!script) {
    const fallback = currentScriptFile ? titleFromFilename(currentScriptFile) : "No script set";
    titleEl.textContent = fallback;
    labelEl.textContent = fallback;
    thumbEl.innerHTML = '<div class="thumb-placeholder">📜</div>';
    openBtn.disabled = !currentScriptFile;
    if (jsonBtn) {
      jsonBtn.disabled = true;
      jsonBtn.classList.add("btn-disabled");
    }
    return;
  }

  titleEl.textContent = script.title;
  labelEl.textContent = script.title;
  openBtn.disabled = false;

  if (jsonBtn) {
    jsonBtn.disabled = !script.json;
    jsonBtn.classList.toggle("btn-disabled", !script.json);
  }

  const img = document.createElement("img");
  img.alt = script.title;
  img.src = script.file;
  img.onerror = () => {
    thumbEl.innerHTML = '<div class="thumb-placeholder">📜</div>';
  };
  thumbEl.innerHTML = "";
  thumbEl.appendChild(img);
  thumbEl.onclick = () => openScriptDetail(script, "sheet");
}

function renderScriptGrid(scripts) {
  const container = document.getElementById("script-list");
  const empty = document.getElementById("scripts-empty");

  container.innerHTML = "";

  if (!scripts.length) {
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");

  scripts.forEach((script) => {
    const card = document.createElement("article");
    card.className = "script-card" + (script.current ? " current" : "");

    const thumb = document.createElement("div");
    thumb.className = "script-card-thumb";

    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.src = script.file;
    img.onerror = () => {
      thumb.innerHTML = '<div class="thumb-fallback">📜</div>';
    };
    thumb.appendChild(img);
    thumb.addEventListener("click", () => openScriptDetail(script, "sheet"));

    const body = document.createElement("div");
    body.className = "script-card-body";
    body.innerHTML = `
      <h3>${script.title}</h3>
      <div class="script-card-badges">
        ${script.current ? '<span class="badge">Tonight</span>' : ""}
        ${script.json ? '<span class="badge badge-json">JSON</span>' : ""}
      </div>
      <div class="script-card-actions">
        <button type="button" class="script-mini-btn">Sheet</button>
        <button type="button" class="script-mini-btn script-mini-btn-json"${script.json ? "" : " disabled"}>Grimoire</button>
      </div>
    `;

    body.querySelector(".script-mini-btn:not(.script-mini-btn-json)").addEventListener("click", () => {
      openScriptDetail(script, "sheet");
    });
    body.querySelector(".script-mini-btn-json").addEventListener("click", () => {
      if (script.json) openScriptDetail(script, "json");
    });

    card.appendChild(thumb);
    card.appendChild(body);
    container.appendChild(card);
  });
}

function filterScripts(query) {
  const q = query.trim().toLowerCase();
  const filtered = q ? allScripts.filter((s) => s.title.toLowerCase().includes(q)) : allScripts;
  renderScriptGrid(filtered);
}

async function loadCurrentScript() {
  try {
    const res = await fetch("current-script.txt");
    currentScriptFile = (await res.text()).trim();
  } catch {
    currentScriptFile = null;
  }
}

async function loadScripts() {
  await loadCurrentScript();

  try {
    const res = await fetch("data/scripts.json");
    allScripts = await res.json();
  } catch {
    allScripts = [];
  }

  if (currentScriptFile) {
    allScripts = allScripts.map((s) => ({
      ...s,
      current: s.file.split("/").pop().toLowerCase() === currentScriptFile.toLowerCase(),
    }));
  }

  allScripts.sort((a, b) => {
    if (a.current !== b.current) return a.current ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  renderFeatured(getCurrentScript());
  renderScriptGrid(allScripts);

  document.getElementById("script-search").addEventListener("input", (e) => {
    filterScripts(e.target.value);
  });
}

document.getElementById("script-modal").addEventListener("click", (e) => {
  if (e.target.id === "script-modal") closeScriptModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeScriptModal();
});

loadScripts();
initPlayerSetup();
