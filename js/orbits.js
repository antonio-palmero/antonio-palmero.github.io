/* =========================================================
   3D orbit viewer (orbits.html) – CesiumJS
   Reusable for any project: orbits.html?project=<id> loads
   data/<id>/orbits_web.js (window.ORBITS_WEB_DATA, exported by the
   Python project) and calls initOrbitViewer(data).

   Always used:   ecef / eci positions (km) every step_s seconds
   Only if present in the data:
     observer + satellites[].azel  -> ground marker, lines of sight
                                      and a sky plot synced with the clock

     1. Entry point: pick the project, load its data
     2. Helpers: GMST and Earth rotation (same model as Python), text
     3. initOrbitViewer(data): viewer, clock, satellites, frames, panel
     4. Observer: marker + lines of sight
     5. Sky plot (canvas)
   ========================================================= */

(async function () {
  "use strict";

  const statusEl = document.getElementById("viewer-status");
  const panel = document.getElementById("viewer-panel");

  function showError(message) {
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.add("is-error");
  }

  /* ---------- 1. ENTRY POINT ---------- */

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

  // (the project data is loaded at the end of this file, once every helper below is defined)


  /* ---------- 2. HELPERS ---------- */

  // GMST (IAU-1982, Meeus eq. 12.4): exactly the same formula as gmst_rad() in Python.
  // Time is taken as plain UTC milliseconds (like Python's datetime, no leap seconds).
  function gmstRad(julianDate) {
    const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
    const d = (Cesium.JulianDate.toDate(julianDate).getTime() - J2000_MS) / 86400000;
    const T = d / 36525;
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

  // (lat, lon, alt) on the spherical Earth of the Python model -> ECEF in km
  function sphericalToEcefKm(latDeg, lonDeg, altKm, radiusKm) {
    const lat = Cesium.Math.toRadians(latDeg);
    const lon = Cesium.Math.toRadians(lonDeg);
    const r = radiusKm + altKm;
    return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)];
  }

  function escapeText(text) {
    return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  const shortName = (name) => name.replace(/\s*\(.*\)$/, "");   // "QZS-2 (MICHIBIKI-2)" -> "QZS-2"

  const REGIME_LABELS = {
    LEO: "LEO · Low Earth orbit",
    MEO: "MEO · Medium Earth orbit",
    GEO: "GEO · Geostationary",
    IGSO: "IGSO · Inclined geosynchronous",
  };

  // Plain-language sentence per satellite; every number comes from its own data
  function satelliteText(sat) {
    const inc = Math.round(sat.i_deg);
    switch (sat.regime) {
      case "LEO":
        return `About ${Math.round(24 / sat.period_h)} laps a day. Each pass lands further west because the Earth turns underneath.`;
      case "MEO":
        return `A slow, wide wave between ${inc}° north and south, about ${sat.period_h.toFixed(1)} h per orbit.`;
      case "GEO": {
        const [x, y] = sat.ecef[0];
        const lon = Cesium.Math.toDegrees(Math.atan2(y, x));
        return `Turns exactly with the Earth, so it stays over the same point (≈ ${Math.abs(lon).toFixed(0)}° ${lon >= 0 ? "E" : "W"}).`;
      }
      case "IGSO":
        return `Same period as GEO but tilted ${inc}°, so it draws a figure-eight.`;
      default:
        return "";
    }
  }


  /* ---------- 3. VIEWER ---------- */
  function initOrbitViewer(data, options = {}) {
    const step = data.step_s;
    const nPoints = data.n_points;
    const satellites = data.satellites;
    const observer = data.observer && satellites.every((s) => Array.isArray(s.azel)) ? data.observer : null;

    const viewer = new Cesium.Viewer("cesium", {
      // Natural Earth II: low-resolution world texture shipped inside the Cesium build,
      // so no Cesium ion access token is needed.
      baseLayer: Cesium.ImageryLayer.fromProviderAsync(
        Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"))
      ),
      baseLayerPicker: false,     // the layer picker offers ion layers
      geocoder: false,            // place search uses ion
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,           // replaced by our own play/speed controls (better on mobile)
      timeline: true,
      homeButton: true,
      fullscreenButton: true,
      infoBox: true,
      selectionIndicator: true,
    });

    const scene = viewer.scene;
    // No day/night shading: realistic, but the night side turns black and hides the map
    scene.globe.enableLighting = false;
    scene.screenSpaceCameraController.maximumZoomDistance = 5.0e8;

    /* --- Clock: start "now" if now is inside the data window, otherwise at start_utc --- */
    const start = Cesium.JulianDate.fromIso8601(data.start_utc);
    const stop = Cesium.JulianDate.addSeconds(start, (nPoints - 1) * step, new Cesium.JulianDate());
    const isInWindow = (t) =>
      Cesium.JulianDate.greaterThanOrEquals(t, start) && Cesium.JulianDate.lessThanOrEquals(t, stop);
    const startsLive = isInWindow(Cesium.JulianDate.now());
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const clock = viewer.clock;
    clock.startTime = start.clone();
    clock.stopTime = stop.clone();
    clock.currentTime = startsLive ? Cesium.JulianDate.now() : start.clone();
    clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER;
    // ×300 even when starting "now": in real time (×1) the satellites barely move on screen,
    // so the viewer looked frozen. The "Now" button switches to real time on demand.
    clock.multiplier = 300;
    clock.shouldAnimate = !reduceMotion;
    viewer.timeline.zoomTo(start, stop);

    const sampleTimes = Array.from({ length: nPoints }, (_, k) =>
      Cesium.JulianDate.addSeconds(start, k * step, new Cesium.JulianDate())
    );

    // Elevation / azimuth at any instant, interpolated between samples (null outside the window)
    function lookAngles(sat, time) {
      const t = Cesium.JulianDate.secondsDifference(time, start) / step;
      if (t < 0 || t > nPoints - 1) return null;
      const k = Math.min(Math.floor(t), nPoints - 2);
      const f = t - k;
      const [az0, el0] = sat.azel[k];
      const [az1, el1] = sat.azel[k + 1];
      let dAz = az1 - az0;
      if (dAz > 180) dAz -= 360;           // shortest way round 0°/360°
      if (dAz < -180) dAz += 360;
      return { az: (az0 + dAz * f + 360) % 360, el: el0 + (el1 - el0) * f };
    }

    /* --- Satellites (Earth-fixed) + inertial rings --- */
    // Rings live in a PolylineCollection whose points are fixed in ECI; every frame we only
    // update its modelMatrix with the Earth rotation.
    const rings = scene.primitives.add(new Cesium.PolylineCollection());
    rings.show = false;

    const sats = satellites.map((sat) => {
      const color = Cesium.Color.fromCssColorString(sat.color);
      const periodS = sat.period_h * 3600;

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
          text: shortName(sat.name),
          font: "600 13px Inter, system-ui, sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          pixelOffset: new Cesium.Cartesian2(12, 0),
        },
        // Path drawn in the frame of its position (FIXED): the trace relative to the ground
        path: { leadTime: periodS, trailTime: periodS, resolution: step, width: 2, material: color },
      });

      const nOrbit = Math.min(sat.eci.length, Math.ceil(periodS / step) + 1);
      rings.add({
        positions: sat.eci.slice(0, nOrbit).map(km),
        width: 2,
        loop: true,
        material: Cesium.Material.fromType("Color", { color }),
      });

      return { sat, entity, color };
    });

    function describe(sat) {
      const rows = [
        ["Orbit", REGIME_LABELS[sat.regime] || sat.regime],
        ...(sat.group ? [["Constellation", sat.group]] : []),
        ["NORAD ID", sat.norad_id],
        ["Period", `${sat.period_h.toFixed(3)} h`],
        ["Perigee altitude", `${sat.perigee_km.toLocaleString("en")} km`],
        ["Apogee altitude", `${sat.apogee_km.toLocaleString("en")} km`],
        ["Inclination", `${sat.i_deg}°`],
        ["Eccentricity", sat.e],
        ...(sat.passes ? [["Passes above the mask", sat.passes.length]] : []),
      ];
      return `<p>${escapeText(satelliteText(sat))}</p>
        <table class="cesium-infoBox-defaultTable"><tbody>
          ${rows.map(([k, v]) => `<tr><th>${escapeText(k)}</th><td>${escapeText(v)}</td></tr>`).join("")}
        </tbody></table>
        <p><small>${escapeText(data.model_note)}</small></p>`;
    }

    /* --- Earth-fixed / inertial --- */
    let frame = "ecef";
    const rot3 = new Cesium.Matrix3();
    const rot3T = new Cesium.Matrix3();
    const rot4 = new Cesium.Matrix4();
    const scratchOffset = new Cesium.Cartesian3();

    // Initial view: over the observer if there is one, otherwise over 60° E;
    // far enough to fit the largest orbit in the data
    const maxRadiusKm = Math.max(...satellites.map((s) => Math.max(...s.ecef.map((p) => Math.hypot(...p)))));
    const HOME = Cesium.Cartesian3.fromDegrees(
      observer ? observer.lon_deg : 60,
      observer ? Math.min(observer.lat_deg, 30) : 15,
      maxRadiusKm * 1000 * 4
    );

    function updateInertialMatrix(time) {
      fixedFromInertial(time, rot3);
      Cesium.Matrix4.fromRotationTranslation(rot3, Cesium.Cartesian3.ZERO, rot4);
    }

    function toInertial(fixedPoint, result) {
      Cesium.Matrix3.transpose(rot3, rot3T);
      return Cesium.Matrix3.multiplyByVector(rot3T, fixedPoint, result);
    }

    // Every frame: rotate the rings and (inertial mode) carry the camera with the stars
    scene.postUpdate.addEventListener((_scene, time) => {
      if (frame !== "inertial") return;
      updateInertialMatrix(time);
      rings.modelMatrix = rot4;
      const offset = Cesium.Cartesian3.clone(viewer.camera.position, scratchOffset);
      viewer.camera.lookAtTransform(rot4, offset);
    });

    // Explanations built from the regimes actually present in the data
    const regimesPresent = [...new Set(satellites.map((s) => s.regime))];
    const ECEF_PARTS = {
      GEO: "GEO stays on a fixed point",
      IGSO: "IGSO draws a figure-eight",
      LEO: "LEO passes shift west on every lap",
      MEO: "MEO traces a slow, wide wave",
    };
    const INERTIAL_PARTS = {
      LEO: "a small ring for LEO",
      MEO: "a medium one for MEO",
      GEO: "a large equatorial ring for GEO",
      IGSO: `a large ring tilted ${Math.round(satellites.find((s) => s.regime === "IGSO")?.i_deg ?? 0)}° for IGSO`,
    };
    const losNote = observer
      ? ` Dashed lines join ${observer.name} to every satellite above the ${observer.elevation_mask_deg}° mask.`
      : "";
    const FRAME_TEXT = {
      ecef:
        "Earth-fixed view: the camera turns with the Earth and each line is the path relative to the ground " +
        `(one orbit back, one ahead). ${regimesPresent.map((r) => ECEF_PARTS[r]).filter(Boolean).join(", ")}.${losNote}`,
      inertial:
        "Inertial view: the camera stays fixed to the stars while the Earth spins underneath. " +
        `Each line is now the true orbit, a closed ellipse: ${regimesPresent.map((r) => INERTIAL_PARTS[r]).filter(Boolean).join(", ")}.${losNote}`,
    };

    function setFrame(next) {
      if (next === frame) return;
      const camera = viewer.camera;
      const worldPosition = Cesium.Cartesian3.clone(camera.positionWC);
      frame = next;

      if (frame === "inertial") {
        updateInertialMatrix(clock.currentTime);
        rings.modelMatrix = rot4;
        camera.lookAtTransform(rot4, toInertial(worldPosition, new Cesium.Cartesian3()));
      } else {
        camera.lookAtTransform(Cesium.Matrix4.IDENTITY, worldPosition);
      }

      rings.show = frame === "inertial";
      sats.forEach(({ entity }) => (entity.path.show = frame === "ecef"));
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
      event.cancel = true;
      goHome();
    });
    document.querySelectorAll("[data-frame]").forEach((btn) =>
      btn.addEventListener("click", () => setFrame(btn.dataset.frame))
    );

    /* --- 4. Observer: marker + lines of sight --- */
    if (observer) {
      const obsPos = km(sphericalToEcefKm(observer.lat_deg, observer.lon_deg, observer.alt_km, data.earth_radius_km));
      viewer.entities.add({
        id: "observer",
        name: observer.name,
        position: obsPos,
        description: `<p>Observer: ${escapeText(observer.name)} (${observer.lat_deg}°, ${observer.lon_deg}°).
          Satellites count as visible above ${observer.elevation_mask_deg}° of elevation.</p>`,
        point: { pixelSize: 9, color: Cesium.Color.WHITE, outlineColor: Cesium.Color.fromCssColorString("#8db8ff"), outlineWidth: 3 },
        label: {
          text: observer.name,
          font: "600 13px Inter, system-ui, sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
          pixelOffset: new Cesium.Cartesian2(-10, 0),
        },
      });

      sats.forEach(({ sat, entity, color }) => {
        viewer.entities.add({
          name: `${observer.name} → ${shortName(sat.name)}`,
          description: entity.description,
          polyline: {
            // Straight line through space (ArcType.NONE), not along the ground
            positions: new Cesium.CallbackProperty((time) => {
              const p = entity.position.getValue(time);
              return p ? [obsPos, p] : [];
            }, false),
            show: new Cesium.CallbackProperty((time) => {
              const look = lookAngles(sat, time);
              return Boolean(look && look.el >= observer.elevation_mask_deg);
            }, false),
            arcType: Cesium.ArcType.NONE,
            width: 2,
            material: new Cesium.PolylineDashMaterialProperty({ color: color.withAlpha(0.95), dashLength: 14 }),
          },
        });
      });
    }

    /* --- Panel --- */
    const playBtn = document.getElementById("play-btn");
    const playIcon = document.getElementById("play-icon");
    const playLabel = document.getElementById("play-label");
    const speedSelect = document.getElementById("speed-select");
    const nowBtn = document.getElementById("now-btn");
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

    speedSelect.value = String(clock.multiplier);
    speedSelect.addEventListener("change", () => {
      clock.multiplier = Number(speedSelect.value);
    });

    // "Now" button only when the data window contains the real current time
    if (startsLive) {
      nowBtn.hidden = false;
      nowBtn.addEventListener("click", () => {
        const now = Cesium.JulianDate.now();
        if (!isInWindow(now)) return;
        clock.currentTime = now;
        clock.multiplier = 1;
        speedSelect.value = "1";
        clock.shouldAnimate = true;
        syncPlayButton();
      });
    }

    // Data date, always visible
    const fmt = (jd) => Cesium.JulianDate.toIso8601(jd, 0).replace("T", " ").replace(/:\d\dZ$/, "");
    document.getElementById("data-window").textContent = `${fmt(start)} → ${fmt(stop)} UTC`;
    document.getElementById("data-source").textContent = data.source;

    legend.innerHTML = sats
      .map(({ sat }) => `
        <li>
          <button type="button" class="legend__item" data-sat="sat-${sat.norad_id}">
            <span class="sat-dot" style="--dot:${escapeText(sat.color)}"></span>
            <span class="legend__text">
              <strong>${escapeText(shortName(sat.name))}</strong>
              <span class="legend__regime">${escapeText(sat.group ? `${sat.group} · ${sat.regime}` : sat.regime)}</span>
              <span class="legend__alt" data-live="sat-${sat.norad_id}">—</span>
              <span class="legend__desc">${escapeText(satelliteText(sat))}</span>
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

    /* --- 5. Sky plot --- */
    const skyplot = observer ? createSkyplot(observer, sats, lookAngles, step, start) : null;

    // Live values, refreshed ~8 times per second (not every frame)
    const liveEls = new Map([...legend.querySelectorAll("[data-live]")].map((el) => [el.dataset.live, el]));
    const scratchPos = new Cesium.Cartesian3();
    let lastRefresh = 0;

    clock.onTick.addEventListener((c) => {
      const nowMs = performance.now();
      if (nowMs - lastRefresh < 120) return;
      lastRefresh = nowMs;

      clockReadout.textContent = Cesium.JulianDate.toIso8601(c.currentTime, 0).replace("T", " ").replace("Z", "");
      clockReadout.dateTime = Cesium.JulianDate.toIso8601(c.currentTime, 0);

      sats.forEach(({ sat, entity }) => {
        const el = liveEls.get(entity.id);
        const look = observer ? lookAngles(sat, c.currentTime) : null;
        if (look) {
          const visible = look.el >= observer.elevation_mask_deg;
          el.textContent = `el ${Math.round(look.el)}°`;
          el.classList.toggle("is-visible", visible);
          el.title = visible ? `Visible from ${observer.name}` : `Below the ${observer.elevation_mask_deg}° mask`;
        } else {
          const p = entity.position.getValue(c.currentTime, scratchPos);
          if (!p) return;
          const altKm = Cesium.Cartesian3.magnitude(p) / 1000 - data.earth_radius_km;
          el.textContent = `alt ${Math.round(altKm).toLocaleString("en")} km`;
        }
      });

      skyplot?.draw(c.currentTime);
      if (playBtn.getAttribute("aria-pressed") !== String(c.shouldAnimate)) syncPlayButton();
    });

    // Phones: start with the legend folded so the globe is visible
    if (window.matchMedia("(max-width: 600px)").matches) {
      panel.querySelector(".viewer-panel__legend").open = false;
    }

    if (options.initialFrame === "inertial") setFrame("inertial");
    syncPlayButton();
    panel.hidden = false;
    statusEl.hidden = true;
  }


  /* ---------- 5. SKY PLOT ----------
     Polar view of the observer's sky: azimuth around (north up, east right),
     zenith (90°) in the centre and the horizon (0°) at the edge.
     The static part (grid + full tracks) is drawn once to an off-screen canvas;
     each refresh only copies it and adds the current positions. */
  function createSkyplot(observer, sats, lookAngles, step, start) {
    const box = document.getElementById("skyplot");
    const canvas = document.getElementById("skyplot-canvas");
    const caption = document.getElementById("skyplot-visible");
    const ctx = canvas.getContext("2d");
    const mask = observer.elevation_mask_deg;
    const TRAIL_SAMPLES = Math.round((15 * 60) / step);   // bright trail: last 15 minutes
    let size = 0;
    let background = null;

    document.getElementById("skyplot-title").textContent = `${observer.name}'s sky`;
    box.hidden = false;

    const polar = (az, el, r) => {
      const rr = (r * (90 - el)) / 90;
      const a = (az * Math.PI) / 180;
      return [size / 2 + rr * Math.sin(a), size / 2 - rr * Math.cos(a)];
    };

    function renderBackground() {
      const dpr = window.devicePixelRatio || 1;
      size = canvas.clientWidth;
      canvas.width = canvas.height = Math.round(size * dpr);
      background = document.createElement("canvas");
      background.width = background.height = canvas.width;
      const g = background.getContext("2d");
      g.scale(dpr, dpr);
      const r = size / 2 - 16;
      const c = size / 2;

      g.fillStyle = "rgba(10, 24, 56, 0.9)";
      g.beginPath();
      g.arc(c, c, r, 0, 2 * Math.PI);
      g.fill();

      g.strokeStyle = "rgba(169, 196, 255, 0.25)";
      g.lineWidth = 1;
      for (const el of [0, 30, 60]) {
        g.beginPath();
        g.arc(c, c, (r * (90 - el)) / 90, 0, 2 * Math.PI);
        g.stroke();
      }
      for (let az = 0; az < 360; az += 45) {
        const [x, y] = polar(az, 0, r);
        g.beginPath();
        g.moveTo(c, c);
        g.lineTo(x, y);
        g.stroke();
      }
      // Elevation mask: dashed circle
      g.setLineDash([4, 4]);
      g.strokeStyle = "rgba(169, 196, 255, 0.55)";
      g.beginPath();
      g.arc(c, c, (r * (90 - mask)) / 90, 0, 2 * Math.PI);
      g.stroke();
      g.setLineDash([]);

      g.fillStyle = "#cfe0ff";
      g.font = "600 11px ui-monospace, Consolas, monospace";
      g.textAlign = "center";
      g.textBaseline = "middle";
      // Cardinal points just outside the horizon circle (inside the canvas)
      [["N", 0], ["E", 90], ["S", 180], ["W", 270]].forEach(([label, az]) => {
        const a = (az * Math.PI) / 180;
        g.fillText(label, c + (r + 9) * Math.sin(a), c - (r + 9) * Math.cos(a));
      });

      // Full 24-hour track of each satellite above the horizon (faint)
      g.lineWidth = 1.2;
      sats.forEach(({ sat }) => {
        g.strokeStyle = sat.color;
        g.globalAlpha = 0.35;
        g.beginPath();
        let drawing = false;
        sat.azel.forEach(([az, el]) => {
          if (el < 0) { drawing = false; return; }
          const [x, y] = polar(az, el, r);
          if (drawing) g.lineTo(x, y); else g.moveTo(x, y);
          drawing = true;
        });
        g.stroke();
      });
      g.globalAlpha = 1;
    }

    function draw(time) {
      if (!background || canvas.clientWidth !== size) renderBackground();
      const dpr = window.devicePixelRatio || 1;
      const r = size / 2 - 16;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(background, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const visible = [];
      sats.forEach(({ sat }) => {
        const look = lookAngles(sat, time);
        if (!look || look.el < 0) return;

        // Bright trail: the last 15 minutes of this pass
        const k = Math.floor(Cesium.JulianDate.secondsDifference(time, start) / step);
        ctx.strokeStyle = sat.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        let started = false;
        for (let i = Math.max(0, k - TRAIL_SAMPLES); i <= k; i++) {
          const pt = sat.azel[i];
          if (!pt || pt[1] < 0) { started = false; continue; }
          const [x, y] = polar(pt[0], pt[1], r);
          if (started) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          started = true;
        }
        const [x, y] = polar(look.az, look.el, r);
        if (started) ctx.lineTo(x, y);
        ctx.stroke();

        // Current position
        ctx.fillStyle = sat.color;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        // Name next to the dot, on the side with room (never cut by the canvas edge)
        ctx.fillStyle = "#ffffff";
        ctx.font = "600 10px Inter, system-ui, sans-serif";
        const onRight = x < size / 2;
        ctx.textAlign = onRight ? "left" : "right";
        ctx.fillText(shortName(sat.name), onRight ? x + 8 : x - 8, y - 6);

        if (look.el >= mask) visible.push(`${shortName(sat.name)} ${Math.round(look.el)}°`);
      });

      caption.textContent = visible.length
        ? `Above ${mask}°: ${visible.join(" · ")}`
        : `No satellite above the ${mask}° mask right now`;
    }

    return { draw };
  }
  /* ---------- START: pick the project, load its data, build the viewer ----------
     Placed last so that every helper above (const functions) already exists. */
  const params = new URLSearchParams(location.search);
  const projectId = params.get("project") || "satellite-orbit-explorer";

  let data;
  try {
    data = await loadOrbitData(projectId);   // defined in main.js
  } catch (error) {
    showError("The orbit data for this project could not be loaded.");
    console.error(error);
    return;
  }

  // "Open full page" link (embedded mode) points to the same project
  const fullPage = document.getElementById("fullpage-link");
  if (fullPage) fullPage.href = `orbits.html?project=${encodeURIComponent(projectId)}`;

  initOrbitViewer(data, { initialFrame: params.get("frame") });
})();
