let allScripts = [];
let currentScriptFiles = [];
let activeScript = null;
let activeScriptJson = null;
let activeGrouped = null;

let characters = {};
let charactersPromise = null;

const TEAM_ORDER = ["townsfolk", "outsider", "minion", "demon", "traveler", "unknown"];
const TEAM_LABELS = {
  townsfolk: "Townsfolk",
  outsider: "Outsiders",
  minion: "Minions",
  demon: "Demon",
  traveler: "Travellers",
  unknown: "Unclassified",
};

// Setup-modifying characters. Deltas apply when the character is in play.
// `outsider` shifts the Townsfolk/Outsider split; `minion` adds extra Minions;
// `outsiderChoice` is a Storyteller choice (we pick one at random);
// `note` is shown to explain; `special` means the standard split can't be auto-applied.
const SETUP_MODIFIERS = {
  baron: { outsider: 2, note: "Baron: +2 Outsiders (−2 Townsfolk)." },
  godfather: { outsiderChoice: [1, -1], note: "Godfather: +1 or −1 Outsider (Storyteller's choice)." },
  fanggu: { outsider: 1, note: "Fang Gu: +1 Outsider." },
  vigormortis: { outsider: -1, note: "Vigormortis: −1 Outsider." },
  balloonist: { note: "Balloonist: +1 Outsider — adjust the split by hand." },
  marionette: { minion: 1, note: "Marionette: +1 Minion (an extra Minion, one fewer Townsfolk)." },
  lilmonsta: { minion: 1, note: "Lil' Monsta: +1 Minion; the Minions babysit the demon token." },
  huntsman: { note: "Huntsman: the Damsel is added to the game." },
  choirboy: { note: "Choirboy: the King must be in play." },
  legion: { special: "Legion: most players are Legion — the standard split doesn't apply." },
  atheist: { special: "Atheist: there may be no evil players — the Storyteller runs a special game." },
  riot: { special: "Riot: all Minions are Riot." },
};

const GAME_DAYS = [3, 6]; // Wednesday, Saturday
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function getGameSchedule(now = new Date()) {
  const day = now.getDay();

  if (GAME_DAYS.includes(day)) {
    return {
      isGameDay: true,
      featuredHeading: "Tonight's Script",
      featuredHeadingPlural: "Tonight's Scripts",
      scriptsLead: "Tonight",
      badge: "Tonight",
      playersHeading: "Players Tonight",
    };
  }

  for (let i = 1; i <= 7; i++) {
    const next = (day + i) % 7;
    if (GAME_DAYS.includes(next)) {
      const name = DAY_NAMES[next];
      const short = DAY_SHORT[next];
      return {
        isGameDay: false,
        daysUntil: i,
        nextDayName: name,
        featuredHeading: `${name}'s Script`,
        featuredHeadingPlural: `${name}'s Scripts`,
        scriptsLead: i === 1 ? "Tomorrow" : `Next up (${short})`,
        badge: short,
        playersHeading: i === 1 ? "Players Tomorrow" : `Players on ${name}`,
      };
    }
  }

  return {
    isGameDay: false,
    featuredHeading: "Upcoming Script",
    featuredHeadingPlural: "Upcoming Scripts",
    scriptsLead: "Upcoming",
    badge: "Next",
    playersHeading: "Players",
  };
}

function applyGameDayLabels(scriptCount = 1) {
  const schedule = getGameSchedule();
  const heading = document.getElementById("featured-script-heading");
  const leadPrefix = document.getElementById("scripts-lead-prefix");
  const playersHeading = document.getElementById("players-heading");

  if (heading) {
    heading.textContent =
      scriptCount > 1 ? schedule.featuredHeadingPlural : schedule.featuredHeading;
  }
  if (leadPrefix) leadPrefix.textContent = schedule.scriptsLead;
  if (playersHeading) playersHeading.textContent = schedule.playersHeading;

  return schedule;
}

function loadCharacters() {
  if (!charactersPromise) {
    charactersPromise = fetch("data/characters.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        characters = d && typeof d === "object" ? d : {};
        return characters;
      })
      .catch(() => {
        characters = {};
        return characters;
      });
  }
  return charactersPromise;
}

function getCharacter(id) {
  const c = characters[id];
  if (c) return { id, name: c.name, team: c.team || "unknown" };
  return {
    id,
    name: id.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()),
    team: "unknown",
  };
}

function groupRoles(roles) {
  const grouped = { townsfolk: [], outsider: [], minion: [], demon: [], traveler: [], unknown: [] };
  roles.forEach((id) => {
    const c = getCharacter(id);
    (grouped[c.team] || grouped.unknown).push(c);
  });
  return grouped;
}

function pickRandom(arr, n) {
  const pool = arr.slice();
  const out = [];
  const take = Math.max(0, Math.min(n, pool.length));
  for (let i = 0; i < take; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

function activatePage(id) {
  const page = document.getElementById(id);
  if (!page || !page.classList.contains("page")) return;

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  page.classList.add("active");
  document.querySelectorAll(".bottom-nav button").forEach((b) => b.classList.remove("active"));
  const navBtn = document.querySelector(`.bottom-nav button[data-page="${id}"]`);
  if (navBtn) navBtn.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function show(id) {
  if (location.hash === `#${id}`) {
    activatePage(id);
  } else {
    location.hash = id;
  }
}

window.addEventListener("hashchange", () => {
  activatePage(location.hash.slice(1) || "home");
});

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

  renderSetupResult(null);
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

  activeGrouped = null;
  renderSetupResult(null);

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

  const grouped = groupRoles(roles);
  activeGrouped = grouped;
  rolesEl.innerHTML = renderGroupedRolesHtml(grouped);

  rawEl.textContent = JSON.stringify(data);
}

function renderGroupedRolesHtml(grouped) {
  const sections = TEAM_ORDER.filter((team) => grouped[team] && grouped[team].length).map((team) => {
    const items = grouped[team]
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => `<li><code>${escapeHtml(c.name)}</code></li>`)
      .join("");
    return `
      <div class="role-group role-group-${team}">
        <div class="role-group-head">
          <span class="role-group-team">${TEAM_LABELS[team]}</span>
          <span class="role-group-count">${grouped[team].length}</span>
        </div>
        <ul class="role-group-list">${items}</ul>
      </div>`;
  });
  return sections.length ? sections.join("") : '<p class="json-pane-lead">No roles listed yet.</p>';
}

function generateSetup(grouped, count) {
  const base = PLAYER_SETUP[count];
  if (!base) return null;

  const notes = [];
  const warnings = [];
  const seenNotes = new Set();
  const addNote = (t) => {
    if (t && !seenNotes.has(t)) {
      seenNotes.add(t);
      notes.push(t);
    }
  };

  let townsfolkN = base.townsfolk;
  let outsiderN = base.outsiders;
  let minionN = base.minions;
  const demonN = base.demon;

  // Draw evil first so setup effects (Baron, Godfather, Fang Gu, …) can shift the split.
  const demons = pickRandom(grouped.demon, demonN);
  const minions = pickRandom(grouped.minion, minionN);
  const minionPool = grouped.minion.filter((m) => !minions.includes(m));
  const queue = [...demons, ...minions];

  while (queue.length) {
    const c = queue.shift();
    const mod = SETUP_MODIFIERS[c.id];
    if (!mod) continue;
    if (mod.special) {
      addNote(mod.special);
      continue;
    }
    if (mod.note) addNote(mod.note);
    if (typeof mod.outsider === "number") {
      outsiderN += mod.outsider;
      townsfolkN -= mod.outsider;
    }
    if (Array.isArray(mod.outsiderChoice)) {
      const d = mod.outsiderChoice[Math.floor(Math.random() * mod.outsiderChoice.length)];
      outsiderN += d;
      townsfolkN -= d;
    }
    if (mod.minion) {
      for (let i = 0; i < mod.minion; i++) {
        minionN += 1;
        townsfolkN -= 1;
        const extra = pickRandom(minionPool, 1)[0];
        if (extra) {
          minions.push(extra);
          minionPool.splice(minionPool.indexOf(extra), 1);
          queue.push(extra);
        }
      }
    }
  }

  // Keep totals exact: clamp evil/outsider counts, then derive Townsfolk from the remainder.
  minionN = Math.max(0, minionN);
  outsiderN = Math.max(0, Math.min(outsiderN, count - minionN - demonN));
  townsfolkN = Math.max(0, count - outsiderN - minionN - demonN);

  const outsiders = pickRandom(grouped.outsider, outsiderN);
  const townsfolk = pickRandom(grouped.townsfolk, townsfolkN);

  // Surface setup notes for any good-team characters that actually got drawn.
  [...townsfolk, ...outsiders].forEach((c) => {
    const mod = SETUP_MODIFIERS[c.id];
    if (mod && (mod.note || mod.special)) addNote(mod.note || mod.special);
  });

  const target = { townsfolk: townsfolkN, outsider: outsiderN, minion: minionN, demon: demonN };
  const drawn = { townsfolk, outsider: outsiders, minion: minions, demon: demons };

  [
    ["demon", demonN],
    ["minion", minionN],
    ["outsider", outsiderN],
    ["townsfolk", townsfolkN],
  ].forEach(([team, want]) => {
    const have = drawn[team].length;
    if (have < want) warnings.push(`Script only has ${have} for ${TEAM_LABELS[team]} — needs ${want}.`);
  });

  return { count, target, drawn, notes, warnings };
}

function renderSetupResult(setup) {
  const el = document.getElementById("setup-result");
  if (!el) return;
  if (!setup) {
    el.classList.add("hidden");
    el.innerHTML = "";
    return;
  }
  el.classList.remove("hidden");

  const teams = ["townsfolk", "outsider", "minion", "demon"];
  const groupsHtml = teams
    .map((team) => {
      const list = setup.drawn[team];
      const items =
        list.map((c) => `<li>${escapeHtml(c.name)}</li>`).join("") ||
        '<li class="setup-result-empty">—</li>';
      return `
        <div class="setup-result-group setup-result-${team}">
          <div class="setup-result-group-head">
            <span class="setup-result-team">${TEAM_LABELS[team]}</span>
            <span class="setup-result-count">${list.length}/${setup.target[team]}</span>
          </div>
          <ul>${items}</ul>
        </div>`;
    })
    .join("");

  const notesHtml = setup.notes.length
    ? `<div class="setup-result-notes"><strong>Setup effects</strong><ul>${setup.notes
        .map((n) => `<li>${escapeHtml(n)}</li>`)
        .join("")}</ul></div>`
    : "";

  const warnHtml = setup.warnings.length
    ? `<div class="setup-result-warn">${setup.warnings.map((w) => escapeHtml(w)).join("<br>")}</div>`
    : "";

  el.innerHTML = `
    <div class="setup-result-head">
      <span>Random setup · ${setup.count} players</span>
      <button type="button" class="setup-reroll" onclick="drawSetup()">🎲 Re-roll</button>
    </div>
    <div class="setup-result-grid">${groupsHtml}</div>
    ${notesHtml}
    ${warnHtml}
  `;
}

function drawSetup() {
  if (!activeGrouped) return;
  renderSetupResult(generateSetup(activeGrouped, selectedPlayers));
}

async function loadGrimoirePanel(script) {
  const [data] = await Promise.all([fetchScriptJson(script), loadCharacters()]);
  activeScriptJson = data;
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

function scriptBasename(scriptOrFile) {
  const file = typeof scriptOrFile === "string" ? scriptOrFile : scriptOrFile?.file || "";
  return file.split("/").pop().toLowerCase();
}

function getCurrentScripts() {
  const marked = allScripts.filter((s) => s.current);
  if (marked.length) return marked;

  if (!currentScriptFiles.length) return [];

  return currentScriptFiles
    .map((name) => {
      const found = allScripts.find((s) => scriptBasename(s) === name);
      if (found) return found;
      return {
        title: titleFromFilename(name),
        file: `scripts/${name}`,
        json: null,
        current: true,
      };
    })
    .filter(Boolean);
}

function getCurrentScript() {
  return getCurrentScripts()[0] || null;
}

function formatScriptList(scripts) {
  if (!scripts.length) return "No script set";
  if (scripts.length === 1) return scripts[0].title;
  if (scripts.length === 2) return `${scripts[0].title} & ${scripts[1].title}`;
  return scripts.map((s) => s.title).join(" · ");
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

function renderFeaturedItem(script) {
  const item = document.createElement("article");
  item.className = "featured-script-item";

  const thumb = document.createElement("div");
  thumb.className = "featured-thumb";
  thumb.title = `Open ${script.title}`;

  const img = document.createElement("img");
  img.alt = script.title;
  img.src = script.file;
  img.onerror = () => {
    thumb.innerHTML = '<div class="thumb-placeholder">📜</div>';
  };
  thumb.appendChild(img);
  thumb.addEventListener("click", () => openScriptDetail(script, "sheet"));

  const body = document.createElement("div");
  body.className = "featured-script-item-body";
  body.innerHTML = `
    <p class="featured-title">${escapeHtml(script.title)}</p>
    <div class="btn-row">
      <button type="button" class="btn btn-primary featured-open-sheet">Open Script</button>
      <button type="button" class="btn btn-ghost featured-open-json"${script.json ? "" : " disabled"}>Grimoire JSON</button>
    </div>
  `;

  body.querySelector(".featured-open-sheet").addEventListener("click", () => {
    openScriptDetail(script, "sheet");
  });
  body.querySelector(".featured-open-json").addEventListener("click", () => {
    if (script.json) openScriptDetail(script, "json");
  });

  item.appendChild(thumb);
  item.appendChild(body);
  return item;
}

function renderFeatured(scripts) {
  const list = Array.isArray(scripts) ? scripts : scripts ? [scripts] : [];
  const container = document.getElementById("featured-scripts");
  const labelEl = document.getElementById("currentScriptLabel");

  applyGameDayLabels(list.length || 1);
  labelEl.textContent = formatScriptList(list);

  container.innerHTML = "";
  container.classList.toggle("featured-scripts-multi", list.length > 1);

  if (!list.length) {
    const empty = document.createElement("p");
    empty.className = "featured-title";
    empty.id = "currentName";
    empty.textContent = currentScriptFiles.length
      ? formatScriptList(
          currentScriptFiles.map((name) => ({ title: titleFromFilename(name) }))
        )
      : "No script set";
    container.appendChild(empty);
    return;
  }

  list.forEach((script) => container.appendChild(renderFeaturedItem(script)));
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

  const schedule = getGameSchedule();

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
      <h3>${escapeHtml(script.title)}</h3>
      <div class="script-card-badges">
        ${script.current ? `<span class="badge">${escapeHtml(schedule.badge)}</span>` : ""}
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

function scriptMatchesQuery(script, q) {
  if (script.title.toLowerCase().includes(q)) return true;
  return (script.roles || []).some((r) => r.id.includes(q) || r.name.toLowerCase().includes(q));
}

function filterScripts(query) {
  const q = query.trim().toLowerCase();
  const filtered = q ? allScripts.filter((s) => scriptMatchesQuery(s, q)) : allScripts;
  renderScriptGrid(filtered);
}

async function enrichScriptsWithRoles() {
  await Promise.all(
    allScripts.map(async (script) => {
      if (!script.json) {
        script.roles = [];
        return;
      }
      try {
        const res = await fetch(script.json);
        if (!res.ok) {
          script.roles = [];
          return;
        }
        const data = await res.json();
        script.roles = Array.isArray(data)
          ? data.filter((item) => typeof item === "string").map((id) => getCharacter(id))
          : [];
      } catch {
        script.roles = [];
      }
    })
  );
}

async function loadCurrentScript() {
  try {
    const res = await fetch("current-script.txt");
    const text = await res.text();
    currentScriptFiles = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => line.toLowerCase());
  } catch {
    currentScriptFiles = [];
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

  if (currentScriptFiles.length) {
    const order = new Map(currentScriptFiles.map((name, i) => [name, i]));
    allScripts = allScripts.map((s) => ({
      ...s,
      current: order.has(scriptBasename(s)),
    }));
    allScripts.sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1;
      if (a.current && b.current) {
        return (order.get(scriptBasename(a)) ?? 0) - (order.get(scriptBasename(b)) ?? 0);
      }
      return a.title.localeCompare(b.title);
    });
  } else {
    allScripts.sort((a, b) => {
      if (!!a.current !== !!b.current) return a.current ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }

  await loadCharacters();
  await enrichScriptsWithRoles();

  const current = getCurrentScripts();
  applyGameDayLabels(current.length || 1);
  renderFeatured(current);
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
loadCharacters();
initPlayerSetup();
activatePage(location.hash.slice(1) || "home");
