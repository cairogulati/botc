// Game night: Storyteller picks characters, players draw face-down cards on a
// shared phone, and the Storyteller tracks everything in the grimoire.
// Relies on globals from app.js (allScripts, getCharacter, generateSetup, …).

const GAME_KEY = "botc-game";
const TEAM_SINGULAR = { townsfolk: "Townsfolk", outsider: "Outsider", minion: "Minion", demon: "Demon" };
const DEALT_TEAMS = ["townsfolk", "outsider", "minion", "demon", "unknown"];

// Characters who are shown a different character when they look at their card.
// The Storyteller can pick the character each one is shown, or leave it random.
const DISGUISES = {
  drunk: { teams: ["townsfolk"] },
  lunatic: { teams: ["demon"] },
  marionette: { teams: ["townsfolk", "outsider"] },
};

let game = loadGame();
let grimoireOpen = false;
let dealCard = null;

function newGame(scriptFile = null, selection = []) {
  return {
    phase: "setup",
    script: scriptFile,
    selection,
    players: [],
    bluffs: [],
    fabled: [],
    clock: 0, // 0 = Night 1, 1 = Day 1, 2 = Night 2, …
    nightDone: [],
    disguises: {}, // role id -> character the Storyteller picked before dealing
    votes: [],
    executions: {},
  };
}

function makePlayer(role, extra = {}) {
  return {
    id: Math.random().toString(36).slice(2, 10),
    role,
    shownAs: null,
    name: "",
    taken: false,
    dead: false,
    ghostUsed: false,
    alignment: null, // null = the character's team decides
    reminders: [],
    note: "",
    ...extra,
  };
}

// Fill in fields added after a game was saved by an older version.
function normalizeGame(saved) {
  const g = { ...newGame(), ...saved };
  g.players = g.players.map((p) => ({ ...makePlayer(p.role), ...p }));
  return g;
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_KEY) || "null");
    if (saved && Array.isArray(saved.selection) && Array.isArray(saved.players)) return normalizeGame(saved);
  } catch {
    /* ignore */
  }
  return newGame();
}

function saveGame() {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(game));
  } catch {
    /* ignore */
  }
}

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function teamSide(team) {
  return team === "minion" || team === "demon" ? "evil" : "good";
}

function playerSide(p) {
  return p.alignment || teamSide(getCharacter(p.role).team);
}

function gameScript() {
  const playable = allScripts.filter((s) => s.roles && s.roles.length);
  return (
    playable.find((s) => s.file === game.script) ||
    playable.find((s) => s.current) ||
    playable[0] ||
    null
  );
}

function scriptRoleIds(script) {
  return (script?.roles || []).map((c) => c.id);
}

// ---------- Setup ----------

function expectedSplit(count, ids) {
  const base = PLAYER_SETUP[count];
  if (!base) return null;
  const t = { townsfolk: base.townsfolk, outsider: base.outsiders, minion: base.minions, demon: base.demon };
  const notes = [];
  ids.forEach((id) => {
    const mod = SETUP_MODIFIERS[id];
    if (!mod) return;
    const note = mod.special || mod.note;
    if (note && !notes.includes(note)) notes.push(note);
    if (mod.special) return;
    if (typeof mod.outsider === "number") {
      t.outsider += mod.outsider;
      t.townsfolk -= mod.outsider;
    }
    if (mod.minion) {
      t.minion += mod.minion;
      t.townsfolk -= mod.minion;
    }
    if (mod.noMinions) {
      t.townsfolk += t.minion;
      t.minion = 0;
    }
    if (mod.noDemon) {
      t.townsfolk += t.demon;
      t.demon = 0;
    }
  });
  Object.keys(t).forEach((k) => (t[k] = Math.max(0, t[k])));
  return { target: t, notes };
}

function renderGameSetup() {
  const script = gameScript();
  const select = document.getElementById("game-script");
  const chips = document.getElementById("game-chips");
  const summary = document.getElementById("game-summary");
  const dealBtn = document.getElementById("game-deal-btn");

  const playable = allScripts.filter((s) => s.roles && s.roles.length);
  select.innerHTML = playable
    .map(
      (s) =>
        `<option value="${escapeHtml(s.file)}"${s === script ? " selected" : ""}>${escapeHtml(s.title)}</option>`
    )
    .join("");

  if (!script) {
    chips.innerHTML = '<p class="json-pane-lead">No scripts with grimoire JSON yet.</p>';
    summary.innerHTML = "";
    dealBtn.disabled = true;
    return;
  }
  if (game.script !== script.file) {
    game.script = script.file;
    game.selection = [];
    saveGame();
  }

  const inScript = new Set(scriptRoleIds(script));
  game.selection = game.selection.filter((id) => inScript.has(id));

  const grouped = groupRoles(scriptRoleIds(script));
  const selected = new Set(game.selection);
  chips.innerHTML = DEALT_TEAMS.filter((team) => grouped[team].length)
    .map((team) => {
      const items = grouped[team]
        .map(
          (c) =>
            `<button type="button" class="game-chip game-chip-${team}${selected.has(c.id) ? " selected" : ""}" data-id="${escapeHtml(c.id)}" aria-pressed="${selected.has(c.id)}">${escapeHtml(c.name)}</button>`
        )
        .join("");
      return `<div class="game-chip-group">
        <div class="game-chip-head role-group-${team}">
          <span class="role-group-team">${TEAM_LABELS[team]}</span>
          <span class="game-chip-count" data-team="${team}"></span>
        </div>
        <div class="game-chip-list">${items}</div>
      </div>`;
    })
    .join("");

  chips.querySelectorAll(".game-chip").forEach((btn) => {
    btn.addEventListener("click", () => toggleCharacter(btn.dataset.id));
  });

  renderSetupSummary();
}

function renderSetupSummary() {
  const summary = document.getElementById("game-summary");
  const dealBtn = document.getElementById("game-deal-btn");
  const count = selectedPlayers;
  const split = expectedSplit(count, game.selection);
  const have = { townsfolk: 0, outsider: 0, minion: 0, demon: 0, unknown: 0 };
  game.selection.forEach((id) => {
    const team = getCharacter(id).team;
    have[team in have ? team : "unknown"] += 1;
  });

  document.querySelectorAll(".game-chip-count").forEach((el) => {
    const team = el.dataset.team;
    const want = split?.target[team];
    el.textContent = want === undefined ? `${have[team]}` : `${have[team]} / ${want}`;
    el.classList.toggle("match", want !== undefined && have[team] === want);
  });

  const total = game.selection.length;
  const diff = count - total;
  let status;
  if (diff > 0) status = `Pick ${diff} more`;
  else if (diff < 0) status = `Remove ${-diff}`;
  else status = "Ready to deal";
  if (split && split.target.demon > 0 && have.demon === 0) status += " · ⚠️ no Demon selected";

  const notesHtml = split?.notes.length
    ? `<ul class="game-notes">${split.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
    : "";

  summary.innerHTML = `
    <p class="game-summary-line"><strong>${total} / ${count}</strong> characters selected · <span class="${diff === 0 ? "game-ok" : ""}">${status}</span></p>
    ${notesHtml}`;
  dealBtn.disabled = diff !== 0;
  renderDisguisePicker();
}

function toggleCharacter(id) {
  const i = game.selection.indexOf(id);
  if (i >= 0) game.selection.splice(i, 1);
  else game.selection.push(id);
  saveGame();
  document.querySelectorAll(`.game-chip[data-id="${CSS.escape(id)}"]`).forEach((btn) => {
    btn.classList.toggle("selected", i < 0);
    btn.setAttribute("aria-pressed", String(i < 0));
  });
  renderSetupSummary();
}

function randomFillSelection() {
  const script = gameScript();
  if (!script) return;
  const setup = generateSetup(groupRoles(scriptRoleIds(script)), selectedPlayers);
  if (!setup) return;
  game.selection = Object.values(setup.drawn)
    .flat()
    .map((c) => c.id);
  saveGame();
  renderGameSetup();
}

function clearSelection() {
  game.selection = [];
  saveGame();
  renderGameSetup();
}

// Characters from the script a disguised role could be shown, minus those taken.
function disguiseCandidates(role, taken) {
  const d = DISGUISES[role];
  if (!d) return [];
  return scriptRoleIds(gameScript())
    .filter((id) => d.teams.includes(getCharacter(id).team) && !taken.has(id))
    .sort((a, b) => getCharacter(a).name.localeCompare(getCharacter(b).name));
}

function disguiseOptionsHtml(role, taken, selected, emptyLabel) {
  return (
    `<option value="">${emptyLabel}</option>` +
    // Keep the current pick listed even if it has since come into play.
    [...(selected && taken.has(selected) ? [selected] : []), ...disguiseCandidates(role, taken)]
      .map(
        (id) =>
          `<option value="${escapeHtml(id)}"${id === selected ? " selected" : ""}>${escapeHtml(getCharacter(id).name)} (${escapeHtml(
            TEAM_SINGULAR[getCharacter(id).team] || ""
          )})</option>`
      )
      .join("")
  );
}

function renderDisguisePicker() {
  const box = document.getElementById("game-disguises");
  const roles = game.selection.filter((id) => DISGUISES[id]);
  box.hidden = !roles.length;
  if (!roles.length) return;

  // Drop picks that are no longer valid (now in play, or role deselected).
  Object.keys(game.disguises).forEach((role) => {
    const pick = game.disguises[role];
    if (!roles.includes(role) || game.selection.includes(pick)) delete game.disguises[role];
  });

  box.innerHTML =
    `<h3>Who do they think they are?</h3>
    <p class="setup-lead">Pick the character they'll see on their card, or leave it random. Only characters not in play are offered.</p>` +
    roles
      .map((role) => {
        const others = Object.entries(game.disguises)
          .filter(([r]) => r !== role)
          .map(([, id]) => id);
        const taken = new Set([...game.selection, ...others]);
        return `<label class="grim-field">
          <span>${escapeHtml(getCharacter(role).name)} sees</span>
          <select class="search-input game-input" data-disguise="${escapeHtml(role)}">${disguiseOptionsHtml(
            role,
            taken,
            game.disguises[role],
            "🎲 Random"
          )}</select>
        </label>`;
      })
      .join("");

  box.querySelectorAll("[data-disguise]").forEach((sel) => {
    sel.addEventListener("change", () => {
      if (sel.value) game.disguises[sel.dataset.disguise] = sel.value;
      else delete game.disguises[sel.dataset.disguise];
      saveGame();
      renderDisguisePicker();
    });
  });
}

function pickUnused(ids, used, n) {
  return shuffle(ids.filter((id) => !used.has(id))).slice(0, n);
}

function rollBluffs() {
  const script = gameScript();
  const used = new Set(game.players.flatMap((p) => [p.role, p.shownAs].filter(Boolean)));
  const good = scriptRoleIds(script).filter((id) => ["townsfolk", "outsider"].includes(getCharacter(id).team));
  game.bluffs = pickUnused(good, used, 3);
}

function startDealing() {
  const script = gameScript();
  if (!script || game.selection.length !== selectedPlayers) return;

  const used = new Set([...game.selection, ...Object.values(game.disguises)]);

  game.players = shuffle(game.selection).map((role) => {
    let shownAs = null;
    if (DISGUISES[role]) {
      shownAs = game.disguises[role] || shuffle(disguiseCandidates(role, used))[0] || null;
      if (shownAs) used.add(shownAs);
    }
    return makePlayer(role, { shownAs });
  });
  rollBluffs();
  game.phase = "deal";
  grimoireOpen = false;
  saveGame();
  renderGame();
}

// ---------- Dealing ----------

function renderDeal() {
  const grid = document.getElementById("deal-grid");
  const progress = document.getElementById("deal-progress");
  const taken = game.players.filter((p) => p.taken).length;
  progress.textContent = `${taken} of ${game.players.length} cards taken`;

  grid.innerHTML = game.players
    .map(
      (p, i) => `
      <button type="button" class="deal-card${p.taken ? " taken" : ""}" data-seat="${i}">
        <span class="deal-card-num">${i + 1}</span>
        <span class="deal-card-name">${p.taken ? escapeHtml(p.name) : "Tap to draw"}</span>
      </button>`
    )
    .join("");

  grid.querySelectorAll(".deal-card").forEach((btn) => {
    btn.addEventListener("click", () => openDealCard(parseInt(btn.dataset.seat, 10)));
  });
}

function openDealCard(seat) {
  dealCard = seat;
  const p = game.players[seat];
  const modal = document.getElementById("deal-modal");
  document.getElementById("deal-card-title").textContent = `Card ${seat + 1}`;
  const nameInput = document.getElementById("deal-name");
  nameInput.value = p.name || "";

  showDealStep(p.taken ? "taken" : "name");
  if (p.taken) {
    document.getElementById("deal-taken-name").textContent = p.name;
  }
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
  if (!p.taken) setTimeout(() => nameInput.focus(), 50);
  updateRevealButton();
}

function showDealStep(step) {
  ["name", "taken", "reveal"].forEach((s) => {
    document.getElementById(`deal-step-${s}`).hidden = s !== step;
  });
}

function updateRevealButton() {
  document.getElementById("deal-reveal-btn").disabled = !document.getElementById("deal-name").value.trim();
}

function revealDealCard() {
  const p = game.players[dealCard];
  if (!p.taken) {
    const name = document.getElementById("deal-name").value.trim();
    if (!name) return;
    p.name = name;
    p.taken = true;
    saveGame();
  }
  const shown = getCharacter(p.shownAs || p.role);
  const side = teamSide(shown.team);
  document.getElementById("deal-reveal-hello").textContent = `${p.name}, you are the`;
  document.getElementById("deal-reveal-role").textContent = shown.name;
  const teamEl = document.getElementById("deal-reveal-team");
  teamEl.textContent = `${TEAM_SINGULAR[shown.team] || "Character"} · ${side === "evil" ? "Evil" : "Good"} team`;
  teamEl.className = `badge ${side === "evil" ? "badge-evil" : "badge-good"}`;
  document.getElementById("deal-reveal-ability").textContent = shown.ability || "";
  document.getElementById("deal-reveal").className = `deal-reveal deal-reveal-${side}`;
  showDealStep("reveal");
}

function closeDealCard() {
  document.getElementById("deal-modal").classList.remove("show");
  document.body.style.overflow = "";
  dealCard = null;
  renderDeal();
}

// ---------- Page ----------

function renderGame() {
  const inSetup = game.phase !== "deal";
  document.getElementById("game-setup").hidden = !inSetup;
  document.getElementById("game-deal").hidden = inSetup || grimoireOpen;
  document.getElementById("game-grimoire").hidden = inSetup || !grimoireOpen;

  if (inSetup) renderGameSetup();
  else if (grimoireOpen) renderGrimoire();
  else renderDeal();
}

function backToSetup() {
  if (!confirm("Go back to character selection? Everyone's cards will be cleared.")) return;
  game = newGame(game.script, game.selection);
  grimoireOpen = false;
  saveGame();
  renderGame();
}

function newGameFromScratch() {
  if (!confirm("Start a new game? The current grimoire will be cleared.")) return;
  game = newGame(game.script, []);
  grimoireOpen = false;
  saveGame();
  renderGame();
}

// Called from the random setup in the script viewer.
function useDrawnSetupForGame() {
  if (!lastDrawnSetup || !activeScript) return;
  if (game.phase === "deal" && !confirm("A game is in progress. Replace it with this setup?")) return;
  const ids = Object.values(lastDrawnSetup.drawn)
    .flat()
    .map((c) => c.id);
  game = newGame(activeScript.file, ids);
  grimoireOpen = false;
  saveGame();
  closeScriptModal();
  show("game");
  renderGame();
}

function initGame() {
  document.getElementById("game-script").addEventListener("change", (e) => {
    game.script = e.target.value;
    game.selection = [];
    saveGame();
    renderGameSetup();
  });
  document.getElementById("deal-name").addEventListener("input", updateRevealButton);
  document.getElementById("deal-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") revealDealCard();
  });
  document.addEventListener("players-changed", () => {
    if (game.phase !== "deal" && allScripts.length) renderSetupSummary();
  });
  document.addEventListener("scripts-loaded", renderGame);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && dealCard !== null) closeDealCard();
  });
}

initGame();
