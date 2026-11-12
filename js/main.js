/* =========================================================
   Portfolio – main script
     1. Project cards (built from PROJECTS in projects.js)
     2. Project page (project.html)
     3. Mobile menu
     4. Active section in the menu
     5. Copy email
     6. Small extras (footer year, reduced motion)
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

function detailTemplate(project) {
  const d = project.details;

  const facts = d.facts?.length
    ? `<dl class="key-facts">
         ${d.facts.map((f) => `
           <div class="key-facts__item">
             <dt>${escapeHTML(f.label)}</dt>
             <dd>${escapeHTML(f.value)}</dd>
           </div>`).join("")}
       </dl>`
    : "";

  const sections = d.sections
    .map((s, i) => `
      <section class="detail__section">
        <h2><span class="detail__section-num">${String(i + 1).padStart(2, "0")}</span>${escapeHTML(s.title)}</h2>
        ${s.body}
      </section>`)
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
           <button class="btn btn--primary demo__launch" type="button" data-embed="${escapeHTML(project.demo)}?embed=1">
             <span aria-hidden="true">▶</span> Launch the 24-hour simulation in 3D
           </button>
         </div>
         <p class="demo__hint">
           Play the day, drag the time bar to any instant and click a satellite to see its orbit data ·
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
