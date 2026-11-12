/* =========================================================
   3D orbit viewer (orbits.html) – CesiumJS
   Data: data/orbits_web.js (window.ORBITS_WEB_DATA), exported by
   export_web_json() in the Python project (positions every 60 s in
   ECEF and ECI, in km).

     1. Helpers: GMST and the Earth-rotation matrix (same model as Python)
     2. Load the data and create the Cesium viewer (no ion token)
     3. Clock and timeline: the 24-hour window
     4. Satellites (Earth-fixed) and inertial orbit rings
     5. Earth-fixed / inertial switch
     6. Panel: play/pause, speed, clock, legend
   ========================================================= */

(async function () {
  "use strict";

  const statusEl = document.getElementById("viewer-status");
  const panel = document.getElementById("viewer-panel");

  function showError(message) {
    statusEl.textContent = message;
    statusEl.classList.add("is-error");
  }

  // Opened straight from disk (file://)? Browsers forbid the background workers Cesium needs
  // to build the globe, so explain what to do instead of showing a half-working viewer.
  if (location.protocol === "file:") {
    showError(
      "The 3D viewer needs to be served over http: open the portfolio with Live Server " +
      "(right-click index.html → Open with Live Server) or visit the published site."
    );
    return;
  }

  if (typeof Cesium === "undefined") {
    showError("The 3D library could not be loaded. Check your connection and reload the page.");
    return;
  }

  /* ---------- 1. HELPERS ---------- */

  // GMST (IAU-1982, Meeus eq. 12.4): exactly the same formula as gmst_rad() in Python.
  // Time is taken as plain UTC milliseconds (like Python's datetime, no leap seconds)
  // so both sides give the same angle.
  const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

  function gmstRad(julianDate) {
    const d = (Cesium.JulianDate.toDate(julianDate).getTime() - J2000_MS) / 86400000; // days since J2000
    const T = d / 36525;                                                              // Julian centuries
    let theta = (280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - (T * T * T) / 38710000) % 360;
    if (theta < 0) theta += 360;
    return Cesium.Math.toRadians(theta);
  }

  // Rotation inertial -> Earth-fixed: r_ecef = R3(θ) · r_eci (step 5 of propagate() in Python).
  //   [ cosθ  sinθ  0 ]
  //   [-sinθ  cosθ  0 ]   written row by row with fromRowMajorArray
  //   [  0     0    1 ]
  function fixedFromInertial(julianDate, result) {
    const th = gmstRad(julianDate);
    const c = Math.cos(th);
    const s = Math.sin(th);
    return Cesium.Matrix3.fromRowMajorArray([c, s, 0, -s, c, 0, 0, 0, 1], result);
  }

  const km = ([x, y, z]) => new Cesium.Cartesian3(x * 1000, y * 1000, z * 1000); // km -> m

  function escapeHTML(text) {
    return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  // Plain-language explanation of each orbital regime (legend + info box)
  const REGIMES = {
    LEO: { label: "LEO · Low Earth orbit", text: "About 15 laps a day. Each pass lands further west because the Earth turns underneath." },
    MEO: { label: "MEO · Medium Earth orbit", text: "Galileo's altitude. A slow, wide wave between 55° north and south." },
    GEO: { label: "GEO · Geostationary", text: "Turns exactly with the Earth, so it stays over the same point (≈ 5° E)." },
    IGSO: { label: "IGSO · Inclined geosynchronous", text: "Same period as GEO but tilted, so it draws a figure-eight over Asia and Oceania." },
  };

  const FRAME_TEXT = {
    ecef:
      "Earth-fixed view: the camera turns with the Earth and each line is the path relative to the ground " +
      "(one orbit back, one ahead). GEO stays on a fixed point, IGSO draws a figure-eight and LEO passes shift west on every lap.",
    inertial:
      "Inertial view: the camera stays fixed to the stars while the Earth spins underneath. Each line is now the true orbit, " +
      "a closed ellipse: a small ring for LEO, a medium one for Galileo and two large rings for GEO (equatorial) and IGSO (tilted 39°).",
  };


  /* ---------- 2. DATA + VIEWER ---------- */
  // data/orbits_web.js (written by export_web_json() in Python) defines window.ORBITS_WEB_DATA
  const data = window.ORBITS_WEB_DATA;
  if (!data || !Array.isArray(data.satellites)) {
    showError("The orbit data file (data/orbits_web.js) is missing.");
    return;
  }

  const viewer = new Cesium.Viewer("cesium", {
    // Imagery: Natural Earth II, a low-resolution world texture included in the Cesium build.
    // Using it instead of the default (Bing via Cesium ion) means no access token is needed.
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(
      Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"))
    ),
    baseLayerPicker: false,     // the layer picker offers ion layers
    geocoder: false,            // place search uses ion
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,           // replaced by our own play/speed controls (better on mobile)
    timeline: true,             // the time bar along the bottom
    homeButton: true,
    fullscreenButton: true,
    infoBox: true,              // shows the description when a satellite is clicked
    selectionIndicator: true,
  });

  const scene = viewer.scene;
  // No day/night shading: realistic, but the night side turns black and hides the map
  scene.globe.enableLighting = false;
  scene.screenSpaceCameraController.maximumZoomDistance = 5.0e8;


  /* ---------- 3. CLOCK + TIMELINE ---------- */
  const start = Cesium.JulianDate.fromIso8601(data.start_utc);
  const stop = Cesium.JulianDate.addSeconds(start, (data.n_points - 1) * data.step_s, new Cesium.JulianDate());
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clock = viewer.clock;
  clock.startTime = start.clone();
  clock.stopTime = stop.clone();
  clock.currentTime = start.clone();
  clock.clockRange = Cesium.ClockRange.LOOP_STOP;          // loop the 24 hours
  clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
  clock.multiplier = 300;                                  // 5 simulated minutes per real second
  clock.shouldAnimate = !reduceMotion;
  viewer.timeline.zoomTo(start, stop);

  // Sample times shared by every satellite: start + k·step
  const sampleTimes = Array.from({ length: data.n_points }, (_, k) =>
    Cesium.JulianDate.addSeconds(start, k * data.step_s, new Cesium.JulianDate())
  );


  /* ---------- 4. SATELLITES + INERTIAL RINGS ---------- */
  // Rings live in a PolylineCollection whose points are fixed in ECI; every frame we only
  // update its modelMatrix with the Earth rotation. Cheap, and exact with respect to the model.
  const rings = scene.primitives.add(new Cesium.PolylineCollection());
  rings.show = false;

  const satellites = data.satellites.map((sat) => {
    const color = Cesium.Color.fromCssColorString(sat.color);
    const periodS = sat.period_h * 3600;

    // Earth-fixed positions: Cesium interpolates between the 60 s samples
    const position = new Cesium.SampledPositionProperty(Cesium.ReferenceFrame.FIXED);
    position.setInterpolationOptions({
      interpolationDegree: 5,
      interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
    });
    position.addSamples(sampleTimes, sat.ecef.map(km));

    const entity = viewer.entities.add({
      id: `sat-${sat.norad_id}`,
      name: sat.name,
      availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({ start, stop })]),
      position,
      description: describe(sat),
      point: { pixelSize: 10, color, outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
      label: {
        text: sat.name.replace(/\s*\(.*\)$/, ""),   // "QZS-2 (MICHIBIKI-2)" -> "QZS-2"
        font: "600 13px Inter, system-ui, sans-serif",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        pixelOffset: new Cesium.Cartesian2(12, 0),
      },
      // Path drawn in the frame of its position (FIXED): the trace relative to the ground
      path: {
        leadTime: periodS,
        trailTime: periodS,
        resolution: data.step_s,
        width: 2,
        material: color,
      },
    });

    // One full orbit in ECI (two-body: the ellipse does not change), closed with loop
    const nOrbit = Math.min(sat.eci.length, Math.ceil(periodS / data.step_s) + 1);
    rings.add({
      positions: sat.eci.slice(0, nOrbit).map(km),
      width: 2,
      loop: true,
      material: Cesium.Material.fromType("Color", { color }),
    });

    return { sat, entity, color };
  });

  function describe(sat) {
    const r = REGIMES[sat.regime];
    const rows = [
      ["Orbit", r.label],
      ["NORAD ID", sat.norad_id],
      ["Period", `${sat.period_h.toFixed(3)} h`],
      ["Perigee altitude", `${sat.perigee_km.toLocaleString("en")} km`],
      ["Apogee altitude", `${sat.apogee_km.toLocaleString("en")} km`],
      ["Inclination", `${sat.i_deg}°`],
      ["Eccentricity", sat.e],
    ];
    return `<p>${escapeHTML(r.text)}</p>
      <table class="cesium-infoBox-defaultTable"><tbody>
        ${rows.map(([k, v]) => `<tr><th>${escapeHTML(k)}</th><td>${escapeHTML(v)}</td></tr>`).join("")}
      </tbody></table>
      <p><small>${escapeHTML(data.model_note)}</small></p>`;
  }


  /* ---------- 5. EARTH-FIXED / INERTIAL ---------- */
  let frame = "ecef";
  const rot3 = new Cesium.Matrix3();
  const rot3T = new Cesium.Matrix3();
  const rot4 = new Cesium.Matrix4();
  const scratchOffset = new Cesium.Cartesian3();
  // Initial view: over 60° E (SES-5 at 5° E clear of the panel, QZS-2 over Japan still visible),
  // 170,000 km away so the whole GEO ring (radius 42,164 km) fits on screen
  const HOME = Cesium.Cartesian3.fromDegrees(60, 15, 1.7e8);

  function updateInertialMatrix(time) {
    fixedFromInertial(time, rot3);
    Cesium.Matrix4.fromRotationTranslation(rot3, Cesium.Cartesian3.ZERO, rot4);
  }

  // Express a point given in Earth-fixed coordinates in the inertial frame (R^T · p)
  function toInertial(fixedPoint, result) {
    Cesium.Matrix3.transpose(rot3, rot3T);
    return Cesium.Matrix3.multiplyByVector(rot3T, fixedPoint, result);
  }

  // Every frame, before drawing: rotate the rings and (in inertial mode) carry the camera
  // with the stars. This is the pattern of Cesium's ICRF example, with our own GMST rotation.
  scene.postUpdate.addEventListener((_scene, time) => {
    if (frame !== "inertial") return;
    updateInertialMatrix(time);
    rings.modelMatrix = rot4;
    const offset = Cesium.Cartesian3.clone(viewer.camera.position, scratchOffset);
    viewer.camera.lookAtTransform(rot4, offset);
  });

  function setFrame(next) {
    if (next === frame) return;
    const camera = viewer.camera;
    const worldPosition = Cesium.Cartesian3.clone(camera.positionWC);
    frame = next;

    if (frame === "inertial") {
      updateInertialMatrix(clock.currentTime);
      rings.modelMatrix = rot4;
      // Same place on screen: convert the camera position into the inertial frame first
      camera.lookAtTransform(rot4, toInertial(worldPosition, new Cesium.Cartesian3()));
    } else {
      camera.lookAtTransform(Cesium.Matrix4.IDENTITY, worldPosition);
    }

    rings.show = frame === "inertial";
    satellites.forEach(({ entity }) => (entity.path.show = frame === "ecef"));

    document.querySelectorAll("[data-frame]").forEach((btn) =>
      btn.setAttribute("aria-pressed", String(btn.dataset.frame === frame))
    );
    document.getElementById("frame-explain").textContent = FRAME_TEXT[frame];
  }

  function goHome() {
    if (frame === "inertial") {
      updateInertialMatrix(clock.currentTime);
      viewer.camera.lookAtTransform(rot4, toInertial(HOME, new Cesium.Cartesian3()));
    } else {
      viewer.camera.flyTo({ destination: HOME, duration: 1.2 });
    }
  }

  viewer.camera.setView({ destination: HOME });
  viewer.homeButton.viewModel.command.beforeExecute.addEventListener((event) => {
    event.cancel = true;   // replace Cesium's default home view with ours
    goHome();
  });

  document.querySelectorAll("[data-frame]").forEach((btn) =>
    btn.addEventListener("click", () => setFrame(btn.dataset.frame))
  );


  /* ---------- 6. PANEL ---------- */
  const playBtn = document.getElementById("play-btn");
  const playIcon = document.getElementById("play-icon");
  const playLabel = document.getElementById("play-label");
  const speedSelect = document.getElementById("speed-select");
  const clockReadout = document.getElementById("clock-readout");
  const legend = document.getElementById("legend");

  function syncPlayButton() {
    const playing = clock.shouldAnimate;
    playBtn.setAttribute("aria-pressed", String(playing));
    playIcon.textContent = playing ? "❚❚" : "▶";
    playLabel.textContent = playing ? "Pause" : "Play";
  }

  playBtn.addEventListener("click", () => {
    clock.shouldAnimate = !clock.shouldAnimate;
    syncPlayButton();
  });

  speedSelect.addEventListener("change", () => {
    clock.multiplier = Number(speedSelect.value);
  });

  // Legend: one button per satellite (selects it and opens its info box) + live altitude
  legend.innerHTML = satellites
    .map(({ sat }) => `
      <li>
        <button type="button" class="legend__item" data-sat="sat-${sat.norad_id}">
          <span class="sat-dot" style="--dot:${sat.color}"></span>
          <span class="legend__text">
            <strong>${escapeHTML(sat.name.replace(/\s*\(.*\)$/, ""))}</strong>
            <span class="legend__regime">${escapeHTML(sat.regime)}</span>
            <span class="legend__alt" data-alt="sat-${sat.norad_id}">—</span>
            <span class="legend__desc">${escapeHTML(REGIMES[sat.regime].text)}</span>
          </span>
        </button>
      </li>`)
    .join("");

  legend.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sat]");
    if (button) viewer.selectedEntity = viewer.entities.getById(button.dataset.sat);
  });

  document.getElementById("model-note").textContent =
    `${data.model_note} The inertial view rotates the Earth-fixed data back by GMST (no precession or nutation), ` +
    "so it matches ICRF to within about 0.3°.";
  document.getElementById("frame-explain").textContent = FRAME_TEXT.ecef;

  // Clock readout and altitudes, refreshed 4 times per second (not every frame)
  const altitudeEls = new Map(
    [...legend.querySelectorAll("[data-alt]")].map((el) => [el.dataset.alt, el])
  );
  const scratchPos = new Cesium.Cartesian3();
  let lastRefresh = 0;

  clock.onTick.addEventListener((c) => {
    const now = performance.now();
    if (now - lastRefresh < 250) return;
    lastRefresh = now;

    clockReadout.textContent = Cesium.JulianDate.toIso8601(c.currentTime, 0).replace("T", " ").replace("Z", "");
    clockReadout.dateTime = Cesium.JulianDate.toIso8601(c.currentTime, 0);

    satellites.forEach(({ entity }) => {
      const p = entity.position.getValue(c.currentTime, scratchPos);
      if (!p) return;
      const altKm = Cesium.Cartesian3.magnitude(p) / 1000 - data.earth_radius_km;  // spherical Earth, as in Python
      altitudeEls.get(entity.id).textContent = `alt ${Math.round(altKm).toLocaleString("en")} km`;
    });

    if (playBtn.getAttribute("aria-pressed") !== String(c.shouldAnimate)) syncPlayButton();
  });

  // Phones: start with the legend folded so the globe is visible
  if (window.matchMedia("(max-width: 600px)").matches) {
    panel.querySelector("details").open = false;
  }

  // Shareable link straight to the inertial view: orbits.html?frame=inertial
  if (new URLSearchParams(location.search).get("frame") === "inertial") setFrame("inertial");

  syncPlayButton();
  panel.hidden = false;
  statusEl.hidden = true;
})();
