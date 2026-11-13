/* =========================================================
   PROJECTS DATA
   ---------------------------------------------------------
   To add a project, copy one object of the array and edit it.
   No HTML needs to change: main.js builds the cards and the
   project page (project.html) from this data.

   Fields:
     id        unique, no spaces (also used in the URL: project.html?id=satellite-orbit-explorer)
     status    "done" | "soon"   ("soon" = card without image or buttons)
     title, meta, summary        text shown on the card
     image     { src, alt, width, height }   card image (relative path!)
     tech      list of technologies (chips)
     repo      GitHub URL
     demo      page with an interactive demo (optional),
               e.g. "orbits.html?project=satellite-orbit-explorer"
     dataset   folder in data/ with orbits_web.js (optional): the project page
               builds facts and tables from it, so no number is typed by hand
     related   links to other projects: [{ id, label }], e.g. "Built on top of"
     details   content of the project page (optional):
       tagline   one-sentence hook under the title
       facts     key numbers: [{ value, label }], or "data" (computed from dataset)
       demoLabel / demoHint   texts of the 3D viewer block (optional)
       sections  [{ title, body, data }]  body is HTML written by me, so it may
                 contain <p>, <ul>, <figure>… (only trusted content here!);
                 data = "comparison" | "passes" | "limitations" adds a block
                 generated from the dataset
   ========================================================= */

const PROJECTS = [
  {
    id: "satellite-orbit-explorer",
    status: "done",
    title: "Satellite Orbit Explorer",
    meta: "Space Career Week 2026 · GNSS Academy",
    summary:
      "Python propagation of four satellites across four orbital regimes (LEO, MEO/Galileo, GEO and IGSO) " +
      "from CelesTrak data, with ground tracks, velocity profiles and Google Earth (KML) export.",
    // Card cover: a globe drawn from the real propagated data (not the raw chart)
    image: {
      src: "img/orbit-explorer-cover.webp",
      alt: "The Earth seen from space with the glowing 24-hour ground tracks of four satellites, including the figure-eight of QZS-2 over Japan and Oceania.",
      width: 1600,
      height: 900,
    },
    tech: ["Python", "Matplotlib", "KML", "CesiumJS"],
    repo: "https://github.com/antonio-palmero/satellite-orbit-explorer",
    // Interactive 3D viewer: "Explore in 3D" button on the card + embedded block on the project page
    demo: "orbits.html?project=satellite-orbit-explorer",
    related: [{ id: "galileo-vs-starlink-madrid", label: "Follow-up project:" }],

    details: {
      tagline:
        "Where is a satellite right now, and why do some of them sweep across the whole map while others seem to stand still?",

      facts: [
        { value: "4", label: "satellites, one per orbital regime" },
        { value: "24 h", label: "simulated (10 Nov 2026)" },
        { value: "17,281", label: "positions computed per satellite" },
        { value: "5 s", label: "between positions" },
      ],

      sections: [
        {
          title: "Why I built it",
          body: `
            <p>Satellites are part of everyday life: the positioning in your phone (GPS, Galileo),
            satellite TV, weather images… Yet very few people have ever worked out
            <em>where</em> one of them actually is at a given moment.</p>
            <p>During <strong>Space Career Week 2026</strong>, organised by GNSS Academy, the challenge was to
            go from raw public orbital data to something you can see and understand. I wanted to build the
            whole chain myself: from a handful of numbers published online to a satellite moving over a
            world map and inside Google Earth.</p>
          `,
        },
        {
          title: "What it does, in plain words",
          body: `
            <ol class="steps">
              <li><strong>Reads the orbit.</strong> <a href="https://celestrak.org" target="_blank" rel="noopener">CelesTrak</a>
                publishes, for every tracked satellite, a few numbers describing its orbit: its size, its shape,
                its tilt and where the satellite was at a given instant.</li>
              <li><strong>Moves the satellite forward in time.</strong> Using Kepler's laws (the same physics that
                describes planets around the Sun) it computes the satellite's position every 5 seconds for a whole day.</li>
              <li><strong>Lets the Earth turn underneath.</strong> While the satellite flies, the planet rotates.
                Taking that into account gives the point on the ground directly below the satellite (latitude and longitude).</li>
              <li><strong>Shows the results.</strong> Maps, speed charts and Google Earth files where anyone can watch
                the four satellites move in 3D.</li>
            </ol>
          `,
        },
        {
          title: "Four satellites, four ways to orbit",
          body: `
            <p>I chose one satellite from each of the main orbital regimes, so they can be compared side by side.
            The coloured dot matches the colour used in the charts below.</p>
            <ul class="sat-grid">
              <li class="sat-card">
                <p class="sat-card__name"><span class="sat-dot" style="--dot:#1f77b4"></span>PULSAR-0</p>
                <p class="sat-card__regime">LEO · Low Earth Orbit</p>
                <dl>
                  <div><dt>Altitude</dt><dd>≈ 500 km</dd></div>
                  <div><dt>One orbit</dt><dd>1 h 35 min</dd></div>
                </dl>
                <p>Close to Earth and passing over the poles. This is the regime of Earth-observation satellites.</p>
              </li>
              <li class="sat-card">
                <p class="sat-card__name"><span class="sat-dot" style="--dot:#ff7f0e"></span>Galileo 29</p>
                <p class="sat-card__regime">MEO · Medium Earth Orbit</p>
                <dl>
                  <div><dt>Altitude</dt><dd>≈ 23,220 km</dd></div>
                  <div><dt>One orbit</dt><dd>14 h 05 min</dd></div>
                </dl>
                <p>Part of Galileo, Europe's satellite navigation system (the "European GPS").</p>
              </li>
              <li class="sat-card">
                <p class="sat-card__name"><span class="sat-dot" style="--dot:#2ca02c"></span>SES-5</p>
                <p class="sat-card__regime">GEO · Geostationary</p>
                <dl>
                  <div><dt>Altitude</dt><dd>≈ 35,790 km</dd></div>
                  <div><dt>One orbit</dt><dd>23 h 56 min</dd></div>
                </dl>
                <p>Turns exactly as fast as the Earth, so it hangs over the same spot (≈ 5° E). Ideal for TV and communications.</p>
              </li>
              <li class="sat-card">
                <p class="sat-card__name"><span class="sat-dot" style="--dot:#d62728"></span>QZS-2 (Michibiki-2)</p>
                <p class="sat-card__regime">IGSO · Inclined geosynchronous</p>
                <dl>
                  <div><dt>Altitude</dt><dd>32,650–38,930 km</dd></div>
                  <div><dt>One orbit</dt><dd>23 h 56 min</dd></div>
                </dl>
                <p>Part of Japan's QZSS navigation system. Its tilted, slightly stretched orbit keeps it high over Japan for hours.</p>
              </li>
            </ul>
          `,
        },
        {
          title: "Reading the map: ground tracks",
          body: `
            <figure class="figure">
              <a href="img/ground_tracks.png" target="_blank" rel="noopener" class="figure__link">
                <img src="img/ground_tracks.png" width="2017" height="1092" loading="lazy"
                     alt="Ground tracks over 24 hours. Blue: many pole-to-pole stripes. Orange: a wide wave between 55° north and south. Green: a single point near 5° east. Red: a figure-eight over Asia and Oceania.">
              </a>
              <figcaption>Ground tracks over 24 hours (10 Nov 2026, UTC). Click to open at full size.</figcaption>
            </figure>
            <p>A <strong>ground track</strong> is the line drawn on the map by the point directly below the satellite.
            The same day of simulation gives four completely different pictures:</p>
            <ul class="legend-list">
              <li><span class="sat-dot" style="--dot:#1f77b4"></span><span><strong>Blue (low orbit):</strong> about 15 laps a day.
                During each lap the Earth turns ~24° underneath, so every pass lands further west. Over a day it
                covers almost the whole planet, which is exactly why Earth-observation satellites fly there.</span></li>
              <li><span class="sat-dot" style="--dot:#ff7f0e"></span><span><strong>Orange (Galileo):</strong> a slow, wide wave reaching
                55° north and south. Higher up, each satellite sees a huge part of the Earth, so a few dozen of them
                are enough to cover the whole world with navigation signals.</span></li>
              <li><span class="sat-dot" style="--dot:#2ca02c"></span><span><strong>Green (geostationary):</strong> look closely near
                0° latitude, 5° east: it is just a dot. The satellite never moves relative to the ground, which is why
                satellite dishes can stay pointed at a fixed spot in the sky.</span></li>
              <li><span class="sat-dot" style="--dot:#d62728"></span><span><strong>Red (QZS-2):</strong> a figure-eight. Same period as the
                geostationary one, but its orbit is tilted, so it swings north and south. The small northern loop is
                where it moves slowest: that is where it lingers, high in the sky over Japan, where tall buildings and
                mountains would otherwise block the signals of lower satellites.</span></li>
            </ul>
          `,
        },
        {
          title: "Closer means faster: orbital speed",
          body: `
            <figure class="figure">
              <a href="img/velocity_timeseries.png" target="_blank" rel="noopener" class="figure__link">
                <img src="img/velocity_timeseries.png" width="1998" height="1738" loading="lazy"
                     alt="Four speed-versus-time charts over 24 hours. PULSAR-0 around 7.61 km/s, Galileo around 3.67 km/s, SES-5 around 3.07 km/s, and QZS-2 varying between 2.85 and 3.31 km/s.">
              </a>
              <figcaption>Speed of each satellite over the same 24 hours. Click to open at full size.</figcaption>
            </figure>
            <p>The lower the orbit, the faster a satellite must fly to avoid falling back to Earth:</p>
            <ul class="speed-list">
              <li><span>Low orbit (PULSAR-0)</span><strong>7.6 km/s</strong><em>≈ 27,400 km/h, it crosses Spain in about two minutes</em></li>
              <li><span>Galileo</span><strong>3.67 km/s</strong><em>≈ 13,200 km/h</em></li>
              <li><span>Geostationary (SES-5)</span><strong>3.07 km/s</strong><em>≈ 11,100 km/h</em></li>
              <li><span>QZS-2</span><strong>2.85 → 3.31 km/s</strong><em>speeds up and slows down every day</em></li>
            </ul>
            <p class="callout"><strong>Careful with the axes:</strong> the first three curves look wavy, but they change by
            less than 0.01 km/s, because those orbits are almost perfect circles. Only QZS-2 really changes speed: its
            orbit is slightly stretched, so it speeds up when it is closer to Earth and slows down when it is farther
            away, just as Kepler described for the planets four centuries ago.</p>
          `,
        },
        {
          title: "What is this useful for?",
          body: `
            <ul>
              <li><strong>Mission planning:</strong> knowing when a satellite will pass over a ground station tells you
                when you can talk to it.</li>
              <li><strong>Choosing an orbit:</strong> each regime is a trade-off between coverage, delay and how many
                satellites you need. Seeing them side by side makes that trade-off obvious.</li>
              <li><strong>Satellite navigation:</strong> knowing where the satellites are is the first step to working out
                which ones your receiver can see and how accurate your position will be. My follow-up project,
                <a href="project.html?id=galileo-vs-starlink-madrid">Galileo vs Starlink</a>, takes that step from Madrid.</li>
            </ul>
          `,
        },
        {
          title: "Honest limitations",
          body: `
            <p>This is an educational model, not a precision orbit predictor. It uses simplified physics: the Earth as a
            perfect sphere with all its mass at the centre, no air drag, and no pull from the Sun or the Moon.
            That works well for a single day, but errors grow over longer periods. A natural next step is to compare it
            against SGP4, the standard model used with this data, and measure the difference.</p>
          `,
        },
        {
          title: "What I learned",
          body: `
            <ul>
              <li>How the orbital data published by CelesTrak maps to the classical orbital elements, and why the age of that data matters.</li>
              <li>Solving Kepler's equation numerically and moving from a space-fixed frame to an Earth-fixed one.</li>
              <li>Reading ground tracks: why GEO is a point, IGSO a figure-eight and LEO a set of westward-shifting passes.</li>
              <li>Exporting trajectories to KML to visualise them in Google Earth.</li>
            </ul>
          `,
        },
      ],
    },
  },

  {
    id: "galileo-vs-starlink-madrid",
    status: "done",
    title: "Galileo vs Starlink · Madrid's sky in real time",
    meta: "Personal project · follow-up to Satellite Orbit Explorer",
    summary:
      "Live CelesTrak data for Galileo (MEO) and Starlink (LEO) satellites, propagated over 24 hours and " +
      "seen from Madrid: a 3D globe with lines of sight, a sky plot and the list of every pass.",
    // Card cover: Madrid's sky drawn from the real azimuth/elevation data
    image: {
      src: "img/galileo-vs-starlink/cover.webp",
      alt: "Madrid's sky as a circle seen from below: the short, criss-crossing passes of two Starlink satellites and the slow arcs of two Galileo satellites over one day.",
      width: 1600,
      height: 900,
    },
    tech: ["Python", "Matplotlib", "CelesTrak API", "CesiumJS", "Canvas"],
    repo: "https://github.com/antonio-palmero/galileo-vs-starlink-madrid",
    demo: "orbits.html?project=galileo-vs-starlink-madrid",
    dataset: "galileo-vs-starlink-madrid",
    related: [{ id: "satellite-orbit-explorer", label: "Built on top of" }],

    details: {
      tagline: "How do two very different constellations look from the same place on Earth?",
      demoLabel: "Launch Madrid's sky in 3D",
      demoHint:
        "The data is recomputed every hour, so it opens at the current time and plays at ×300. " +
        "Press Now for real time, drag the time bar, switch frames and watch the sky plot follow the clock",
      facts: "data",

      sections: [
        {
          title: "Overview",
          body: `
            <p>Galileo and Starlink both cross the sky above us, but they live in very different orbits.
            This project downloads today's orbital data from
            <a href="https://celestrak.org" target="_blank" rel="noopener">CelesTrak</a>, picks two
            <strong>Galileo</strong> satellites (medium Earth orbit) and two <strong>Starlink</strong>
            satellites (low Earth orbit), propagates their orbits over the next day and compares what an
            observer in <strong>Madrid</strong> sees: how often each one rises, how long it stays above
            the horizon and how high it climbs.</p>
            <p>It reuses the orbit engine of my
            <a href="project.html?id=satellite-orbit-explorer">Satellite Orbit Explorer</a> and adds the
            observer's point of view.</p>
          `,
        },
        {
          title: "What it shows",
          body: `
            <p><strong>Starlink</strong> satellites race across Madrid's sky in a few minutes, several times
            a day, and most passes stay low. <strong>Galileo</strong> satellites move slowly and stay up for
            hours: that is why a GNSS receiver always has several of them in view.</p>
            <figure class="figure">
              <a href="img/galileo-vs-starlink/elevation_madrid.webp" target="_blank" rel="noopener" class="figure__link">
                <img src="img/galileo-vs-starlink/elevation_madrid.webp" width="2379" height="1283" loading="lazy"
                     alt="Two charts of elevation over Madrid during one day. Top, Galileo: two long, smooth curves lasting hours. Bottom, Starlink: many narrow spikes a few minutes wide, most of them low, a few climbing high.">
              </a>
              <figcaption>Elevation of each satellite seen from Madrid over the data window; the dashed line is
              the elevation mask. Click to open at full size.</figcaption>
            </figure>
            <figure class="figure">
              <a href="img/galileo-vs-starlink/skyplot_madrid.webp" target="_blank" rel="noopener" class="figure__link">
                <img src="img/galileo-vs-starlink/skyplot_madrid.webp" width="1295" height="1482" loading="lazy"
                     alt="Sky plot over Madrid: many straight Starlink tracks crossing the whole sky, and two short, curved Galileo arcs.">
              </a>
              <figcaption>Sky plot: north up, zenith in the centre, horizon at the edge; the dashed circle is the
              elevation mask and the dots mark the position when the data was computed.</figcaption>
            </figure>
          `,
        },
        {
          title: "LEO vs MEO, in numbers",
          body: `<p>Same observer, same day, two kinds of orbit. Every figure below is computed from the
            exported data.</p>`,
          data: "comparison",
        },
        {
          title: "Every pass over Madrid",
          data: "passes",
        },
        {
          title: "Method",
          body: `
            <ol class="steps">
              <li><strong>Live orbital data.</strong> GP records (OMM JSON) for the GALILEO and STARLINK
                groups from CelesTrak, cached for 2 hours because CelesTrak asks users not to poll more
                often. The satellites are taken from each constellation's operational shell.</li>
              <li><strong>Propagation.</strong> Two-body Keplerian orbits over a window that starts when the
                script runs, the same model as Satellite Orbit Explorer.</li>
              <li><strong>Seen from Madrid.</strong> Every position is turned into azimuth and elevation in
                Madrid's local frame (east, north, up).</li>
              <li><strong>Passes.</strong> A satellite counts as visible above a 10° elevation mask, which
                leaves out the lowest part of the sky, where buildings and terrain usually block the view.
                Each crossing of the mask gives a pass: rise, set, duration and maximum elevation.</li>
              <li><strong>Web export.</strong> Earth-fixed and inertial positions, azimuth/elevation and passes
                go into one data file that this page and the 3D viewer read directly.</li>
              <li><strong>Always up to date.</strong> A scheduled GitHub Actions job runs the Python script
                every hour and republishes this page, its figures and the 3D viewer, so the 24-hour window
                always starts within the last hour. The script's 2-hour cache is kept between runs, so
                CelesTrak is never asked more often than it allows.</li>
            </ol>
          `,
        },
        {
          title: "Limitations",
          body: `<p>This is an educational model, not a precise orbit predictor. Low satellites such as
            Starlink feel atmospheric drag and manoeuvre often, so the prediction is only meaningful
            for the day the data was computed.</p>`,
          data: "limitations",
        },
        {
          title: "Tech stack",
          body: `
            <ul>
              <li><strong>Python</strong> with <code>requests</code> for the CelesTrak API and
                <strong>Matplotlib</strong> for the plots.</li>
              <li><strong>CesiumJS</strong> for the 3D globe, the timeline and the lines of sight.</li>
              <li><strong>HTML Canvas</strong> for the sky plot, synced with the viewer's clock.</li>
              <li>Plain <strong>HTML, CSS and JavaScript</strong>: no framework, no build step.</li>
            </ul>
          `,
        },
      ],
    },
  },
];
