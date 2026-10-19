// Game night: Storyteller picks characters, players draw face-down cards on a
// shared phone, and the Storyteller tracks everything in the grimoire.
// Relies on globals from app.js (allScripts, getCharacter, generateSetup, …).

const GAME_KEY = "botc-game";
const TEAM_SINGULAR = { townsfolk: "Townsfolk", outsider: "Outsider", minion: "Minion", demon: "Demon" };
const DEALT_TEAMS = ["townsfolk", "outsider", "minion", "demon", "unknown"];

// Characters who are shown a different character when they look at their card.
const DISGUISES = {
  drunk: { team: "townsfolk", label: "thinks they are" },
  lunatic: { team: "demon", label: "thinks they are" },
  marionette: { team: "townsfolk", label: "thinks they are" },
};

let game = loadGame();
let grimoireOpen = false;
let selectedSeat = null;
let dealCard = null;

function newGame(scriptFile = null, selection = []) {
  return { phase: "setup", script: scriptFile, selection, players: [], bluffs: [] };
}

function loadGame() {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_KEY) || "null");
    if (saved && Array.isArray(saved.selection) && Array.isArray(saved.players)) return saved;
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

  const inPlay = new Set(game.selection);
  const ids = scriptRoleIds(script);
  const used = new Set(inPlay);

  game.players = shuffle(game.selection).map((role) => {
    let shownAs = null;
    const disguise = DISGUISES[role];
    if (disguise) {
      const options = ids.filter((id) => getCharacter(id).team === disguise.team);
      shownAs = pickUnused(options, used, 1)[0] || null;
      if (shownAs) used.add(shownAs);
    }
    return { role, shownAs, name: "", taken: false, dead: false, ghostUsed: false, note: "" };
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

// ---------- Grimoire ----------

function openGrimoire() {
  if (!confirm("Storyteller only — make sure no players can see the screen.")) return;
  grimoireOpen = true;
  selectedSeat = null;
  renderGame();
}

function closeGrimoire() {
  grimoireOpen = false;
  selectedSeat = null;
  renderGame();
}

function renderGrimoire() {
  const circle = document.getElementById("grim-circle");
  const n = game.players.length;
  const size = n > 12 ? 58 : n > 8 ? 66 : 76;
  circle.style.setProperty("--token", `${size}px`);

  circle.innerHTML = game.players
    .map((p, i) => {
      const c = getCharacter(p.role);
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const x = 50 + 41 * Math.cos(angle);
      const y = 50 + 41 * Math.sin(angle);
      const classes = [
        "grim-token",
        `grim-token-${teamSide(c.team)}`,
        p.dead ? "dead" : "",
        selectedSeat === i ? "selected" : "",
      ].join(" ");
      return `
        <button type="button" class="${classes}" data-seat="${i}" style="left:${x}%;top:${y}%">
          <span class="grim-token-role">${escapeHtml(c.name)}</span>
          ${p.dead ? `<span class="grim-token-ghost" title="${p.ghostUsed ? "Ghost vote used" : "Ghost vote available"}">${p.ghostUsed ? "✕" : "👻"}</span>` : ""}
          <span class="grim-token-name">${escapeHtml(p.name || `Card ${i + 1}`)}</span>
        </button>`;
    })
    .join("");

  const alive = game.players.filter((p) => !p.dead).length;
  const ghosts = game.players.filter((p) => p.dead && !p.ghostUsed).length;
  document.getElementById("grim-center").innerHTML = `
    <span class="grim-center-big">${alive}</span>
    <span>alive</span>
    <span class="grim-center-small">${ghosts} ghost vote${ghosts === 1 ? "" : "s"} · ${Math.ceil(alive / 2)} to execute</span>`;

  circle.querySelectorAll(".grim-token").forEach((btn) => {
    btn.addEventListener("click", () => {
      const seat = parseInt(btn.dataset.seat, 10);
      selectedSeat = selectedSeat === seat ? null : seat;
      renderGrimoire();
    });
  });

  document.getElementById("grim-bluffs").innerHTML = game.bluffs.length
    ? game.bluffs.map((id) => `<span class="grim-bluff">${escapeHtml(getCharacter(id).name)}</span>`).join("")
    : '<span class="json-pane-lead">No unused good characters left.</span>';

  renderSeatPanel();
}

function renderSeatPanel() {
  const panel = document.getElementById("grim-seat");
  if (selectedSeat === null || !game.players[selectedSeat]) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const p = game.players[selectedSeat];
  const script = gameScript();
  const grouped = groupRoles(scriptRoleIds(script));
  const options = DEALT_TEAMS.filter((t) => grouped[t].length)
    .map(
      (t) =>
        `<optgroup label="${TEAM_LABELS[t]}">${grouped[t]
          .map((c) => `<option value="${escapeHtml(c.id)}"${c.id === p.role ? " selected" : ""}>${escapeHtml(c.name)}</option>`)
          .join("")}</optgroup>`
    )
    .join("");
  const shown = p.shownAs ? getCharacter(p.shownAs).name : null;
  const ability = getCharacter(p.role).ability;

  panel.innerHTML = `
    <div class="grim-seat-head">
      <h3>Seat ${selectedSeat + 1}</h3>
      <button type="button" class="modal-close" id="grim-seat-close" aria-label="Close">✕</button>
    </div>
    ${ability ? `<p class="grim-seat-ability">${escapeHtml(ability)}</p>` : ""}
    ${shown ? `<p class="grim-seat-disguise">Thinks they are the <strong>${escapeHtml(shown)}</strong>.</p>` : ""}
    <label class="grim-field">
      <span>Name</span>
      <input type="text" id="grim-seat-name" class="search-input game-input" value="${escapeHtml(p.name)}" autocomplete="off">
    </label>
    <label class="grim-field">
      <span>Character</span>
      <select id="grim-seat-role" class="search-input game-input">${options}</select>
    </label>
    <div class="btn-row">
      <button type="button" class="btn ${p.dead ? "btn-primary" : "btn-ghost"}" id="grim-seat-dead">${p.dead ? "💀 Dead" : "Alive"}</button>
      <button type="button" class="btn btn-ghost" id="grim-seat-ghost"${p.dead ? "" : " disabled"}>${p.ghostUsed ? "Ghost vote used" : "Ghost vote available"}</button>
    </div>
    <label class="grim-field">
      <span>Notes</span>
      <textarea id="grim-seat-note" class="search-input game-input" rows="3" placeholder="Poisoned night 2, told they're the Chef…">${escapeHtml(p.note)}</textarea>
    </label>`;

  panel.querySelector("#grim-seat-close").addEventListener("click", () => {
    selectedSeat = null;
    renderGrimoire();
  });
  panel.querySelector("#grim-seat-name").addEventListener("change", (e) => {
    p.name = e.target.value.trim();
    saveGame();
    renderGrimoire();
  });
  panel.querySelector("#grim-seat-role").addEventListener("change", (e) => {
    p.role = e.target.value;
    if (!DISGUISES[p.role]) p.shownAs = null;
    saveGame();
    renderGrimoire();
  });
  panel.querySelector("#grim-seat-dead").addEventListener("click", () => {
    p.dead = !p.dead;
    if (!p.dead) p.ghostUsed = false;
    saveGame();
    renderGrimoire();
  });
  panel.querySelector("#grim-seat-ghost").addEventListener("click", () => {
    p.ghostUsed = !p.ghostUsed;
    saveGame();
    renderGrimoire();
  });
  panel.querySelector("#grim-seat-note").addEventListener("input", (e) => {
    p.note = e.target.value;
    saveGame();
  });
}

function rerollBluffs() {
  rollBluffs();
  saveGame();
  renderGrimoire();
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
  game.phase = "setup";
  game.players = [];
  game.bluffs = [];
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
