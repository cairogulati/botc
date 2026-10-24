// Character library: every character with its ability, flavour text and the
// scripts we play that use it. Relies on globals from app.js.

const EDITION_LABELS = {
  homebrew: "Homebrew",
  tb: "Trouble Brewing",
  bmr: "Bad Moon Rising",
  snv: "Sects & Violets",
  carousel: "Experimental",
};

const LIBRARY_FILTERS = ["all", "townsfolk", "outsider", "minion", "demon", "traveler", "fabled", "loric", "homebrew"];

let libraryTeam = "all";
let libraryOursOnly = false;

function scriptsUsing(id) {
  return allScripts.filter((s) => (s.roles || []).some((r) => r.id === id));
}

// Official reminder text carries token markup like ":reminder:" and *KNOW*.
function cleanReminder(text) {
  return text.replace(/:reminder:/g, "").replace(/\*([^*]+)\*/g, "$1").replace(/\s{2,}/g, " ").trim();
}

function libraryCardHtml(c) {
  const scripts = scriptsUsing(c.id);
  const edition = EDITION_LABELS[c.edition];
  const details = [];
  if (c.flavor) details.push(`<p class="lib-flavor">“${escapeHtml(c.flavor.replace(/^[“"]|[”"]$/g, ""))}”</p>`);
  if (c.firstNightReminder) {
    details.push(`<p class="lib-reminder"><strong>Storyteller, first night:</strong> ${escapeHtml(cleanReminder(c.firstNightReminder))}</p>`);
  }
  if (c.otherNightReminder) {
    details.push(`<p class="lib-reminder"><strong>Storyteller, other nights:</strong> ${escapeHtml(cleanReminder(c.otherNightReminder))}</p>`);
  }

  const scriptsHtml = scripts.length
    ? `<div class="lib-scripts"><span class="lib-scripts-label">In</span>${scripts
        .map(
          (s) =>
            `<button type="button" class="lib-script-link" data-file="${escapeHtml(s.file || s.json)}">${escapeHtml(s.title)}</button>`
        )
        .join("")}</div>`
    : "";

  return `
    <article class="lib-card lib-card-${c.team}" id="char-${escapeHtml(c.id)}">
      <div class="lib-card-head">
        <h3>${escapeHtml(c.name)}</h3>
        ${edition ? `<span class="lib-edition${c.edition === "homebrew" ? " lib-edition-homebrew" : ""}">${escapeHtml(edition)}</span>` : ""}
      </div>
      <p class="lib-ability">${escapeHtml(c.ability || "No ability text yet.")}</p>
      ${scriptsHtml}
      ${details.length ? `<details class="lib-more"><summary>More</summary>${details.join("")}</details>` : ""}
    </article>`;
}

function renderLibrary() {
  const list = document.getElementById("library-list");
  const countEl = document.getElementById("library-count");
  if (!list) return;

  const q = document.getElementById("library-search").value.trim().toLowerCase();
  const all = Object.keys(characters).map((id) => getCharacter(id));

  const matches = all.filter((c) => {
    if (libraryTeam === "homebrew") {
      if (c.edition !== "homebrew") return false;
    } else if (libraryTeam !== "all" && c.team !== libraryTeam) return false;
    if (libraryOursOnly && !scriptsUsing(c.id).length) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.ability || "").toLowerCase().includes(q);
  });

  countEl.textContent = `${matches.length} character${matches.length === 1 ? "" : "s"}`;

  const grouped = {};
  matches.forEach((c) => (grouped[c.team] = grouped[c.team] || []).push(c));

  const html = TEAM_ORDER.filter((team) => grouped[team])
    .map((team) => {
      const cards = grouped[team]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(libraryCardHtml)
        .join("");
      return `
        <section class="lib-section">
          <h3 class="lib-section-head role-group-${team}"><span class="role-group-team">${TEAM_LABELS[team]}</span><span class="lib-section-count">${grouped[team].length}</span></h3>
          <div class="lib-grid">${cards}</div>
        </section>`;
    })
    .join("");

  list.innerHTML = html || '<div class="empty-state"><p>No characters match.</p></div>';

  list.querySelectorAll(".lib-script-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const script = allScripts.find((s) => (s.file || s.json) === btn.dataset.file);
      if (script) openScriptDetail(script, script.json ? "json" : "sheet");
    });
  });
}

function initLibrary() {
  const filters = document.getElementById("library-filters");
  filters.innerHTML = LIBRARY_FILTERS.map(
    (team) =>
      `<button type="button" class="game-chip lib-filter${team === libraryTeam ? " selected" : ""}" data-team="${team}" aria-pressed="${team === libraryTeam}">${team === "all" ? "All" : TEAM_LABELS[team] || "🧪 Homebrew"}</button>`
  ).join("");

  filters.querySelectorAll(".lib-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      libraryTeam = btn.dataset.team;
      filters.querySelectorAll(".lib-filter").forEach((b) => {
        b.classList.toggle("selected", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      renderLibrary();
    });
  });

  document.getElementById("library-search").addEventListener("input", renderLibrary);
  document.getElementById("library-ours").addEventListener("change", (e) => {
    libraryOursOnly = e.target.checked;
    renderLibrary();
  });
  document.addEventListener("scripts-loaded", renderLibrary);
}

initLibrary();
