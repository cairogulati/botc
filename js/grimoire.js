// Storyteller grimoire: seating circle with reminder tokens, day/night clock,
// night order, nominations & votes, travellers, Fabled and jinxes.
// Relies on globals from app.js and game.js (game, saveGame, getCharacter, …).

const SPECIAL_STEPS = {
  dusk: {
    name: "Dusk",
    text: "Check that all eyes are closed. Some Travellers & Fabled act.",
  },
  minioninfo: {
    name: "Minion info",
    text: "Wake all Minions. Show the THIS IS THE DEMON token and point to the Demon. Show the THESE ARE YOUR MINIONS token and point to the other Minions.",
  },
  demoninfo: {
    name: "Demon info",
    text: "Wake the Demon. Show the THESE ARE YOUR MINIONS token and point to all Minions. Show the THESE CHARACTERS ARE NOT IN PLAY token and the 3 bluffs.",
  },
  dawn: {
    name: "Dawn",
    text: "Wait a few seconds. Call for eyes open.",
  },
};

let grimTab = "circle";
let grimSelected = null; // player id
let swapMode = false;
let swapFirst = null;
let townSquare = false;
let voteDraft = null;
let nightSheet = { firstNight: [], otherNight: [] };
let jinxData = {};
let grimDataPromise = null;

function loadGrimoireData() {
  if (!grimDataPromise) {
    const get = (url) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
    grimDataPromise = Promise.all([get("data/nightsheet.json"), get("data/jinxes.json")]).then(([n, j]) => {
      if (n) nightSheet = n;
      if (j) jinxData = j;
    });
  }
  return grimDataPromise;
}

function playerById(id) {
  return game.players.find((p) => p.id === id) || null;
}

function playerLabel(p) {
  return p.name || `Card ${game.players.indexOf(p) + 1}`;
}

function clockInfo() {
  const night = game.clock % 2 === 0;
  const number = Math.floor(game.clock / 2) + 1;
  return { night, number, label: `${night ? "🌙 Night" : "☀️ Day"} ${number}` };
}

function aliveCount() {
  return game.players.filter((p) => !p.dead).length;
}

function votesNeeded() {
  return Math.ceil(aliveCount() / 2);
}

// ---------- Open / close ----------

function openGrimoire() {
  if (!confirm("Storyteller only — make sure no players can see the screen.")) return;
  grimoireOpen = true;
  townSquare = false;
  grimSelected = null;
  loadGrimoireData().then(renderGrimoire);
  renderGame();
}

function closeGrimoire() {
  grimoireOpen = false;
  grimSelected = null;
  swapMode = false;
  renderGame();
}

function setGrimTab(tab) {
  grimTab = tab;
  renderGrimoire();
}

function showTownSquare() {
  townSquare = true;
  grimSelected = null;
  swapMode = false;
  renderGrimoire();
}

function leaveTownSquare() {
  if (!confirm("Back to the grimoire? Characters will be visible again.")) return;
  townSquare = false;
  renderGrimoire();
}

function stepClock(delta) {
  const next = Math.max(0, game.clock + delta);
  if (next === game.clock) return;
  game.clock = next;
  game.nightDone = [];
  voteDraft = null;
  saveGame();
  renderGrimoire();
}

// ---------- Render ----------

function renderGrimoire() {
  const clock = clockInfo();
  document.getElementById("grim-clock-label").textContent = clock.label;
  document.getElementById("grim-tabs").hidden = townSquare;
  document.getElementById("grim-town-banner").hidden = !townSquare;
  document.getElementById("grim-footer").hidden = townSquare;

  const tab = townSquare ? "circle" : grimTab;
  document.querySelectorAll("[data-grim-tab]").forEach((b) => b.classList.toggle("active", b.dataset.grimTab === tab));
  ["circle", "night", "votes", "info"].forEach((t) => {
    document.getElementById(`grim-pane-${t}`).hidden = t !== tab;
  });
  document.getElementById("grim-tools").hidden = townSquare;

  if (tab === "circle") renderCircle();
  else if (tab === "night") renderNightOrder();
  else if (tab === "votes") renderVotes();
  else renderInfo();
}

function renderCircle() {
  const circle = document.getElementById("grim-circle");
  const n = game.players.length;
  const size = n > 15 ? 50 : n > 12 ? 56 : n > 8 ? 64 : 74;
  circle.style.setProperty("--token", `${size}px`);

  document.getElementById("grim-swap-btn").classList.toggle("active", swapMode);
  document.getElementById("grim-swap-hint").hidden = !swapMode;

  circle.innerHTML = game.players
    .map((p, i) => {
      const c = getCharacter(p.role);
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const pos = (r) => `left:${50 + r * Math.cos(angle)}%;top:${50 + r * Math.sin(angle)}%`;
      const classes = [
        "grim-token",
        townSquare ? "grim-token-public" : `grim-token-${playerSide(p)}`,
        c.team === "traveler" ? "grim-token-traveler" : "",
        p.dead ? "dead" : "",
        grimSelected === p.id || swapFirst === p.id ? "selected" : "",
      ].join(" ");
      const ghost = p.dead
        ? `<span class="grim-token-ghost" title="${p.ghostUsed ? "Ghost vote used" : "Ghost vote available"}">${p.ghostUsed ? "✕" : "👻"}</span>`
        : "";
      const reminders =
        !townSquare && p.reminders.length
          ? `<div class="grim-reminders" style="${pos(25)}">${p.reminders
              .map((r) => `<span class="grim-reminder">${escapeHtml(r.text)}</span>`)
              .join("")}</div>`
          : "";
      return `
        <button type="button" class="${classes}" data-id="${p.id}" style="${pos(41)}">
          ${townSquare ? (p.dead ? "💀" : "") : `<span class="grim-token-role">${escapeHtml(c.name)}</span>`}
          ${ghost}
          <span class="grim-token-name">${escapeHtml(playerLabel(p))}</span>
        </button>${reminders}`;
    })
    .join("");

  const alive = aliveCount();
  const ghosts = game.players.filter((p) => p.dead && !p.ghostUsed).length;
  document.getElementById("grim-center").innerHTML = `
    <span class="grim-center-big">${alive}</span>
    <span>alive</span>
    <span class="grim-center-small">${ghosts} ghost vote${ghosts === 1 ? "" : "s"} · ${votesNeeded()} to execute</span>`;

  circle.querySelectorAll(".grim-token").forEach((btn) => {
    btn.addEventListener("click", () => onTokenClick(btn.dataset.id));
  });

  renderSeatPanel();
}

function onTokenClick(id) {
  if (townSquare) return;
  if (swapMode) {
    if (!swapFirst) {
      swapFirst = id;
    } else {
      const a = game.players.findIndex((p) => p.id === swapFirst);
      const b = game.players.findIndex((p) => p.id === id);
      if (a >= 0 && b >= 0 && a !== b) {
        [game.players[a], game.players[b]] = [game.players[b], game.players[a]];
        saveGame();
      }
      swapFirst = null;
    }
    renderCircle();
    return;
  }
  grimSelected = grimSelected === id ? null : id;
  renderCircle();
}

function toggleSwapMode() {
  swapMode = !swapMode;
  swapFirst = null;
  grimSelected = null;
  renderCircle();
}

function inPlayIds() {
  return [...new Set(game.players.map((p) => p.role))];
}

function reminderOptions() {
  const out = [];
  [...inPlayIds(), ...game.fabled].forEach((id) => {
    const c = getCharacter(id);
    [...(c.reminders || []), ...(c.remindersGlobal || [])].forEach((text) => {
      if (!out.some((o) => o.from === id && o.text === text)) out.push({ from: id, text });
    });
  });
  return out.sort((a, b) => getCharacter(a.from).name.localeCompare(getCharacter(b.from).name));
}

function roleOptionsHtml(selected) {
  const script = gameScript();
  const ids = scriptRoleIds(script);
  const travelers = Object.keys(characters).filter((id) => characters[id].team === "traveler");
  const grouped = groupRoles([...new Set([...ids, ...travelers, selected])]);
  return ["townsfolk", "outsider", "minion", "demon", "traveler", "unknown"]
    .filter((t) => grouped[t].length)
    .map(
      (t) =>
        `<optgroup label="${TEAM_LABELS[t]}">${grouped[t]
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => `<option value="${escapeHtml(c.id)}"${c.id === selected ? " selected" : ""}>${escapeHtml(c.name)}</option>`)
          .join("")}</optgroup>`
    )
    .join("");
}

function renderSeatPanel() {
  const panel = document.getElementById("grim-seat");
  const p = playerById(grimSelected);
  if (!p || townSquare) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const c = getCharacter(p.role);
  const shown = p.shownAs ? getCharacter(p.shownAs).name : null;
  const side = playerSide(p);
  const remOptions = reminderOptions()
    .map((o, i) => `<option value="${i}">${escapeHtml(getCharacter(o.from).name)}: ${escapeHtml(o.text)}</option>`)
    .join("");

  panel.innerHTML = `
    <div class="grim-seat-head">
      <h3>${escapeHtml(playerLabel(p))}</h3>
      <button type="button" class="modal-close" data-act="close" aria-label="Close">✕</button>
    </div>
    ${c.ability ? `<p class="grim-seat-ability">${escapeHtml(c.ability)}</p>` : ""}
    ${shown ? `<p class="grim-seat-disguise">Thinks they are the <strong>${escapeHtml(shown)}</strong>.</p>` : ""}
    ${jinxesFor(p.role).length ? `<p class="grim-seat-jinx">⚠️ Jinx: ${jinxesFor(p.role).map((j) => escapeHtml(j)).join(" ")}</p>` : ""}

    <div class="btn-row grim-seat-toggles">
      <button type="button" class="btn ${p.dead ? "btn-primary" : "btn-ghost"}" data-act="dead">${p.dead ? "💀 Dead" : "Alive"}</button>
      <button type="button" class="btn btn-ghost" data-act="ghost"${p.dead ? "" : " disabled"}>${p.ghostUsed ? "Ghost vote used" : "Ghost vote ready"}</button>
      <button type="button" class="btn btn-ghost grim-align-${side}" data-act="align">${side === "evil" ? "Evil" : "Good"}${p.alignment ? " *" : ""}</button>
    </div>

    <div class="grim-field">
      <span>Reminders</span>
      <div class="grim-seat-reminders">
        ${
          p.reminders
            .map(
              (r, i) =>
                `<button type="button" class="grim-reminder grim-reminder-removable" data-rem="${i}" title="Remove">${escapeHtml(r.text)} ✕</button>`
            )
            .join("") || '<span class="grim-muted">None</span>'
        }
      </div>
      <div class="grim-add-reminder">
        <select id="grim-rem-select" class="search-input game-input">
          <option value="">Add a reminder…</option>
          ${remOptions}
          <option value="custom">Custom…</option>
        </select>
      </div>
    </div>

    <label class="grim-field">
      <span>Name</span>
      <input type="text" id="grim-seat-name" class="search-input game-input" value="${escapeHtml(p.name)}" autocomplete="off">
    </label>
    <label class="grim-field">
      <span>Character</span>
      <select id="grim-seat-role" class="search-input game-input">${roleOptionsHtml(p.role)}</select>
    </label>
    <label class="grim-field">
      <span>Notes</span>
      <textarea id="grim-seat-note" class="search-input game-input" rows="3" placeholder="Poisoned night 2, told they're the Chef…">${escapeHtml(p.note)}</textarea>
    </label>
    <button type="button" class="btn btn-ghost grim-remove" data-act="remove">Remove from game</button>`;

  const rerender = () => {
    saveGame();
    renderCircle();
  };
  panel.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.act;
      if (act === "close") grimSelected = null;
      if (act === "dead") {
        p.dead = !p.dead;
        if (!p.dead) p.ghostUsed = false;
      }
      if (act === "ghost") p.ghostUsed = !p.ghostUsed;
      if (act === "align") {
        const natural = teamSide(getCharacter(p.role).team);
        p.alignment = playerSide(p) === "good" ? "evil" : "good";
        if (p.alignment === natural) p.alignment = null;
      }
      if (act === "remove") {
        if (!confirm(`Remove ${playerLabel(p)} from the game?`)) return;
        game.players = game.players.filter((x) => x !== p);
        grimSelected = null;
      }
      rerender();
    });
  });
  panel.querySelectorAll("[data-rem]").forEach((btn) => {
    btn.addEventListener("click", () => {
      p.reminders.splice(parseInt(btn.dataset.rem, 10), 1);
      rerender();
    });
  });
  panel.querySelector("#grim-rem-select").addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v) return;
    if (v === "custom") {
      const text = (prompt("Reminder text") || "").trim().slice(0, 24);
      if (text) p.reminders.push({ from: null, text });
    } else {
      const o = reminderOptions()[parseInt(v, 10)];
      if (o) p.reminders.push(o);
    }
    rerender();
  });
  panel.querySelector("#grim-seat-name").addEventListener("change", (e) => {
    p.name = e.target.value.trim();
    rerender();
  });
  panel.querySelector("#grim-seat-role").addEventListener("change", (e) => {
    p.role = e.target.value;
    if (!DISGUISES[p.role]) p.shownAs = null;
    p.alignment = null;
    rerender();
  });
  panel.querySelector("#grim-seat-note").addEventListener("input", (e) => {
    p.note = e.target.value;
    saveGame();
  });
}

function addTraveller() {
  const name = (prompt("Traveller's name") || "").trim();
  if (!name) return;
  const scriptTravellers = scriptRoleIds(gameScript()).filter((id) => getCharacter(id).team === "traveler");
  const all = Object.keys(characters).filter((id) => characters[id].team === "traveler");
  const role = scriptTravellers[0] || all[0] || "unknown";
  const p = makePlayer(role, { name, taken: true });
  game.players.push(p);
  grimSelected = p.id;
  saveGame();
  renderCircle();
  document.getElementById("grim-seat").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Night order ----------

function renderNightOrder() {
  const pane = document.getElementById("grim-night-list");
  const clock = clockInfo();
  if (!clock.night) {
    pane.innerHTML = `<div class="empty-state"><p>It's day ${clock.number}. Move the clock to Night ${clock.number + 1} to see the wake order.</p></div>`;
    return;
  }
  const first = clock.number === 1;
  const order = first ? nightSheet.firstNight : nightSheet.otherNight;
  const steps = [];

  order.forEach((id) => {
    if (SPECIAL_STEPS[id]) {
      if ((id === "minioninfo" || id === "demoninfo") && (!first || game.players.length < 7)) return;
      let text = SPECIAL_STEPS[id].text;
      if (id === "demoninfo" && game.bluffs.length) {
        text += ` Bluffs: ${game.bluffs.map((b) => getCharacter(b).name).join(", ")}.`;
      }
      steps.push({ id, name: SPECIAL_STEPS[id].name, text, actors: [], special: true });
      return;
    }
    const actors = game.players.filter((p) => p.role === id || p.shownAs === id);
    if (!actors.length && !game.fabled.includes(id)) return;
    const c = getCharacter(id);
    const text = first ? c.firstNightReminder : c.otherNightReminder;
    if (!text) return;
    steps.push({ id, name: c.name, text: cleanReminder(text), actors });
  });

  pane.innerHTML = steps.length
    ? steps
        .map((s) => {
          const done = game.nightDone.includes(s.id);
          const actors = s.actors
            .map((p) => {
              const fake = p.shownAs === s.id ? ` (actually the ${escapeHtml(getCharacter(p.role).name)})` : "";
              return `<span class="night-actor${p.dead ? " dead" : ""}">${escapeHtml(playerLabel(p))}${p.dead ? " 💀" : ""}${fake}</span>`;
            })
            .join("");
          return `
          <li class="night-step${done ? " done" : ""}${s.special ? " special" : ""}">
            <label>
              <input type="checkbox" data-step="${escapeHtml(s.id)}"${done ? " checked" : ""}>
              <span class="night-step-body">
                <span class="night-step-name">${escapeHtml(s.name)}</span>
                ${actors ? `<span class="night-actors">${actors}</span>` : ""}
                <span class="night-step-text">${escapeHtml(s.text)}</span>
              </span>
            </label>
          </li>`;
        })
        .join("")
    : '<div class="empty-state"><p>Nobody in play wakes tonight.</p></div>';

  pane.querySelectorAll("[data-step]").forEach((box) => {
    box.addEventListener("change", () => {
      const id = box.dataset.step;
      game.nightDone = box.checked ? [...game.nightDone, id] : game.nightDone.filter((x) => x !== id);
      saveGame();
      box.closest(".night-step").classList.toggle("done", box.checked);
    });
  });
}

// ---------- Votes ----------

function todaysVotes() {
  const day = clockInfo().number;
  return game.votes.filter((v) => v.day === day);
}

function onTheBlock() {
  const votes = todaysVotes().filter((v) => v.count >= v.needed);
  if (!votes.length) return { player: null, tie: false };
  const top = Math.max(...votes.map((v) => v.count));
  const leaders = votes.filter((v) => v.count === top);
  if (leaders.length > 1) return { player: null, tie: true, count: top };
  return { player: playerById(leaders[0].nominee), tie: false, count: top };
}

function renderVotes() {
  const pane = document.getElementById("grim-pane-votes");
  const clock = clockInfo();
  if (clock.night) {
    pane.innerHTML = `<div class="empty-state"><p>Nominations happen during the day. Move the clock to Day ${clock.number}.</p></div>`;
    return;
  }
  const day = clock.number;
  if (!voteDraft) voteDraft = { nominator: "", nominee: "", voters: [] };

  const opts = (filter, selected) =>
    `<option value="">Choose…</option>` +
    game.players
      .filter(filter)
      .map((p) => `<option value="${p.id}"${p.id === selected ? " selected" : ""}>${escapeHtml(playerLabel(p))}${p.dead ? " 💀" : ""}</option>`)
      .join("");

  const voterChips = game.players
    .map((p) => {
      const can = !p.dead || !p.ghostUsed;
      const on = voteDraft.voters.includes(p.id);
      return `<button type="button" class="game-chip vote-chip${on ? " selected" : ""}" data-voter="${p.id}"${can ? "" : " disabled"}>${escapeHtml(playerLabel(p))}${p.dead ? " 👻" : ""}</button>`;
    })
    .join("");

  const needed = votesNeeded();
  const count = voteDraft.voters.length;
  const block = onTheBlock();
  const executed = playerById(game.executions[day]);

  const history = todaysVotes()
    .map((v, i) => {
      const nom = playerById(v.nominator);
      const nee = playerById(v.nominee);
      return `<li><span><strong>${escapeHtml(nom ? playerLabel(nom) : "?")}</strong> nominated <strong>${escapeHtml(
        nee ? playerLabel(nee) : "?"
      )}</strong></span><span class="vote-result${v.count >= v.needed ? " enough" : ""}">${v.count} / ${v.needed}</span>
      <button type="button" class="vote-remove" data-remove-vote="${i}" aria-label="Remove">✕</button></li>`;
    })
    .join("");

  let blockHtml;
  if (executed) blockHtml = `<p class="vote-block">⚰️ Executed today: <strong>${escapeHtml(playerLabel(executed))}</strong></p>`;
  else if (block.player)
    blockHtml = `<p class="vote-block">On the block: <strong>${escapeHtml(playerLabel(block.player))}</strong> (${block.count} votes)</p>
      <button type="button" class="btn btn-primary" id="vote-execute">Execute ${escapeHtml(playerLabel(block.player))}</button>`;
  else if (block.tie) blockHtml = `<p class="vote-block">Tied on ${block.count} votes, so nobody is on the block.</p>`;
  else blockHtml = `<p class="vote-block grim-muted">Nobody is on the block yet.</p>`;

  pane.innerHTML = `
    <div class="card">
      <h3>New nomination</h3>
      <div class="vote-pickers">
        <label class="grim-field"><span>Nominator</span><select id="vote-nominator" class="search-input game-input">${opts((p) => !p.dead, voteDraft.nominator)}</select></label>
        <label class="grim-field"><span>Nominee</span><select id="vote-nominee" class="search-input game-input">${opts(() => true, voteDraft.nominee)}</select></label>
      </div>
      <p class="game-label">Hands raised: <strong class="vote-count${count >= needed ? " enough" : ""}">${count}</strong> · ${needed} needed</p>
      <div class="game-chip-list">${voterChips}</div>
      <div class="btn-row vote-actions">
        <button type="button" class="btn btn-primary" id="vote-record"${voteDraft.nominator && voteDraft.nominee ? "" : " disabled"}>Record vote</button>
        <button type="button" class="btn btn-ghost" id="vote-clear">Clear</button>
      </div>
      <p class="setup-generate-hint">Dead players who vote use up their ghost vote when you record it.</p>
    </div>
    <div class="card">
      <h3>Day ${day}</h3>
      ${history ? `<ul class="vote-history">${history}</ul>` : '<p class="grim-muted">No nominations yet.</p>'}
      ${blockHtml}
    </div>`;

  pane.querySelector("#vote-nominator").addEventListener("change", (e) => {
    voteDraft.nominator = e.target.value;
    renderVotes();
  });
  pane.querySelector("#vote-nominee").addEventListener("change", (e) => {
    voteDraft.nominee = e.target.value;
    renderVotes();
  });
  pane.querySelectorAll("[data-voter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.voter;
      voteDraft.voters = voteDraft.voters.includes(id)
        ? voteDraft.voters.filter((v) => v !== id)
        : [...voteDraft.voters, id];
      renderVotes();
    });
  });
  pane.querySelector("#vote-clear").addEventListener("click", () => {
    voteDraft = null;
    renderVotes();
  });
  pane.querySelector("#vote-record").addEventListener("click", () => {
    voteDraft.voters.forEach((id) => {
      const p = playerById(id);
      if (p && p.dead) p.ghostUsed = true;
    });
    game.votes.push({
      day,
      nominator: voteDraft.nominator,
      nominee: voteDraft.nominee,
      voters: voteDraft.voters.slice(),
      count: voteDraft.voters.length,
      needed,
    });
    voteDraft = null;
    saveGame();
    renderVotes();
  });
  pane.querySelectorAll("[data-remove-vote]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = todaysVotes()[parseInt(btn.dataset.removeVote, 10)];
      game.votes = game.votes.filter((x) => x !== v);
      saveGame();
      renderVotes();
    });
  });
  const exec = pane.querySelector("#vote-execute");
  if (exec) {
    exec.addEventListener("click", () => {
      const p = block.player;
      if (!confirm(`Execute ${playerLabel(p)}?`)) return;
      p.dead = true;
      game.executions[day] = p.id;
      saveGame();
      renderVotes();
    });
  }
}

// ---------- Info: bluffs, Fabled, jinxes ----------

function jinxesFor(id) {
  const inPlay = new Set([...inPlayIds(), ...game.fabled]);
  return Object.entries(jinxData[id] || {})
    .filter(([other]) => inPlay.has(other))
    .map(([other, reason]) => `${getCharacter(other).name}: ${reason}`);
}

function renderInfo() {
  const bluffs = document.getElementById("grim-bluffs");
  bluffs.innerHTML = game.bluffs.length
    ? game.bluffs.map((id) => `<span class="grim-bluff">${escapeHtml(getCharacter(id).name)}</span>`).join("")
    : '<span class="grim-muted">No unused good characters left.</span>';

  const fabledAll = Object.keys(characters).filter((id) => characters[id].team === "fabled");
  document.getElementById("grim-fabled").innerHTML =
    (game.fabled
      .map(
        (id) =>
          `<div class="grim-fabled-item"><div><strong>${escapeHtml(getCharacter(id).name)}</strong><p>${escapeHtml(
            getCharacter(id).ability || ""
          )}</p></div><button type="button" class="vote-remove" data-unfable="${escapeHtml(id)}" aria-label="Remove">✕</button></div>`
      )
      .join("") || '<p class="grim-muted">No Fabled in play.</p>') +
    `<select id="grim-fabled-add" class="search-input game-input"><option value="">Add a Fabled…</option>${fabledAll
      .filter((id) => !game.fabled.includes(id))
      .sort((a, b) => getCharacter(a).name.localeCompare(getCharacter(b).name))
      .map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(getCharacter(id).name)}</option>`)
      .join("")}</select>`;

  document.querySelectorAll("[data-unfable]").forEach((btn) => {
    btn.addEventListener("click", () => {
      game.fabled = game.fabled.filter((id) => id !== btn.dataset.unfable);
      saveGame();
      renderInfo();
    });
  });
  document.getElementById("grim-fabled-add").addEventListener("change", (e) => {
    if (!e.target.value) return;
    game.fabled.push(e.target.value);
    saveGame();
    renderInfo();
  });

  // Jinxes between characters on the script; the ones in play first.
  const ids = scriptRoleIds(gameScript());
  const onScript = new Set(ids);
  const inPlay = new Set(inPlayIds());
  const pairs = [];
  ids.forEach((a) => {
    Object.entries(jinxData[a] || {}).forEach(([b, reason]) => {
      if (onScript.has(b) && a < b) pairs.push({ a, b, reason, live: inPlay.has(a) && inPlay.has(b) });
    });
  });
  pairs.sort((x, y) => Number(y.live) - Number(x.live));
  document.getElementById("grim-jinxes").innerHTML = pairs.length
    ? pairs
        .map(
          (j) => `<li class="${j.live ? "live" : ""}"><strong>${escapeHtml(getCharacter(j.a).name)} &amp; ${escapeHtml(
            getCharacter(j.b).name
          )}</strong>${j.live ? ' <span class="badge badge-evil">In play</span>' : ""}<p>${escapeHtml(j.reason)}</p></li>`
        )
        .join("")
    : '<li class="grim-muted">No jinxes on this script.</li>';
}

function rerollBluffs() {
  rollBluffs();
  saveGame();
  renderInfo();
}

function initGrimoire() {
  document.querySelectorAll("[data-grim-tab]").forEach((btn) => {
    btn.addEventListener("click", () => setGrimTab(btn.dataset.grimTab));
  });
  loadGrimoireData();
}

initGrimoire();
