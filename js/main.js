/* =========================================================
   Portfolio – main script
     1. Project cards (built from PROJECTS in projects.js)
     2. Project page (project.html)
    2b. Blocks built from a project's orbit data (facts, tables)
     3. Mobile menu
     4. Active section in the menu
     5. Copy email
     6. Small extras (footer year, reduced motion)
     7. Orbit data loader (shared with orbits.html)
   No libraries: plain DOM APIs only.
   ========================================================= */

/* Small helper: escapes text before inserting it as HTML, so a "<" or "&"
   in a title can never break the page. (The "details" bodies are written
   as HTML on purpose, so they are inserted as-is.) */
function escapeHTML(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}


/* ---------- 1. PROJECT CARDS (index.html) ---------- */
const projectsList = document.getElementById("projects-list");

// URL of a project's page: project.html?id=satellite-orbit-explorer
function projectUrl(id) {
  return `project.html?id=${encodeURIComponent(id)}`;
}

function cardTemplate(project) {
  const soon = project.status === "soon";

  const media = soon
    ? `<div class="project-card__media project-card__media--placeholder" aria-hidden="true">
         <span class="badge">In progress</span>
       </div>`
    : `<div class="project-card__media">
         <img src="${escapeHTML(project.image.src)}" alt="${escapeHTML(project.image.alt)}"
              width="${project.image.width}" height="${project.image.height}" loading="lazy">
       </div>`;

  const tags = project.tech?.length
    ? `<ul class="tags" aria-label="Technologies">
         ${project.tech.map((t) => `<li>${escapeHTML(t)}</li>`).join("")}
       </ul>`
    : "";

  // Buttons: "Explore" only if the project has details; "Code" only if it has a repo.
  // "Explore" is a real link to the project page, so it can be opened in a new tab or shared.
  const exploreBtn = project.details
    ? `<a class="btn btn--small btn--primary project-card__open" href="${projectUrl(project.id)}">
         Explore project <span class="visually-hidden">${escapeHTML(project.title)}</span>
       </a>`
    : "";

  const repoBtn = project.repo
    ? `<a class="btn btn--small project-card__extra" href="${escapeHTML(project.repo)}" target="_blank" rel="noopener">
         Code on GitHub <span class="visually-hidden">for ${escapeHTML(project.title)}</span>
       </a>`
    : "";

  const demoBtn = project.demo
    ? `<a class="btn btn--small project-card__extra" href="${escapeHTML(project.demo)}">
         Explore in 3D <span class="visually-hidden">: ${escapeHTML(project.title)}</span>
       </a>`
    : "";

  const links = exploreBtn || repoBtn || demoBtn
    ? `<div class="project-card__links">${exploreBtn}${demoBtn}${repoBtn}</div>`
    : "";

  return `
    <li class="project-card${soon ? " project-card--soon" : ""}${project.details ? " project-card--clickable" : ""}">
      <article class="project-card__inner">
        ${media}
        <div class="project-card__body">
          <p class="project-card__meta">${escapeHTML(project.meta)}</p>
          <h3 class="project-card__title">${escapeHTML(project.title)}</h3>
          <p class="project-card__desc">${escapeHTML(project.summary)}</p>
          ${tags}
          ${links}
        </div>
      </article>
    </li>`;
}

if (projectsList && typeof PROJECTS !== "undefined") {
  projectsList.innerHTML = PROJECTS.map(cardTemplate).join("");
}


/* ---------- 2. PROJECT PAGE (project.html) ----------
   project.html is a single template for every project: it reads the id
   from the URL (?id=...), finds that project in PROJECTS and builds the page. */
const projectPage = document.getElementById("project-page");

function factsTemplate(facts) {
  return `<dl class="key-facts">
    ${facts.map((f) => `
      <div class="key-facts__item">
        <dt>${escapeHTML(f.label)}</dt>
        <dd>${escapeHTML(f.value)}</dd>
      </div>`).join("")}
  </dl>`;
}

// Adds a query parameter to a relative URL: "orbits.html?project=x" + embed=1
function withParam(url, key, value) {
  return `${url}${url.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function detailTemplate(project) {
  const d = project.details;

  // facts: a fixed list, or "data" = computed from the project's orbit data (see section 2b)
  const facts = d.facts === "data"
    ? `<div data-slot="facts"></div>`
    : d.facts?.length ? factsTemplate(d.facts) : "";

  // A section may have its own text (body) and/or a block generated from the data (data: "...")
  const sections = d.sections
    .map((s, i) => `
      <section class="detail__section">
        <h2><span class="detail__section-num">${String(i + 1).padStart(2, "0")}</span>${escapeHTML(s.title)}</h2>
        ${s.body || ""}
        ${s.data ? `<div data-slot="${escapeHTML(s.data)}"><p class="detail__loading">Loading data…</p></div>` : ""}
      </section>`)
    .join("");

  // Links between projects ("Built on top of …", "Follow-up project …")
  const related = (project.related || [])
    .map((r) => {
      const other = PROJECTS.find((p) => p.id === r.id);
      return other
        ? `<p class="related"><span>${escapeHTML(r.label)}</span> <a href="${projectUrl(other.id)}">${escapeHTML(other.title)}</a></p>`
        : "";
    })
    .join("");

  const tags = project.tech?.length
    ? `<ul class="tags" aria-label="Technologies">${project.tech.map((t) => `<li>${escapeHTML(t)}</li>`).join("")}</ul>`
    : "";

  const repo = project.repo
    ? `<a class="btn btn--primary" href="${escapeHTML(project.repo)}" target="_blank" rel="noopener">View the code on GitHub</a>`
    : "";

  const cover = project.image
    ? `<div class="detail__cover">
         <img src="${escapeHTML(project.image.src)}" alt="${escapeHTML(project.image.alt)}"
              width="${project.image.width}" height="${project.image.height}">
       </div>`
    : "";

  // Interactive demo: a poster with a "Launch" button. The heavy viewer (iframe) is only
  // loaded when the visitor asks for it, so the page stays fast and scrolling isn't trapped.
  const demo = project.demo
    ? `<section class="demo" aria-labelledby="demo-title">
         <h2 class="visually-hidden" id="demo-title">Interactive 3D simulation</h2>
         <div class="demo__frame" id="demo-frame">
           ${project.image ? `<img src="${escapeHTML(project.image.src)}" alt="" width="${project.image.width}" height="${project.image.height}">` : ""}
           <button class="btn btn--primary demo__launch" type="button" data-embed="${escapeHTML(withParam(project.demo, "embed", "1"))}">
             <span aria-hidden="true">▶</span> ${escapeHTML(d.demoLabel || "Launch the 24-hour simulation in 3D")}
           </button>
         </div>
         <p class="demo__hint">
           ${escapeHTML(d.demoHint || "Play the day, drag the time bar to any instant and click a satellite to see its orbit data")} ·
           <a href="${escapeHTML(project.demo)}">open the viewer in a full page</a>
         </p>
       </section>`
    : "";

  return `
    <div class="container detail__container">
      <a class="detail__back" href="index.html#projects"><span aria-hidden="true">←</span> All projects</a>
      <header class="detail__header">
        <p class="eyebrow"><span class="eyebrow__num">01</span>Projects</p>
        <h1 class="detail__title">${escapeHTML(project.title)}</h1>
        <p class="project-card__meta">${escapeHTML(project.meta)}</p>
        ${d.tagline ? `<p class="detail__tagline">${escapeHTML(d.tagline)}</p>` : ""}
        ${tags}
        ${related}
      </header>
    </div>
    <div class="container detail__wide">${demo || cover}</div>
    <div class="container detail__container">
      ${facts}
      ${sections}
      <footer class="detail__footer">
        ${repo}
        ${project.demo ? `<a class="btn" href="${escapeHTML(project.demo)}">Explore in 3D</a>` : ""}
        <a class="btn" href="index.html#projects">Back to all projects</a>
      </footer>
    </div>`;
}

function notFoundTemplate() {
  return `
    <div class="container detail__container">
      <h1 class="detail__title">Project not found</h1>
      <p>That project doesn't exist (or the link is incomplete).</p>
      <a class="btn btn--primary" href="index.html#projects">See all projects</a>
    </div>`;
}

if (projectPage && typeof PROJECTS !== "undefined") {
  // URLSearchParams reads the "?id=..." part of the address
  const id = new URLSearchParams(location.search).get("id");
  const project = PROJECTS.find((p) => p.id === id && p.details);

  if (project) {
    projectPage.innerHTML = detailTemplate(project);
    // Browser tab title and description adapted to this project
    document.title = `${project.title} | Antonio Rodríguez-Palmero`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", project.summary);

    // Blocks generated from the project's orbit data (facts, tables, limitations)
    if (project.dataset) {
      loadOrbitData(project.dataset)
        .then((data) => fillDataSlots(data))
        .catch((error) => {
          console.error(error);
          projectPage.querySelectorAll("[data-slot]").forEach((slot) => {
            slot.innerHTML = `<p class="detail__loading">The project data could not be loaded.</p>`;
          });
        });
    }
  } else {
    projectPage.innerHTML = notFoundTemplate();
    document.title = "Project not found | Antonio Rodríguez-Palmero";
  }

  // "Launch" button: replace the poster with the live viewer
  projectPage.addEventListener("click", (event) => {
    const button = event.target.closest("[data-embed]");
    if (!button) return;
    const frame = document.getElementById("demo-frame");
    const iframe = document.createElement("iframe");
    iframe.src = button.dataset.embed;
    iframe.title = "Interactive 3D orbit viewer";
    iframe.allow = "fullscreen";
    frame.replaceChildren(iframe);
    iframe.focus();   // keyboard users land inside the viewer
  });
}


/* ---------- 2b. BLOCKS BUILT FROM THE ORBIT DATA ----------
   Every number in these blocks is read or computed from data/<id>/orbits_web.js:
   nothing is typed by hand, so regenerating the data updates the page. */
const utcFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const fmtUtc = (iso) => utcFormat.format(new Date(iso));
const fmt1 = (x) => x.toFixed(1);
const shortSatName = (name) => name.replace(/\s*\(.*\)$/, "");

function formatPeriod(hours) {
  return hours < 2 ? `${fmt1(hours)} h (${Math.round(hours * 60)} min)` : `${hours.toFixed(2)} h`;
}

// Satellites grouped by constellation (or by regime if the data has no "group")
function groupSatellites(data) {
  const groups = new Map();
  data.satellites.forEach((sat) => {
    const key = sat.group || sat.regime;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sat);
  });
  return groups;
}

function windowHours(data) {
  return ((data.n_points - 1) * data.step_s) / 3600;
}

function dataFacts(data) {
  const groups = groupSatellites(data);
  const passes = data.satellites.reduce((n, s) => n + (s.passes?.length || 0), 0);
  const mask = data.observer?.elevation_mask_deg;
  return [
    {
      value: String(data.satellites.length),
      label: `satellites: ${[...groups].map(([g, sats]) => `${sats.length} ${g}`).join(" · ")}`,
    },
    { value: `${fmt1(windowHours(data))} h`, label: `window from ${fmtUtc(data.start_utc)} UTC` },
    ...(mask !== undefined ? [{ value: String(passes), label: `passes above the ${mask}° mask` }] : []),
    { value: `${data.step_s} s`, label: "between samples" },
  ];
}

function comparisonTemplate(data) {
  const groups = [...groupSatellites(data)];
  const mask = data.observer.elevation_mask_deg;

  const stats = groups.map(([name, sats]) => {
    const passes = sats.flatMap((s) => s.passes || []);
    const complete = passes.filter((p) => !p.partial);
    const periods = sats.map((s) => s.period_h);
    const minP = Math.min(...periods);
    const maxP = Math.max(...periods);
    return {
      name,
      regimes: [...new Set(sats.map((s) => s.regime))].join("/"),
      satellites: sats.map((s) => shortSatName(s.name)).join(", "),
      period: minP.toFixed(2) === maxP.toFixed(2) ? formatPeriod(minP) : `${formatPeriod(minP)} – ${formatPeriod(maxP)}`,
      passes: passes.length,
      partial: passes.length - complete.length,
      meanDuration: complete.length
        ? complete.reduce((sum, p) => sum + p.duration_min, 0) / complete.length
        : null,
      completeCount: complete.length,
      maxEl: passes.length ? Math.max(...passes.map((p) => p.max_el_deg)) : null,
    };
  });

  const row = (label, cell) => `<tr><th scope="row">${label}</th>${stats.map((s) => `<td class="num">${cell(s)}</td>`).join("")}</tr>`;

  return `
    <div class="data-table-wrap">
      <table class="data-table">
        <caption>${stats.map((s) => `${escapeHTML(s.regimes)} (${escapeHTML(s.name)})`).join(" vs ")}</caption>
        <thead>
          <tr><th scope="col">From ${escapeHTML(data.observer.name)}</th>${stats.map((s) => `<th scope="col">${escapeHTML(s.name)} · ${escapeHTML(s.regimes)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${row("Satellites", (s) => escapeHTML(s.satellites))}
          ${row("Orbital period", (s) => s.period)}
          ${row(`Passes above ${mask}°`, (s) => `${s.passes}${s.partial ? `<span class="note">${s.partial} cut by the window</span>` : ""}`)}
          ${row("Mean duration of a complete pass", (s) =>
            s.meanDuration === null
              ? `—<span class="note">no complete pass in this window</span>`
              : `${fmt1(s.meanDuration)} min<span class="note">from ${s.completeCount} complete pass${s.completeCount === 1 ? "" : "es"}</span>`)}
          ${row("Highest elevation reached", (s) => (s.maxEl === null ? "—" : `${fmt1(s.maxEl)}°`))}
        </tbody>
      </table>
    </div>
    <p class="table-footnote">
      Computed from the ${fmt1(windowHours(data))}-hour window starting ${fmtUtc(data.start_utc)} UTC.
      Passes cut by the start or end of the window are counted, but left out of the mean duration
      because their real length is unknown.
    </p>`;
}

function passesTemplate(data) {
  const mask = data.observer.elevation_mask_deg;
  const tables = data.satellites.map((sat) => {
    const rows = (sat.passes || [])
      .map((p) => `
        <tr${p.partial ? ' class="is-partial"' : ""}>
          <td class="num">${fmtUtc(p.rise_utc)}</td>
          <td class="num">${fmtUtc(p.set_utc)}</td>
          <td class="num">${fmt1(p.duration_min)} min${p.partial ? " *" : ""}</td>
          <td class="num">${fmt1(p.max_el_deg)}°</td>
        </tr>`)
      .join("");
    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <caption>
            <span class="sat-dot" style="--dot:${escapeHTML(sat.color)}"></span>${escapeHTML(shortSatName(sat.name))}
            <small>${escapeHTML(sat.group ? `${sat.group} · ${sat.regime}` : sat.regime)} · ${formatPeriod(sat.period_h)}</small>
          </caption>
          <thead>
            <tr><th scope="col">Rise (UTC)</th><th scope="col">Set (UTC)</th><th scope="col">Duration</th><th scope="col">Max elev.</th></tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="4">No pass above ${mask}° in this window.</td></tr>`}
          </tbody>
        </table>
      </div>`;
  });

  return `
    <div class="passes-grid">${tables.join("")}</div>
    <p class="table-footnote">
      * Cut by the window: the pass had already started when the data window began, or was still
      going on when it ended, so its real duration is longer than shown.
    </p>`;
}

function limitationsTemplate(data) {
  return `
    <p>${escapeHTML(data.model_note)}</p>
    <p class="callout"><strong>Data:</strong> ${escapeHTML(data.source)}</p>`;
}

function fillDataSlots(data) {
  const renderers = {
    facts: () => factsTemplate(dataFacts(data)),
    comparison: () => (data.observer ? comparisonTemplate(data) : ""),
    passes: () => (data.observer ? passesTemplate(data) : ""),
    limitations: () => limitationsTemplate(data),
  };
  projectPage.querySelectorAll("[data-slot]").forEach((slot) => {
    const render = renderers[slot.dataset.slot];
    slot.innerHTML = render ? render() : "";
  });
}


/* ---------- 3. MOBILE MENU ---------- */
const navToggle = document.querySelector(".nav__toggle");
const navMenu = document.getElementById("nav-menu");

function setMenu(open) {
  navToggle.setAttribute("aria-expanded", String(open));
  navMenu.classList.toggle("is-open", open);
}

if (navToggle && navMenu) {
  navToggle.addEventListener("click", () => {
    setMenu(navToggle.getAttribute("aria-expanded") !== "true");
  });

  // Close after choosing a section
  navMenu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setMenu(false);
  });

  // Close with Esc and return focus to the button
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navMenu.classList.contains("is-open")) {
      setMenu(false);
      navToggle.focus();
    }
  });

  // Close when clicking anywhere outside the header
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".site-header")) setMenu(false);
  });
}


/* ---------- 4. ACTIVE SECTION IN THE MENU ----------
   IntersectionObserver tells us when a section crosses a horizontal band
   in the middle of the screen, without listening to every scroll event. */
const menuLinks = [...document.querySelectorAll('.nav__menu a[href^="#"]')];
const observedSections = menuLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

if ("IntersectionObserver" in window && observedSections.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        menuLinks.forEach((link) => {
          const active = link.getAttribute("href") === `#${entry.target.id}`;
          if (active) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      });
    },
    // The "band" is the strip between 45% and 50% of the screen height
    { rootMargin: "-45% 0px -50% 0px" }
  );
  observedSections.forEach((section) => observer.observe(section));
}


/* ---------- 5. COPY EMAIL ---------- */
const copyBtn = document.querySelector(".email__copy");
const copyFeedback = document.querySelector(".email__feedback");

// The Clipboard API only works on secure origins (https or localhost)
if (copyBtn && navigator.clipboard) {
  copyBtn.hidden = false;
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copyBtn.dataset.copy);
      copyFeedback.textContent = "Copied!";
    } catch {
      copyFeedback.textContent = "Could not copy, please select the address.";
    }
    setTimeout(() => (copyFeedback.textContent = ""), 2500);
  });
}


/* ---------- 6. SMALL EXTRAS ---------- */
// Footer year always up to date
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// The hero satellites use SVG (SMIL) animation, which CSS cannot stop.
// If the system asks for reduced motion, pause them here.
const orbits = document.querySelector(".hero__orbits");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function applyMotionPreference() {
  if (!orbits?.pauseAnimations) return;
  if (reducedMotion.matches) orbits.pauseAnimations();
  else orbits.unpauseAnimations();
}

applyMotionPreference();
reducedMotion.addEventListener("change", applyMotionPreference);


/* ---------- 7. ORBIT DATA LOADER (shared by project.html and orbits.html) ----------
   Each project with a viewer has data/<id>/orbits_web.js, written by its Python
   project, which sets window.ORBITS_WEB_DATA. Loading it with a <script> tag (not
   fetch) keeps working even when a page is opened straight from disk. */
function loadOrbitData(id) {
  // Only simple ids like "galileo-vs-starlink-madrid": never load an arbitrary path
  if (!/^[a-z0-9-]+$/.test(id)) return Promise.reject(new Error(`Invalid data id: ${id}`));

  return new Promise((resolve, reject) => {
    delete window.ORBITS_WEB_DATA;
    const script = document.createElement("script");
    script.src = `data/${id}/orbits_web.js`;
    script.onload = () => {
      const data = window.ORBITS_WEB_DATA;
      if (data && Array.isArray(data.satellites)) resolve(data);
      else reject(new Error(`${script.src} does not define ORBITS_WEB_DATA`));
    };
    script.onerror = () => reject(new Error(`Could not load ${script.src}`));
    document.head.append(script);
  });
}
