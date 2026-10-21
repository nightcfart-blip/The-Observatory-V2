
"use strict";

(() => {
  // ==========================================================
  // WATCH ARCHIVE — STEP 7
  // APP.JS — PART 1 OF 2
  //
  // Part 2 continues inside this same function.
  // Do not add a closing })(); until Part 2.
  // ==========================================================

  const C = window.SPACE_CONFIG;
  const AC = window.ARCHIVE_CONFIG;
  const STORE = window.WatchArchive;
  const STATS = window.ARCHIVE_STATISTICS;
  const U = window.ArchiveUtil;

  const canvas = document.getElementById("spaceCanvas");

  if (!C || !AC || !STORE || !STATS || !U || !canvas) {
    console.error("Watch Archive: required files are missing.");
    return;
  }

  const ctx = canvas.getContext("2d", { alpha: false });

  if (!ctx) {
    console.error("Watch Archive: canvas is unavailable.");
    return;
  }

  const TAU = Math.PI * 2;
  const SVG_NS = "http://www.w3.org/2000/svg";

  const clamp = (value, min, max) =>
    Math.max(min, Math.min(max, value));

  const lerp = (a, b, t) => a + (b - a) * t;

  const camera = { ...C.camera };
  const scene = { ...C.baseScene };

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const pointers = new Map();
  const nebulaCache = new Map();

  let W = 0;
  let H = 0;
  let DPR = 1;

  let lastFrame = 0;
  let previousTime = 0;
  let sceneTime = 0;

  let pinchState = null;
  let shootingStar = null;
  let nextMeteor = 0;

  let audioCtx = null;
  let masterGain = null;

  let activePanel = null;
  let panelHistory = [];

  let archiveSkyDirty = true;
  let archiveStarSignature = "";
  let archiveSkyNodes = new Map();

  let toastTimer = null;

  // ==========================================================
  // DOM ELEMENTS
  // ==========================================================

  const DOM = {
    constellationLayer:
      document.getElementById("constellationLayer"),

    constellationSvg:
      document.getElementById("constellationSvg"),

    lineABase:
      document.getElementById("lineA-base"),

    lineBBase:
      document.getElementById("lineB-base"),

    lineAGlow:
      document.getElementById("lineA-glow"),

    lineBGlow:
      document.getElementById("lineB-glow"),

    archiveSky:
      document.getElementById("archiveSky"),

    archiveLines:
      document.getElementById("archiveLines"),

    archiveStars:
      document.getElementById("archiveStars"),

    panel:
      document.getElementById("glassPanel"),

    panelTitle:
      document.getElementById("panelTitle"),

    panelEyebrow:
      document.getElementById("panelEyebrow"),

    panelContent:
      document.getElementById("panelContent"),

    panelToolbar:
      document.getElementById("panelToolbar"),

    panelFooter:
      document.getElementById("panelFooter"),

    closePanel:
      document.getElementById("closePanel"),

    homeBtn:
      document.getElementById("homeBtn"),

    toast:
      document.getElementById("toast")
  };

  const navButtons = [
    ...DOM.constellationLayer.querySelectorAll(".nav-star")
  ];

  // ==========================================================
  // NORMA NAVIGATION CONSTELLATION
  // ==========================================================

  const NAV_STARS = [
    {
      panel: "settings",
      x: -290,
      y: -80,
      depth: 1.08,
      size: 11,
      tint: "192,214,255",
      breathe: "7.1s"
    },
    {
      panel: "library",
      x: -160,
      y: -250,
      depth: 1.08,
      size: 14,
      tint: "223,232,255",
      breathe: "8.4s"
    },
    {
      panel: "creation",
      x: 18,
      y: -165,
      depth: 1.08,
      size: 17,
      tint: "178,188,255",
      breathe: "6.8s"
    },
    {
      panel: "watchlist",
      x: 220,
      y: -300,
      depth: 1.08,
      size: 12,
      tint: "184,231,255",
      breathe: "8.9s"
    },
    {
      panel: "statistics",
      x: 150,
      y: 18,
      depth: 1.08,
      size: 13,
      tint: "201,182,255",
      breathe: "7.6s"
    }
  ];

  const NAV_LINES = [
    [0, 1, 2, 3],
    [2, 4, 3]
  ];

  // ==========================================================
  // SETTINGS PERSISTENCE
  // ==========================================================

  try {
    const stored = JSON.parse(
      localStorage.getItem("watchArchiveSpaceSettings") || "{}"
    );

    for (const key of Object.keys(scene)) {
      if (
        typeof stored[key] === "number" &&
        Number.isFinite(stored[key])
      ) {
        scene[key] = stored[key];
      }
    }
  } catch (error) {
    console.warn("Space settings could not be loaded.", error);
  }

  function saveSpaceSettings() {
    try {
      localStorage.setItem(
        "watchArchiveSpaceSettings",
        JSON.stringify(scene)
      );
      return true;
    } catch (error) {
      console.warn("Space settings could not be saved.", error);
      return false;
    }
  }

  // ==========================================================
  // RANDOM GENERATION UTILITIES
  // ==========================================================

  function hash(a, b, salt = 0) {
    let n =
      Math.imul((a | 0) ^ 0x9e3779b1, 374761393) ^
      Math.imul((b | 0) ^ 0x85ebca77, 668265263) ^
      Math.imul((salt + C.seed) | 0, 2246822519);

    n = Math.imul(n ^ (n >>> 13), 1274126177);

    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;

    return () => {
      t += 0x6d2b79f5;

      let s = t;

      s = Math.imul(s ^ (s >>> 15), s | 1);
      s ^= s + Math.imul(s ^ (s >>> 7), s | 61);

      return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFor(x, y, salt = 0) {
    return mulberry32(
      (hash(x, y, salt) * 4294967295) >>> 0
    );
  }

  function choose(array, random) {
    return array[Math.floor(random() * array.length)];
  }

  function rgba(color, opacity) {
    return `rgba(${color[0]},${color[1]},${color[2]},${opacity})`;
  }

  function hexRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);

    return [
      (n >> 16) & 255,
      (n >> 8) & 255,
      n & 255
    ];
  }

  function circle(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
  }

  function svgElement(tag, attributes = {}) {
    const node = document.createElementNS(SVG_NS, tag);

    for (const [key, value] of Object.entries(attributes)) {
      node.setAttribute(key, String(value));
    }

    return node;
  }

  function element(tag, className = "", text = null) {
    const node = document.createElement(tag);

    if (className) node.className = className;

    if (text !== null) {
      node.textContent = String(text);
    }

    return node;
  }

  function formatRating(value) {
    return typeof value === "number" &&
      Number.isFinite(value)
      ? value.toFixed(2).replace(/0$/, "").replace(/\.$/, "") +
        " / 10"
      : "Unrated";
  }

  function formatDuration(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const rest = total % 60;

    if (!hours) return `${rest}m`;
    if (!rest) return `${hours}h`;

    return `${hours}h ${rest}m`;
  }

  function readableDate(value) {
    if (!value) return "Not specified";

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return String(value);
    }

    return parsed.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function showToast(message) {
    if (!DOM.toast) return;

    clearTimeout(toastTimer);

    DOM.toast.textContent = String(message);
    DOM.toast.classList.add("show");

    toastTimer = setTimeout(() => {
      DOM.toast.classList.remove("show");
    }, 3100);
  }

  // ==========================================================
  // CAMERA AND COORDINATES
  // ==========================================================

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;

    DPR = Math.min(
      window.devicePixelRatio || 1,
      C.rendering.maxPixelRatio
    );

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    canvas.style.width = W + "px";
    canvas.style.height = H + "px";

    DOM.constellationSvg.setAttribute(
      "viewBox",
      `0 0 ${W} ${H}`
    );

    DOM.archiveLines.setAttribute(
      "viewBox",
      `0 0 ${W} ${H}`
    );

    archiveSkyDirty = true;
  }

  function project(x, y, depth = 1, scale = camera.zoom) {
    return {
      x: W / 2 + (x - camera.x * depth) * scale,
      y: H / 2 + (y - camera.y * depth) * scale
    };
  }

  function visibleCells(
    size,
    depth = 1,
    scale = camera.zoom,
    margin = 1
  ) {
    const centerX = camera.x * depth;
    const centerY = camera.y * depth;

    const hw = W / (2 * scale);
    const hh = H / (2 * scale);

    const cells = [];

    const minX = Math.floor((centerX - hw) / size) - margin;
    const maxX = Math.ceil((centerX + hw) / size) + margin;
    const minY = Math.floor((centerY - hh) / size) - margin;
    const maxY = Math.ceil((centerY + hh) / size) + margin;

    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        cells.push({ x: cx, y: cy });
      }
    }

    return cells;
  }

  function resetToStart() {
    camera.x = C.startPoint.x;
    camera.y = C.startPoint.y;
    camera.zoom = C.startPoint.zoom;

    archiveSkyDirty = true;
  }

  function focusWorldPoint(x, y, zoom = camera.zoom) {
    camera.x = x;
    camera.y = y;

    camera.zoom = clamp(
      zoom,
      C.camera.minZoom,
      C.camera.maxZoom
    );

    archiveSkyDirty = true;
  }

  // ==========================================================
  // DEEP SPACE BACKGROUND
  // ==========================================================

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);

    gradient.addColorStop(0, C.sky.backgroundTop);
    gradient.addColorStop(1, C.sky.backgroundBottom);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const vignette = ctx.createRadialGradient(
      W * 0.5,
      H * 0.45,
      Math.min(W, H) * 0.1,
      W * 0.5,
      H * 0.5,
      Math.max(W, H) * 0.74
    );

    vignette.addColorStop(0, "rgba(0,0,0,0)");

    vignette.addColorStop(
      1,
      `rgba(0,0,0,${C.sky.vignetteStrength})`
    );

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  // ==========================================================
  // PROCEDURAL NEBULA SPRITES
  // ==========================================================

  function buildNebulaSprite(layerIndex, cellX, cellY) {
    const key = [
      layerIndex,
      cellX,
      cellY,
      scene.nebulaColorVariance.toFixed(2)
    ].join(":");

    if (nebulaCache.has(key)) {
      const cached = nebulaCache.get(key);

      nebulaCache.delete(key);
      nebulaCache.set(key, cached);

      return cached;
    }

    const layer = C.nebulae.layers[layerIndex];

    const rnd = rngFor(
      cellX,
      cellY,
      9137 + layerIndex * 101
    );

    const sprite = document.createElement("canvas");

    sprite.width = 768;
    sprite.height = 768;

    const g = sprite.getContext("2d");
    if (!g) return null;

    const palette = C.nebulae.palette;

    const colors = [
      choose(palette, rnd),
      choose(palette, rnd),
      choose(palette, rnd)
    ];

    function colorize(color) {
      const average =
        (color[0] + color[1] + color[2]) / 3;

      return color.map(value =>
        Math.round(clamp(
          average +
            (value - average) *
            scene.nebulaColorVariance,
          0,
          255
        ))
      );
    }

    function drawCloud(x, y, rx, ry, color, alpha) {
      const radius = Math.max(rx, ry);

      if (radius <= 0) return;

      g.save();
      g.translate(x, y);
      g.scale(rx / radius, ry / radius);

      const gradient = g.createRadialGradient(
        0, 0, 0,
        0, 0, radius
      );

      gradient.addColorStop(0, rgba(color, alpha));
      gradient.addColorStop(
        0.2,
        rgba(color, alpha * 0.72)
      );
      gradient.addColorStop(
        0.55,
        rgba(color, alpha * 0.17)
      );
      gradient.addColorStop(1, rgba(color, 0));

      g.fillStyle = gradient;
      g.beginPath();
      g.arc(0, 0, radius, 0, TAU);
      g.fill();
      g.restore();
    }

    const mx = 330 + rnd() * 110;
    const my = 310 + rnd() * 145;

    const angle = rnd() * TAU;
    const length = 180 + rnd() * 185;
    const shape = Math.floor(rnd() * 4);

    g.globalCompositeOperation = "screen";

    // Diffuse distant gas.
    for (
      let i = 0;
      i < Math.round(18 * layer.diffuse);
      i++
    ) {
      const t = rnd() * 2 - 1;

      drawCloud(
        mx + Math.cos(angle) * length * t +
          (rnd() - 0.5) * 175 * layer.diffuse,

        my + Math.sin(angle) * length * t +
          (rnd() - 0.5) * 150 * layer.diffuse,

        (65 + rnd() * 125) * layer.diffuse,
        (35 + rnd() * 95) * layer.diffuse,

        colorize(choose(colors, rnd)),
        0.025 + rnd() * 0.04
      );
    }

    // Uneven luminous filaments.
    const strands = Math.round(
      (3 + rnd() * 4) * layer.detail
    );

    for (let s = 0; s < strands; s++) {
      const phase = rnd() * TAU;
      const frequency = 1.2 + rnd() * 3;
      const amplitude = 25 + rnd() * 70;

      const tilt = angle + (rnd() - 0.5) * 1.2;
      const thickness =
        (17 + rnd() * 37) * layer.diffuse;

      const offset = (rnd() - 0.5) * 130;
      const color = colorize(choose(colors, rnd));

      const steps = Math.max(
        2,
        Math.round(45 * layer.detail)
      );

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const along = (t - 0.5) * 2 * length;

        const wave = Math.sin(
          t * frequency * TAU + phase
        ) * amplitude;

        const across = offset + wave;

        let x =
          mx + Math.cos(tilt) * along -
          Math.sin(tilt) * across;

        let y =
          my + Math.sin(tilt) * along +
          Math.cos(tilt) * across;

        if (shape === 1) {
          y += Math.sin(t * Math.PI) * 90;
        }

        if (shape === 2) {
          x += Math.cos(t * TAU) * 65;
        }

        if (shape === 3) {
          y += Math.sin(t * TAU * 2) * 40;
        }

        const taper = Math.pow(
          Math.max(0, Math.sin(t * Math.PI)),
          0.8
        );

        drawCloud(
          x + (rnd() - 0.5) * 12,
          y + (rnd() - 0.5) * 12,

          thickness *
            (0.7 + rnd()) * taper + 5,

          thickness *
            (0.4 + rnd() * 0.7) * taper + 4,

          color,
          (0.025 + rnd() * 0.055) * taper
        );
      }
    }

    // Bright knots.
    for (
      let i = 0;
      i < Math.round(20 * layer.detail);
      i++
    ) {
      const t = rnd() * 2 - 1;

      drawCloud(
        mx + Math.cos(angle) * length * t +
          (rnd() - 0.5) * 125,

        my + Math.sin(angle) * length * t +
          (rnd() - 0.5) * 125,

        10 + rnd() * 35,
        8 + rnd() * 30,

        colorize(choose(colors, rnd)),
        0.035 + rnd() * 0.09
      );
    }

    // Carved dark voids.
    g.globalCompositeOperation = "destination-out";

    for (
      let i = 0;
      i < 8 + layer.detail * 7;
      i++
    ) {
      drawCloud(
        mx + (rnd() - 0.5) * length * 1.6,
        my + (rnd() - 0.5) * length * 1.6,

        20 + rnd() * 65,
        12 + rnd() * 48,

        [0, 0, 0],
        0.12 + rnd() * 0.2
      );
    }

    nebulaCache.set(key, sprite);

    while (
      nebulaCache.size > C.rendering.nebulaCacheSize
    ) {
      nebulaCache.delete(
        nebulaCache.keys().next().value
      );
    }

    return sprite;
  }

  function drawNebulaLayer(index, time) {
    const layer = C.nebulae.layers[index];

    const scale = camera.zoom * layer.zoomFactor;

    const drift = reducedMotion
      ? 0
      : Math.sin(
          time * C.nebulae.driftSpeed +
          index * 1.7
        ) * 12 * layer.drift;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (
      const cell of visibleCells(
        layer.cellSize,
        layer.parallax,
        scale,
        2
      )
    ) {
      const rnd = rngFor(
        cell.x,
        cell.y,
        5000 + index * 179
      );

      const probability = clamp(
        layer.density * scene.nebulaFrequency,
        0,
        1
      );

      if (rnd() > probability) continue;

      const wx =
        cell.x * layer.cellSize +
        (rnd() - 0.5) * layer.cellSize * 0.55;

      const wy =
        cell.y * layer.cellSize +
        (rnd() - 0.5) * layer.cellSize * 0.55;

      const size = lerp(
        layer.sizeMin,
        layer.sizeMax,
        rnd()
      ) * scene.nebulaSize * scale;

      const rotation = rnd() * TAU;
      const opacity = 0.55 + rnd() * 0.45;

      const p = project(
        wx,
        wy,
        layer.parallax,
        scale
      );

      if (
        p.x + size < 0 ||
        p.x - size > W ||
        p.y + size < 0 ||
        p.y - size > H
      ) {
        continue;
      }

      const sprite = buildNebulaSprite(
        index,
        cell.x,
        cell.y
      );

      if (!sprite) continue;

      ctx.save();

      ctx.globalAlpha = clamp(
        layer.opacity *
          scene.nebulaBrightness *
          opacity,
        0,
        1
      );

      ctx.translate(
        p.x + drift,
        p.y - drift * 0.35
      );

      ctx.rotate(rotation);

      ctx.drawImage(
        sprite,
        -size / 2,
        -size / 2,
        size,
        size
      );

      ctx.restore();
    }

    ctx.restore();
  }

  // ==========================================================
  // BACKGROUND STAR FIELDS
  // ==========================================================

  function starColor(hex) {
    const color = hexRgb(hex);

    const average =
      (color[0] + color[1] + color[2]) / 3;

    return "rgb(" + color.map(value =>
      Math.round(clamp(
        average +
          (value - average) *
          scene.starsColorVariance,
        0,
        255
      ))
    ).join(",") + ")";
  }

  function drawStar(
    x,
    y,
    radius,
    color,
    alpha,
    glow
  ) {
    if (
      x < -30 ||
      x > W + 30 ||
      y < -30 ||
      y > H + 30
    ) {
      return;
    }

    ctx.save();

    if (glow > 0) {
      const halo = ctx.createRadialGradient(
        x, y, 0,
        x, y, radius * 10
      );

      halo.addColorStop(
        0,
        `rgba(255,255,255,${alpha * 0.3})`
      );

      halo.addColorStop(
        0.25,
        `rgba(140,190,255,${alpha * glow})`
      );

      halo.addColorStop(
        1,
        "rgba(60,100,170,0)"
      );

      ctx.fillStyle = halo;

      circle(x, y, radius * 10);
      ctx.fill();
    }

    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = color;

    circle(x, y, Math.max(0.22, radius));
    ctx.fill();

    if (radius > 1.3) {
      ctx.strokeStyle =
        "rgba(225,240,255,0.13)";

      ctx.lineWidth = 0.5;

      ctx.beginPath();
      ctx.moveTo(x - radius * 5, y);
      ctx.lineTo(x + radius * 5, y);

      ctx.moveTo(x, y - radius * 5);
      ctx.lineTo(x, y + radius * 5);

      ctx.stroke();
    }

    ctx.restore();
  }

  function drawStarLayer(index, time) {
    const layers = [
      {
        count: C.stars.distantCount,
        depth: 0.18,
        factor: 0.58,
        radius: 0.75
      },
      {
        count: C.stars.middleCount,
        depth: 0.48,
        factor: 0.82,
        radius: 1
      },
      {
        count: C.stars.nearCount,
        depth: 1,
        factor: 1,
        radius: 1.14
      }
    ];

    const layer = layers[index];

    const scale =
      camera.zoom * layer.factor;

    const count = Math.max(
      0,
      Math.round(
        layer.count * scene.starsAmount
      )
    );

    for (
      const cell of visibleCells(
        C.stars.cellSize,
        layer.depth,
        scale
      )
    ) {
      const rnd = rngFor(
        cell.x,
        cell.y,
        1300 + index
      );

      for (let i = 0; i < count; i++) {
        const x =
          cell.x * C.stars.cellSize +
          rnd() * C.stars.cellSize;

        const y =
          cell.y * C.stars.cellSize +
          rnd() * C.stars.cellSize;

        const seed = rnd();
        const phase = rnd() * TAU;
        const speed = 0.7 + rnd() * 1.3;
        const brightness = rnd();

        const color = choose(
          C.stars.colors,
          rnd
        );

        const radius =
          index === 0
            ? 0.18 + Math.pow(seed, 4) * 0.76
            : index === 1
              ? 0.28 + Math.pow(seed, 4.5) * 1.55
              : 0.4 + Math.pow(seed, 5.4) * 2.15;

        const twinkle = reducedMotion
          ? 1
          : 1 + Math.sin(
              time *
                C.stars.twinkleSpeed *
                speed +
                phase
            ) * 0.13 * scene.starsTwinkle;

        const alpha =
          (0.17 +
            Math.pow(brightness, 0.42) *
              0.82) *
          scene.starsBrightness *
          twinkle;

        const p = project(
          x,
          y,
          layer.depth,
          scale
        );

        drawStar(
          p.x,
          p.y,

          clamp(
            radius *
              Math.sqrt(scale) *
              layer.radius,
            0.2,
            4.3
          ),

          starColor(color),
          alpha,

          seed > 0.91
            ? 0.08 + rnd() * 0.16
            : 0
        );
      }
    }
  }

  // ==========================================================
  // DISTANT SHOOTING STARS
  // ==========================================================

  function scheduleMeteor(now) {
    if (scene.shootingFrequency <= 0) {
      nextMeteor = Infinity;
      return;
    }

    nextMeteor = now + lerp(
      C.shootingStars.minDelay,
      C.shootingStars.maxDelay,
      Math.random()
    ) / scene.shootingFrequency;
  }

  function drawMeteors(now) {
    if (
      reducedMotion ||
      !C.shootingStars.enabled ||
      scene.shootingFrequency <= 0
    ) {
      return;
    }

    if (!nextMeteor) {
      scheduleMeteor(now);
    }

    if (
      !shootingStar &&
      now > nextMeteor
    ) {
      shootingStar = {
        born: now,
        x: Math.random() * W,
        y: Math.random() * H * 0.65,

        angle: Math.PI * (
          0.12 + Math.random() * 0.18
        ),

        distance: 120 + Math.random() * 200,
        duration: C.shootingStars.duration
      };
    }

    if (!shootingStar) return;

    const s = shootingStar;

    const t =
      (now - s.born) / s.duration;

    if (t >= 1) {
      shootingStar = null;
      scheduleMeteor(now);
      return;
    }

    const progress = t * t * (3 - 2 * t);
    const alpha =
      Math.sin(Math.PI * t) * 0.32;

    const hx =
      s.x +
      Math.cos(s.angle) *
      s.distance *
      progress;

    const hy =
      s.y +
      Math.sin(s.angle) *
      s.distance *
      progress;

    const length = 55 + 75 * (1 - t);

    const tx =
      hx - Math.cos(s.angle) * length;

    const ty =
      hy - Math.sin(s.angle) * length;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const gradient = ctx.createLinearGradient(
      tx,
      ty,
      hx,
      hy
    );

    gradient.addColorStop(
      0,
      "rgba(70,110,180,0)"
    );

    gradient.addColorStop(
      0.7,
      `rgba(135,180,255,${alpha * 0.28})`
    );

    gradient.addColorStop(
      1,
      `rgba(245,250,255,${alpha})`
    );

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.9;

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.restore();
  }

  // ==========================================================
  // AMBIENT SOUND
  // ==========================================================

  function startAmbientAudio() {
    if (!C.ambientAudio.enabled) return;

    if (audioCtx) {
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AC =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AC) return;

      audioCtx = new AC();

      masterGain = audioCtx.createGain();
      masterGain.gain.value =
        scene.ambientVolume;

      masterGain.connect(
        audioCtx.destination
      );

      const buffer = audioCtx.createBuffer(
        1,
        audioCtx.sampleRate * 2,
        audioCtx.sampleRate
      );

      const samples =
        buffer.getChannelData(0);

      for (
        let i = 0;
        i < samples.length;
        i++
      ) {
        samples[i] =
          Math.random() * 2 - 1;
      }

      const noise =
        audioCtx.createBufferSource();

      noise.buffer = buffer;
      noise.loop = true;

      const low =
        audioCtx.createBiquadFilter();

      low.type = "lowpass";
      low.frequency.value = 1600;

      const high =
        audioCtx.createBiquadFilter();

      high.type = "highpass";
      high.frequency.value = 60;

      const noiseGain =
        audioCtx.createGain();

      noiseGain.gain.value = 0.95;

      noise.connect(low);
      low.connect(high);
      high.connect(noiseGain);
      noiseGain.connect(masterGain);

      const hum =
        audioCtx.createGain();

      hum.gain.value = 0.06;
      hum.connect(masterGain);

      for (
        const frequency of [52, 81]
      ) {
        const oscillator =
          audioCtx.createOscillator();

        oscillator.type = "sine";
        oscillator.frequency.value =
          frequency;

        oscillator.connect(hum);
        oscillator.start();
      }

      noise.start();

      audioCtx.resume().catch(() => {});

    } catch (error) {
      console.warn(
        "Ambient audio unavailable:",
        error
      );
    }
  }

  function updateAudioVolume() {
    if (!masterGain || !audioCtx) return;

    masterGain.gain.setTargetAtTime(
      scene.ambientVolume,
      audioCtx.currentTime,
      0.03
    );
  }

  // ==========================================================
  // NORMA CONSTELLATION RENDERING
  // ==========================================================

  function polylinePath(indices, positions) {
    return indices.map((index, i) => {
      const p = positions[index];

      if (!p) {
        return i === 0
          ? "M 0 0"
          : "L 0 0";
      }

      return (
        (i === 0 ? "M" : "L") +
        " " + p.x.toFixed(2) +
        " " + p.y.toFixed(2)
      );
    }).join(" ");
  }

  function updateNavigationConstellation() {
    const positions = [];

    NAV_STARS.forEach((star, index) => {
      const button = navButtons[index];
      if (!button) return;

      const p = project(
        star.x,
        star.y,
        star.depth,
        camera.zoom
      );

      positions.push(p);

      const scale = clamp(
        Math.pow(camera.zoom, 0.2),
        0.88,
        1.18
      );

      button.style.left = p.x + "px";
      button.style.top = p.y + "px";

      button.style.setProperty(
        "--star-scale",
        scale.toFixed(3)
      );

      button.style.setProperty(
        "--star-size",
        star.size + "px"
      );

      button.style.setProperty(
        "--star-tint",
        star.tint
      );

      button.style.setProperty(
        "--star-breathe",
        star.breathe
      );

      const visible =
        p.x > -80 &&
        p.x < W + 80 &&
        p.y > -80 &&
        p.y < H + 80;

      button.style.opacity =
        visible ? "1" : "0";

      button.style.pointerEvents =
        visible ? "auto" : "none";
    });

    const pathA = polylinePath(
      NAV_LINES[0],
      positions
    );

    const pathB = polylinePath(
      NAV_LINES[1],
      positions
    );

    DOM.lineABase.setAttribute(
      "d",
      pathA
    );

    DOM.lineBBase.setAttribute(
      "d",
      pathB
    );

    DOM.lineAGlow.setAttribute(
      "d",
      pathA
    );

    DOM.lineBGlow.setAttribute(
      "d",
      pathB
    );
  }

  // ==========================================================
  // LIBRARY CONSTELLATION HIERARCHY
  // ==========================================================

  const SKY_DEPTH = {
    group: 1,
    production: 1,
    season: 1
  };

  function archiveEntriesWithSky() {
    const result = [];

    for (
      const type of [
        "group",
        "production",
        "season"
      ]
    ) {
      for (const item of STORE.all(type)) {
        if (
          item.constellation &&
          item.constellation.center &&
          Array.isArray(item.constellation.stars)
        ) {
          result.push({
            type,
            item
          });
        }
      }
    }

    return result;
  }

  function constellationVisibility(type) {
    const zoom = camera.zoom;
    const configuration =
      AC.constellation;

    const required =
      type === "group"
        ? configuration.groupMinZoom
        : type === "production"
          ? configuration.productionMinZoom
          : configuration.seasonMinZoom;

    if (zoom < required) {
      return 0;
    }

    const revealWidth =
      type === "season" ? 0.35 : 0.2;

    return clamp(
      (zoom - required) / revealWidth,
      0,
      1
    );
  }

  function archiveStarWorldPosition(
    constellation,
    star
  ) {
    return {
      x: constellation.center.x + star.x,
      y: constellation.center.y + star.y
    };
  }

  function archiveStarColor(star) {
    if (!Array.isArray(star.tint)) {
      return "205,225,255";
    }

    return star.tint.join(",");
  }

  function createArchiveStarNode(type, item, star, index) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "archive-star";

    button.dataset.level = type;
    button.dataset.id = item.id;
    button.dataset.starIndex = index;

    button.setAttribute(
      "aria-label",
      `${item.title} — ${type}`
    );

    const halo = element(
      "span",
      "star-halo"
    );

    const spikeX = element(
      "span",
      "star-spike star-spike-x"
    );

    const spikeY = element(
      "span",
      "star-spike star-spike-y"
    );

    const core = element(
      "span",
      "star-core"
    );

    button.append(
      halo,
      spikeX,
      spikeY,
      core
    );

    // A label is attached to the primary star only,
    // avoiding 30 repeated titles in one constellation.
    if (index === 0) {
      const label = element(
        "span",
        "star-label",
        item.title
      );

      button.appendChild(label);
    }

    button.style.setProperty(
      "--star-size",
      star.size + "px"
    );

    button.style.setProperty(
      "--star-tint",
      archiveStarColor(star)
    );

    const duration =
      5 + ((star.twinklePhase || 0) / TAU) * 5;

    button.style.setProperty(
      "--star-breathe",
      duration.toFixed(2) + "s"
    );

    button.addEventListener("click", event => {
      event.stopPropagation();
      startAmbientAudio();

      // Implemented in Part 2.
      openArchiveEntry(type, item.id);
    });

    return button;
  }

  function rebuildArchiveSkyNodes() {
    DOM.archiveStars.replaceChildren();
    archiveSkyNodes.clear();

    const entries = archiveEntriesWithSky();

    for (const { type, item } of entries) {
      const constellation = item.constellation;

      constellation.stars.forEach((star, index) => {
        const key =
          `${type}:${item.id}:${index}`;

        const node = createArchiveStarNode(
          type,
          item,
          star,
          index
        );

        DOM.archiveStars.appendChild(node);

        archiveSkyNodes.set(key, {
          node,
          type,
          itemId: item.id,
          starIndex: index
        });
      });
    }

    archiveStarSignature = entries.map(({ type, item }) =>
      [
        type,
        item.id,
        item.title,
        item.constellation?.stars?.length || 0
      ].join(":")
    ).join("|");

    archiveSkyDirty = true;
  }

  function svgArchiveLine(
    a,
    b,
    type,
    animated = false,
    delay = 0
  ) {
    const path = svgElement("path", {
      d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
    });

    path.classList.add(
      animated
        ? "archive-connection-flow"
        : "archive-connection"
    );

    if (!animated) {
      path.classList.add(
        type === "group"
          ? "group-link"
          : type === "season"
            ? "season-link"
            : "production-link"
      );
    } else {
      path.style.animationDelay =
        (-delay).toFixed(2) + "s";
    }

    return path;
  }

  function renderArchiveSky() {
    const entries = archiveEntriesWithSky();

    const signature = entries.map(({ type, item }) =>
      [
        type,
        item.id,
        item.title,
        item.constellation?.stars?.length || 0
      ].join(":")
    ).join("|");

    if (signature !== archiveStarSignature) {
      rebuildArchiveSkyNodes();
    }

    DOM.archiveLines.replaceChildren();

    const lineFragment =
      document.createDocumentFragment();

    for (const { type, item } of entries) {
      const constellation =
        item.constellation;

      const visibility =
        constellationVisibility(type);

      const points = constellation.stars.map(star => {
        const world = archiveStarWorldPosition(
          constellation,
          star
        );

        return project(
          world.x,
          world.y,
          SKY_DEPTH[type],
          camera.zoom
        );
      });

      const links =
        Array.isArray(constellation.links)
          ? constellation.links
          : [];

      if (visibility > 0) {
        links.forEach(([a, b], index) => {
          if (!points[a] || !points[b]) return;

          const line = svgArchiveLine(
            points[a],
            points[b],
            type
          );

          line.style.opacity =
            (visibility * 0.8).toFixed(3);

          lineFragment.appendChild(line);

          // Occasional flowing light.
          // Limited to avoid excessive DOM elements.
          if (
            index === 0 &&
            type !== "season"
          ) {
            const flow = svgArchiveLine(
              points[a],
              points[b],
              type,
              true,
              U.hashString(item.id) % 22
            );

            flow.style.opacity =
              visibility.toFixed(3);

            lineFragment.appendChild(flow);
          }
        });
      }

      // ------------------------------------------
      // ORGANIC PARENT-CHILD CONNECTIONS
      // ------------------------------------------

      let parentItem = null;

      if (type === "production" && item.groupId) {
        parentItem = STORE.get("group", item.groupId);
      }

      if (type === "season" && item.productionId) {
        parentItem = STORE.get(
          "production",
          item.productionId
        );
      }

      if (
        parentItem?.constellation?.center &&
        visibility > 0
      ) {
        const parentCenter =
          parentItem.constellation.center;

        const childCenter =
          constellation.center;

        const start = project(
          parentCenter.x,
          parentCenter.y,
          1,
          camera.zoom
        );

        const end = project(
          childCenter.x,
          childCenter.y,
          1,
          camera.zoom
        );

        const connection = svgArchiveLine(
          start,
          end,
          type === "season" ? "season" : "group"
        );

        connection.style.opacity =
          (visibility * 0.85).toFixed(3);

        lineFragment.appendChild(connection);

        // A subtle traveling pulse appears along
        // the connection occasionally.
        if (type === "production") {
          const pulse = svgArchiveLine(
            start,
            end,
            "group",
            true,
            U.hashString(item.id) % 23
          );

          pulse.style.opacity =
            (visibility * 0.7).toFixed(3);

          lineFragment.appendChild(pulse);
        }
      }


      constellation.stars.forEach((star, index) => {
        const key = `${type}:${item.id}:${index}`;

        const existing =
          archiveSkyNodes.get(key);

        if (!existing) return;

        const button = existing.node;
        const p = points[index];

        const visible =
          visibility > 0 &&
          p.x >= -80 &&
          p.x <= W + 80 &&
          p.y >= -80 &&
          p.y <= H + 80;

        button.style.left = p.x + "px";
        button.style.top = p.y + "px";

        const zoomScale = clamp(
          Math.sqrt(camera.zoom),
          0.65,
          1.8
        );

        button.style.setProperty(
          "--star-scale",
          zoomScale.toFixed(3)
        );

        button.style.opacity = visible
          ? (visibility *
              (star.brightness || 1)).toFixed(3)
          : "0";

        button.style.pointerEvents =
          visible && visibility > 0.35
            ? "auto"
            : "none";

        // Smaller season stars are intentionally
        // absent until close-range zoom.
        button.tabIndex =
          visible && visibility > 0.35
            ? 0
            : -1;
      });
    }

    DOM.archiveLines.appendChild(
      lineFragment
    );

    archiveSkyDirty = false;
  }

  // ==========================================================
  // GLASS PANEL FOUNDATION
  // ==========================================================

  function setPanelOrigin(source) {
    if (!source) {
      DOM.panel.style.setProperty(
        "--origin-x",
        "50%"
      );

      DOM.panel.style.setProperty(
        "--origin-y",
        "18%"
      );

      return;
    }

    const rect =
      source.getBoundingClientRect();

    const centerX =
      rect.left + rect.width / 2;

    const centerY =
      rect.top + rect.height / 2;

    DOM.panel.style.setProperty(
      "--origin-x",
      clamp(centerX / W * 100, 12, 88) + "%"
    );

    DOM.panel.style.setProperty(
      "--origin-y",
      clamp(centerY / H * 100, 8, 85) + "%"
    );
  }

  function clearPanelRegions() {
    DOM.panelContent.replaceChildren();
    DOM.panelToolbar.replaceChildren();
    DOM.panelFooter.replaceChildren();

    DOM.panelToolbar.hidden = true;
    DOM.panelFooter.hidden = true;

    DOM.panelContent.scrollTop = 0;
  }

  function showPanel({
    key,
    title,
    eyebrow = "WATCH ARCHIVE",
    wide = false,
    source = null,
    builder = null,
    pushHistory = false
  }) {
    if (
      pushHistory &&
      activePanel
    ) {
      panelHistory.push(activePanel);
    }

    activePanel = {
      key,
      title,
      eyebrow,
      wide,
      source,
      builder
    };

    setPanelOrigin(source);
    clearPanelRegions();

    DOM.panelTitle.textContent = title;
    DOM.panelEyebrow.textContent = eyebrow;

    DOM.panel.classList.toggle(
      "wide",
      wide
    );

    if (typeof builder === "function") {
      builder(DOM.panelContent);
    }

    DOM.panel.inert = false;

    DOM.panel.setAttribute(
      "aria-hidden",
      "false"
    );

    DOM.panel.classList.add("open");

    navButtons.forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.panel === key
      );
    });
  }

  function closePanel() {
    DOM.panel.classList.remove("open");

    DOM.panel.setAttribute(
      "aria-hidden",
      "true"
    );

    DOM.panel.inert = true;

    activePanel = null;
    panelHistory = [];

    navButtons.forEach(button => {
      button.classList.remove("active");
    });
  }

  function backPanel() {
    const previous = panelHistory.pop();

    if (!previous) {
      closePanel();
      return;
    }

    showPanel({
      ...previous,
      pushHistory: false
    });
  }

  function setToolbar(nodes = []) {
    DOM.panelToolbar.replaceChildren();

    for (const node of nodes) {
      DOM.panelToolbar.appendChild(node);
    }

    DOM.panelToolbar.hidden =
      nodes.length === 0;
  }

  function setFooter(nodes = []) {
    DOM.panelFooter.replaceChildren();

    for (const node of nodes) {
      DOM.panelFooter.appendChild(node);
    }

    DOM.panelFooter.hidden =
      nodes.length === 0;
  }

  function makeButton(
    text,
    onClick,
    options = {}
  ) {
    const button = element(
      "button",
      "archive-button",
      text
    );

    button.type = "button";

    if (options.primary) {
      button.classList.add("primary");
    }

    if (options.danger) {
      button.classList.add("danger");
    }

    if (options.small) {
      button.classList.add("small");
    }

    if (options.disabled) {
      button.disabled = true;
    }

    if (typeof onClick === "function") {
      button.addEventListener(
        "click",
        onClick
      );
    }

    return button;
  }

  function makeHeading(text) {
    return element(
      "h3",
      "section-title",
      text
    );
  }

  function makeDescription(text) {
    return element(
      "p",
      "archive-description",
      text
    );
  }

  function makeField({
    label,
    value = "",
    type = "text",
    placeholder = "",
    required = false,
    min = null,
    max = null,
    step = null
  }) {
    const wrapper = element(
      "label",
      "archive-field"
    );

    const caption = element(
      "span",
      "",
      label
    );

    const input = element(
      "input",
      "archive-input"
    );

    input.type = type;
    input.value = value ?? "";
    input.placeholder = placeholder;
    input.required = required;

    if (min !== null) input.min = min;
    if (max !== null) input.max = max;
    if (step !== null) input.step = step;

    wrapper.append(caption, input);

    return {
      wrapper,
      input
    };
  }

  function makeSelect(
    label,
    options,
    selectedValue = ""
  ) {
    const wrapper = element(
      "label",
      "archive-field"
    );

    const caption = element(
      "span",
      "",
      label
    );

    const select = element(
      "select",
      "archive-select"
    );

    for (const option of options) {
      const item = element("option");

      if (typeof option === "string") {
        item.value = option;
        item.textContent = option;
      } else {
        item.value = option.value;
        item.textContent = option.label;
      }

      select.appendChild(item);
    }

    select.value = selectedValue;

    wrapper.append(caption, select);

    return {
      wrapper,
      select
    };
  }

  function makeTextarea(
    label,
    value = "",
    placeholder = ""
  ) {
    const wrapper = element(
      "label",
      "archive-field"
    );

    const caption = element(
      "span",
      "",
      label
    );

    const textarea = element(
      "textarea",
      "archive-textarea"
    );

    textarea.value = value;
    textarea.placeholder = placeholder;
    textarea.rows = 4;

    wrapper.append(caption, textarea);

    return {
      wrapper,
      textarea
    };
  }

  function makeEmptyState(message) {
    const container = element(
      "div",
      "archive-empty"
    );

    container.appendChild(
      element(
        "span",
        "empty-symbol",
        "✧"
      )
    );

    container.appendChild(
      element("p", "", message)
    );

    return container;
  }

  function makeCheckbox(
    label,
    checked,
    onChange
  ) {
    const wrapper = element(
      "label",
      "archive-check"
    );

    const input = document.createElement(
      "input"
    );

    input.type = "checkbox";
    input.checked = !!checked;

    if (typeof onChange === "function") {
      input.addEventListener(
        "change",
        () => onChange(input.checked)
      );
    }

    wrapper.append(
      input,
      element("span", "", label)
    );

    return wrapper;
  }

  function makeEntryRow({
    title,
    metadata = [],
    rating = null,
    onOpen = null,
    onEdit = null
  }) {
    const row = element(
      "div",
      "archive-entry"
    );

    const information = element(
      "div",
      "entry-content"
    );

    information.appendChild(
      element(
        "h4",
        "entry-title",
        title
      )
    );

    const meta = element(
      "div",
      "entry-meta"
    );

    for (const text of metadata) {
      if (!text) continue;
      meta.appendChild(
        element("span", "", text)
      );
    }

    information.appendChild(meta);
    row.appendChild(information);

    if (rating !== null) {
      row.appendChild(
        element(
          "span",
          "entry-rating",
          formatRating(rating)
        )
      );
    }

    if (onOpen) {
      row.appendChild(
        makeButton(
          "Open",
          onOpen,
          { small: true }
        )
      );
    }

    if (onEdit) {
      row.appendChild(
        makeButton(
          "Edit",
          onEdit,
          { small: true }
        )
      );
    }

    return row;
  }

  // ==========================================================
  // END OF PART 1
  //
  // Do not close the outer function.
  // Part 2 continues immediately below this line.
  // ==========================================================

 
  // ==========================================================
  // WATCH ARCHIVE — STEP 7
  // APP.JS — PART 2 OF 2
  // Paste directly after Part 1.
  // ==========================================================

  // ==========================================================
  // PANEL NAVIGATION
  // ==========================================================

  function openMenu(name, source = null) {
    startAmbientAudio();

    const titles = {
      settings: "Settings",
      library: "Library",
      creation: "Creation",
      watchlist: "Watchlist",
      statistics: "Statistics"
    };

    const builders = {
      settings: buildSettingsPanel,
      library: buildLibraryPanel,
      creation: buildCreationPanel,
      watchlist: buildWatchlistPanel,
      statistics: buildStatisticsPanel
    };

    const title = titles[name];
    const builder = builders[name];

    if (!title || !builder) return;

    if (
      activePanel?.key === name &&
      DOM.panel.classList.contains("open")
    ) {
      closePanel();
      return;
    }

    panelHistory = [];

    showPanel({
      key: name,
      title,
      eyebrow: "WATCH ARCHIVE",
      wide: name === "library" ||
        name === "statistics",
      source,
      builder
    });
  }

  function refreshCurrentPanel() {
    if (!activePanel) return;

    const panelInfo = activePanel;

    showPanel({
      ...panelInfo,
      pushHistory: false
    });
  }

  function openSubPanel(config) {
    if (activePanel) {
      panelHistory.push(activePanel);
    }

    showPanel({
      ...config,
      pushHistory: false
    });

    if (panelHistory.length) {
      setToolbar([
        makeButton(
          "← Back",
          backPanel,
          { small: true }
        )
      ]);
    }
  }

  // ==========================================================
  // SETTINGS PANEL
  // ==========================================================

  const SETTINGS_GROUPS = [
    {
      title: "Stars",
      items: [
        ["starsAmount", "Amount", 0.4, 2.2, 0.05],
        ["starsBrightness", "Brightness", 0.3, 2, 0.05],
        ["starsColorVariance", "Color Difference", 0, 1.5, 0.05],
        ["starsTwinkle", "Ambient Twinkle", 0, 2, 0.05]
      ]
    },
    {
      title: "Shooting Stars",
      items: [
        ["shootingFrequency", "Frequency", 0, 2, 0.05]
      ]
    },
    {
      title: "Nebulae",
      items: [
        ["nebulaColorVariance", "Color Difference", 0.3, 2.2, 0.05],
        ["nebulaBrightness", "Brightness", 0.25, 2.2, 0.05],
        ["nebulaSize", "Size", 0.45, 2.1, 0.05],
        ["nebulaFrequency", "Frequency", 0.2, 2, 0.05]
      ]
    },
    {
      title: "Ambient Sound",
      items: [
        ["ambientVolume", "Volume", 0, 0.2, 0.0025]
      ]
    }
  ];

  function buildSettingsPanel(container) {
    for (const group of SETTINGS_GROUPS) {
      const section = element(
        "section",
        "settings-group"
      );

      section.appendChild(
        element("h3", "", group.title)
      );

      for (
        const [key, label, min, max, step]
        of group.items
      ) {
        const wrapper = element(
          "label",
          "setting"
        );

        const heading = element(
          "div",
          "setting-heading"
        );

        const output = element("output");

        const decimals =
          key === "ambientVolume" ? 3 : 2;

        output.textContent =
          Number(scene[key]).toFixed(decimals);

        heading.append(
          element("span", "", label),
          output
        );

        const slider = element("input");

        slider.type = "range";
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = clamp(scene[key], min, max);

        slider.setAttribute(
          "aria-label",
          label
        );

        slider.addEventListener("input", () => {
          scene[key] = Number(slider.value);

          output.textContent =
            scene[key].toFixed(decimals);

          if (key === "nebulaColorVariance") {
            nebulaCache.clear();
          }

          if (key === "shootingFrequency") {
            shootingStar = null;
            nextMeteor = 0;
          }

          if (key === "ambientVolume") {
            startAmbientAudio();
            updateAudioVolume();
          }

          saveSpaceSettings();
        });

        wrapper.append(
          heading,
          slider
        );

        section.appendChild(wrapper);
      }

      container.appendChild(section);
    }

    container.appendChild(
      element(
        "p",
        "settings-note",
        "Your visual settings save automatically on this device."
      )
    );

    const backupSection = element(
      "section",
      "settings-group"
    );

    backupSection.appendChild(
      element("h3", "", "Archive Backup")
    );

    const actions = element(
      "div",
      "archive-actions"
    );

    actions.appendChild(
      makeButton(
        "Export Archive",
        exportArchiveJSON
      )
    );

    actions.appendChild(
      makeButton(
        "Import Archive",
        requestArchiveImport
      )
    );

    backupSection.appendChild(actions);

    backupSection.appendChild(
      element(
        "p",
        "settings-note",
        "Export regularly to protect your personal archive. Import replaces the current library."
      )
    );

    container.appendChild(backupSection);
  }

  // ==========================================================
  // WATCHLIST
  // ==========================================================

  function buildWatchlistPanel(container) {
    container.appendChild(
      makeDescription(
        "A personal list of productions you intend to watch. Checking an entry transfers it directly into your Library."
      )
    );

    const addSection = element(
      "section",
      "archive-section"
    );

    addSection.appendChild(
      makeHeading("Add to Watchlist")
    );

    const form = element("form");

    const titleField = makeField({
      label: "Title",
      placeholder: "Enter a production title",
      required: true
    });

    const mediaField = makeField({
      label: "Form of Media (optional)",
      placeholder: "Movie, series, documentary..."
    });

    const releaseField = makeField({
      label: "Release / Airing (optional)",
      placeholder: "YYYY, YYYY-MM-DD, or your own text"
    });

    form.append(
      titleField.wrapper,
      mediaField.wrapper,
      releaseField.wrapper
    );

    const addButton = makeButton(
      "Add to Watchlist",
      null,
      { primary: true }
    );

    addButton.type = "submit";
    form.appendChild(addButton);

    form.addEventListener("submit", event => {
      event.preventDefault();

      const title = titleField.input.value.trim();

      if (!title) return;

      const result = STORE.addWatchlist({
        title,
        mediaType: mediaField.input.value,
        releaseDate: releaseField.input.value
      });

      if (!result) {
        showToast("Could not save this watchlist entry.");
        return;
      }

      showToast("Added to Watchlist.");
      refreshCurrentPanel();
    });

    addSection.appendChild(form);
    container.appendChild(addSection);

    container.appendChild(
      makeHeading("Planned Productions")
    );

    const list = element(
      "div",
      "archive-list"
    );

    const items = STORE.all("watchlist")
      .sort((a, b) =>
        (b.createdAt || "").localeCompare(
          a.createdAt || ""
        )
      );

    if (!items.length) {
      list.appendChild(
        makeEmptyState(
          "Your watchlist is empty. Add something you'd like to watch."
        )
      );
    }

    for (const item of items) {
      const row = element(
        "div",
        "watchlist-item"
      );

      const check = element("input");
      check.type = "checkbox";
      check.checked = false;

      check.setAttribute(
        "aria-label",
        `Move ${item.title} to Library`
      );

      const information = element(
        "div",
        "entry-content"
      );

      information.appendChild(
        element(
          "h4",
          "entry-title",
          item.title
        )
      );

      const metadata = element(
        "div",
        "entry-meta"
      );

      if (item.mediaType) {
        metadata.appendChild(
          element("span", "", item.mediaType)
        );
      }

      if (item.releaseDate) {
        metadata.appendChild(
          element("span", "", item.releaseDate)
        );
      }

      information.appendChild(metadata);

      const actions = element(
        "div",
        "archive-actions"
      );

      actions.appendChild(
        makeButton(
          "Edit",
          () => openWatchlistEditor(item.id),
          { small: true }
        )
      );

      actions.appendChild(
        makeButton(
          "×",
          () => {
            if (!confirm(
              `Remove "${item.title}" from your watchlist?`
            )) return;

            if (STORE.removeWatchlist(item.id)) {
              refreshCurrentPanel();
              showToast("Watchlist entry removed.");
            }
          },
          { small: true, danger: true }
        )
      );

      check.addEventListener("change", () => {
        if (!check.checked) return;

        check.disabled = true;
        row.classList.add("completing");

        const production =
          STORE.completeWatchlist(item.id);

        if (!production) {
          check.disabled = false;
          check.checked = false;
          row.classList.remove("completing");

          showToast(
            "Transfer failed. Your watchlist entry was preserved."
          );
          return;
        }

        archiveSkyDirty = true;

        showToast(
          `"${production.title}" moved to Library.`
        );

        refreshCurrentPanel();
      });

      row.append(
        check,
        information,
        actions
      );

      list.appendChild(row);
    }

    container.appendChild(list);
  }

  function openWatchlistEditor(id) {
    const item = STORE.get("watchlist", id);
    if (!item) return;

    openSubPanel({
      key: "watchlist-edit",
      title: "Edit Watchlist Entry",
      eyebrow: "WATCHLIST",
      builder(container) {
        const form = element("form");

        const title = makeField({
          label: "Title",
          value: item.title,
          required: true
        });

        const media = makeField({
          label: "Form of Media",
          value: item.mediaType || ""
        });

        const release = makeField({
          label: "Release / Airing",
          value: item.releaseDate || ""
        });

        form.append(
          title.wrapper,
          media.wrapper,
          release.wrapper
        );

        const save = makeButton(
          "Save Changes",
          null,
          { primary: true }
        );

        save.type = "submit";
        form.appendChild(save);

        form.addEventListener("submit", event => {
          event.preventDefault();

          const result = STORE.update(
            "watchlist",
            id,
            {
              title: title.input.value,
              mediaType: media.input.value,
              releaseDate: release.input.value
            }
          );

          if (!result) {
            showToast("Could not save changes.");
            return;
          }

          showToast("Watchlist entry updated.");
          backPanel();
        });

        container.appendChild(form);
      }
    });
  }

  // ==========================================================
  // CREATION MENU
  // ==========================================================

  const CREATION_TYPES = [
    {
      type: "group",
      title: "Group",
      symbol: "✦",
      description: "A universe containing multiple productions"
    },
    {
      type: "production",
      title: "Production",
      symbol: "✧",
      description: "A movie, series, or other production"
    },
    {
      type: "season",
      title: "Season",
      symbol: "⋆",
      description: "A season within an existing production"
    },
    {
      type: "episode",
      title: "Episode",
      symbol: "·",
      description: "An individual episode within a season"
    }
  ];

  function buildCreationPanel(container) {
    container.appendChild(
      makeDescription(
        "Create an entry manually. Groups and productions generate unique constellations, while seasons appear as smaller stars when you zoom closer."
      )
    );

    const grid = element(
      "div",
      "creation-options"
    );

    for (const entry of CREATION_TYPES) {
      const button = element(
        "button",
        "creation-option"
      );

      button.type = "button";

      button.appendChild(
        element(
          "span",
          "creation-symbol",
          entry.symbol
        )
      );

      button.appendChild(
        element(
          "strong",
          "",
          entry.title
        )
      );

      button.appendChild(
        element(
          "small",
          "",
          entry.description
        )
      );

      button.addEventListener("click", () => {
        openCreationForm(entry.type);
      });

      grid.appendChild(button);
    }

    container.appendChild(grid);

    container.appendChild(
      element(
        "p",
        "archive-hint",
        "These are functional starter forms. Their full custom designs will be developed separately."
      )
    );
  }

  function createParentSelector(type, label, items) {
    const options = [
      {
        value: "",
        label: `Select ${label.toLowerCase()}`
      },
      ...items.map(item => ({
        value: item.id,
        label: item.title
      }))
    ];

    return makeSelect(
      label,
      options,
      ""
    );
  }

  function createConstellationControls(
    initialValue = AC.constellation.defaultStars
  ) {
    const section = element(
      "section",
      "archive-section"
    );

    section.appendChild(
      makeHeading("Constellation")
    );

    section.appendChild(
      makeDescription(
        "Choose how many individual stars will form this entry's unique constellation."
      )
    );

    const wrapper = element(
      "div",
      "constellation-count"
    );

    const slider = element("input");

    slider.type = "range";
    slider.min = AC.constellation.minStars;
    slider.max = AC.constellation.maxStars;
    slider.step = 1;
    slider.value = clamp(
      initialValue,
      AC.constellation.minStars,
      AC.constellation.maxStars
    );

    const output = element(
      "output",
      "",
      slider.value
    );

    wrapper.append(
      slider,
      output
    );

    section.appendChild(wrapper);

    const hint = element(
      "p",
      "archive-hint",
      "The constellation's shape, spacing and colors will be generated when the entry is saved."
    );

    section.appendChild(hint);

    slider.addEventListener("input", () => {
      output.textContent = slider.value;
    });

    return {
      section,
      slider
    };
  }

  function openCreationForm(type, defaults = {}) {
    const title =
      type.charAt(0).toUpperCase() +
      type.slice(1);

    openSubPanel({
      key: `create-${type}`,
      title: `Create ${title}`,
      eyebrow: "CREATION",
      wide: true,
      builder(container) {
        const form = element("form");

        const name = makeField({
          label: "Title",
          value: defaults.title || "",
          placeholder: `Enter ${type} title`,
          required: true
        });

        form.appendChild(name.wrapper);

        let parent = null;
        let media = null;
        let release = null;
        let duration = null;
        let rating = null;
        let notes = null;
        let number = null;

        if (type === "production") {
          const groupOptions = [
            {
              value: "",
              label: "Standalone / No Group"
            },
            ...STORE.all("group").map(group => ({
              value: group.id,
              label: group.title
            }))
          ];

          parent = makeSelect(
            "Parent Group (optional)",
            groupOptions,
            defaults.groupId || ""
          );

          media = makeField({
            label: "Form of Media",
            placeholder: "Enter manually",
            value: defaults.mediaType || ""
          });

          release = makeField({
            label: "Release / Airing",
            value: defaults.releaseDate || ""
          });

          form.append(
            parent.wrapper,
            media.wrapper,
            release.wrapper
          );
        }

        if (type === "season") {
          parent = createParentSelector(
            type,
            "Production",
            STORE.all("production")
          );

          if (defaults.productionId) {
            parent.select.value =
              defaults.productionId;
          }

          number = makeField({
            label: "Season Number",
            type: "number",
            min: 0,
            step: 1
          });

          release = makeField({
            label: "Time of Airing",
            placeholder: "Enter manually"
          });

          form.append(
            parent.wrapper,
            number.wrapper,
            release.wrapper
          );
        }

        if (type === "episode") {
          parent = createParentSelector(
            type,
            "Season",
            STORE.all("season")
          );

          if (defaults.seasonId) {
            parent.select.value =
              defaults.seasonId;
          }

          number = makeField({
            label: "Episode Number",
            type: "number",
            min: 0,
            step: 1
          });

          duration = makeField({
            label: "Duration (minutes)",
            type: "number",
            min: 0,
            step: 1
          });

          rating = makeField({
            label: "Rating (1–10, half-stars)",
            type: "number",
            min: 1,
            max: 10,
            step: 0.5
          });

          form.append(
            parent.wrapper,
            number.wrapper,
            duration.wrapper,
            rating.wrapper
          );
        }

        if (type === "group" ||
            type === "production" ||
            type === "episode") {
          notes = makeTextarea(
            "Personal Thoughts / Observations",
            "",
            "Your own observations..."
          );

          form.appendChild(notes.wrapper);
        }
      
        const action = makeButton(
          `Create ${title}`,
          null,
          { primary: true }
        );

        action.type = "submit";
        form.appendChild(action);

        form.addEventListener("submit", event => {
          event.preventDefault();

                  const input = {
            title: name.input.value
          };
          
          if (parent) {
            if (type === "production") {
              input.groupId =
                parent.select.value || null;
            }

            if (type === "season") {
              input.productionId =
                parent.select.value;
            }

            if (type === "episode") {
              input.seasonId =
                parent.select.value;
            }
          }

          if (media) {
            input.mediaType = media.input.value;
          }

          if (release) {
            input.releaseDate =
              release.input.value;
          }

          if (number) {
            input.number = number.input.value === ""
              ? null
              : Number(number.input.value);
          }

          if (duration) {
            input.durationMinutes =
              Number(duration.input.value || 0);
          }

          if (rating) {
            input.rating = rating.input.value;
          }

          if (notes) {
            input.notes = notes.textarea.value;
          }

          let created = null;

          if (type === "group") {
            created = STORE.createGroup(input);
          } else if (type === "production") {
            created = STORE.createProduction(input);
          } else if (type === "season") {
            created = STORE.createSeason(input);
          } else if (type === "episode") {
            created = STORE.createEpisode(input);
          }

          if (!created) {
            showToast(
              "Creation failed. Check the title and parent selection."
            );
            return;
          }

          archiveSkyDirty = true;

          showToast(
            `${title} created successfully.`
          );

          openArchiveEntry(type, created.id);
        });

        container.appendChild(form);
      }
    });
  }

  // ==========================================================
  // LIBRARY
  // ==========================================================

  function buildLibraryPanel(container) {
    const preferences =
      STORE.data.preferences;

    const sorting = makeSelect(
      "Sort by",
      AC.sorting.map(option => ({
        value: option.id,
        label: option.label
      })),
      preferences.librarySort
    );

    sorting.select.addEventListener(
      "change",
      () => {
        STORE.setLibraryPreferences({
          sort: sorting.select.value
        });

        refreshCurrentPanel();
      }
    );

    container.appendChild(sorting.wrapper);

    const filters = element(
      "div",
      "archive-toolbar-row"
    );

    const visibility =
      preferences.libraryVisibility;

    for (const [type, label] of [
      ["group", "Groups"],
      ["production", "Productions"],
      ["season", "Seasons"],
      ["episode", "Episodes"]
    ]) {
      filters.appendChild(
        makeCheckbox(
          label,
          visibility[type],
          checked => {
            STORE.setLibraryPreferences({
              visibility: {
                [type]: checked
              }
            });

            refreshCurrentPanel();
          }
        )
      );
    }

    container.appendChild(filters);

    container.appendChild(
      element("div", "archive-divider")
    );

    const entries =
      STORE.libraryEntries();

    container.appendChild(
      makeHeading(
        `Library — ${entries.length} entries`
      )
    );

    const list = element(
      "div",
      "archive-list"
    );

    if (!entries.length) {
      list.appendChild(
        makeEmptyState(
          "No entries match your current library filters."
        )
      );
    }

    for (const record of entries) {
      const { type, item, rating } =
        record;

      const metadata = [
        type.charAt(0).toUpperCase() +
          type.slice(1)
      ];

      if (item.mediaType) {
        metadata.push(item.mediaType);
      }

      if (item.releaseDate) {
        metadata.push(item.releaseDate);
      }

      list.appendChild(
        makeEntryRow({
          title: item.title,
          metadata,
          rating,

          onOpen: () =>
            openArchiveEntry(type, item.id),

          onEdit: () =>
            openEntryEditor(type, item.id)
        })
      );
    }

    container.appendChild(list);
  }

  // ==========================================================
  // ARCHIVE ENTRY VIEWER
  // ==========================================================

   function openArchiveEntry(type, id) {
    const item = STORE.get(type, id);

    if (type === "group" && item) {
      openSubPanel({
        key: `entry-group-${id}`,
        title: item.title,
        eyebrow: "GROUP",
        wide: true,
        builder(container) {
          window.GroupView.render(container, id);
        }
      });
      return;
    }

    if (!item) {
      showToast("This entry no longer exists.");
      return;
    }

    const label =
      type.charAt(0).toUpperCase() +
      type.slice(1);

    openSubPanel({
      key: `entry-${type}-${id}`,
      title: item.title,
      eyebrow: label.toUpperCase(),
      wide: true,

      builder(container) {
        const current = STORE.get(type, id);

        if (!current) {
          container.appendChild(
            makeEmptyState("Entry not found.")
          );
          return;
        }

        const rating =
          STORE.calculatedRating(type, current);

        const information = element(
          "section",
          "archive-section"
        );

        information.appendChild(
          makeHeading("Overview")
        );

        const metadata = [];

        if (current.mediaType) {
          metadata.push(
            `Media: ${current.mediaType}`
          );
        }

        if (current.releaseDate) {
          metadata.push(
            `Airing: ${current.releaseDate}`
          );
        }

        if (current.status) {
          metadata.push(
            `Status: ${current.status}`
          );
        }

        if (current.durationMinutes) {
          metadata.push(
            `Duration: ${formatDuration(current.durationMinutes)}`
          );
        }

        metadata.push(
          `Rating: ${formatRating(rating)}`
        );

        if (
          Array.isArray(current.genres) &&
          current.genres.length
        ) {
          metadata.push(
            `Genres: ${current.genres.join(", ")}`
          );
        }

        if (
          Array.isArray(current.tags) &&
          current.tags.length
        ) {
          metadata.push(
            `Secondary Genres: ${current.tags.join(", ")}`
          );
        }

        for (const text of metadata) {
          information.appendChild(
            element(
              "p",
              "archive-description",
              text
            )
          );
        }

        if (current.notes) {
          information.appendChild(
            makeHeading("Observations")
          );

          const note = element(
            "p",
            "archive-description",
            current.notes
          );

          note.style.whiteSpace = "pre-wrap";
          information.appendChild(note);
        }

        container.appendChild(information);

        const actions = element(
          "div",
          "archive-actions"
        );

        actions.appendChild(
          makeButton(
            "Edit",
            () => openEntryEditor(type, id),
            { primary: true }
          )
        );

        if (current.constellation?.center) {
          actions.appendChild(
            makeButton(
              "Find in Universe",
              () => {
                focusWorldPoint(
                  current.constellation.center.x,
                  current.constellation.center.y,
                  type === "season" ? 1.65 : 1
                );

                closePanel();
              }
            )
          );
        }

        actions.appendChild(
          makeButton(
            "Delete",
            () => deleteArchiveEntry(type, id),
            { danger: true }
          )
        );

        container.appendChild(actions);

        container.appendChild(
          element("div", "archive-divider")
        );

        if (type === "group") {
          renderChildren(
            container,
            "Productions",
            "production",
            STORE.children("group", id)
          );

          container.appendChild(
            makeButton(
              "+ Add Production",
              () => openCreationForm(
                "production",
                { groupId: id }
              )
            )
          );
        }

        if (type === "production") {
          renderChildren(
            container,
            "Seasons",
            "season",
            STORE.children("production", id)
          );

          container.appendChild(
            makeButton(
              "+ Add Season",
              () => openCreationForm(
                "season",
                { productionId: id }
              )
            )
          );
        }

        if (type === "season") {
          renderChildren(
            container,
            "Episodes",
            "episode",
            STORE.children("season", id)
          );

          container.appendChild(
            makeButton(
              "+ Add Episode",
              () => openCreationForm(
                "episode",
                { seasonId: id }
              )
            )
          );
        }

        if (type === "episode") {
          const season = STORE.parent(
            "episode",
            current
          );

          if (season) {
            container.appendChild(
              makeButton(
                "Open Season",
                () => openArchiveEntry(
                  "season",
                  season.id
                )
              )
            );
          }
        }
      }
    });
  }

  function renderChildren(
    container,
    heading,
    childType,
    children
  ) {
    container.appendChild(
      makeHeading(heading)
    );

    const list = element(
      "div",
      "archive-list"
    );

    if (!children.length) {
      list.appendChild(
        makeEmptyState(
          `No ${heading.toLowerCase()} added yet.`
        )
      );
    }

    for (const item of children) {
      list.appendChild(
        makeEntryRow({
          title: item.title,

          metadata: [
            item.releaseDate || "",
            item.status || ""
          ],

          rating: STORE.calculatedRating(
            childType,
            item
          ),

          onOpen: () =>
            openArchiveEntry(
              childType,
              item.id
            ),

          onEdit: () =>
            openEntryEditor(
              childType,
              item.id
            )
        })
      );
    }

    container.appendChild(list);
  }

  // ==========================================================
  // EDITING EXISTING ENTRIES
  // ==========================================================

  function openEntryEditor(type, id) {
    const item = STORE.get(type, id);
    if (!item) return;

    openSubPanel({
      key: `edit-${type}-${id}`,
      title: `Edit ${item.title}`,
      eyebrow: "EDIT ENTRY",
      wide: true,

      builder(container) {
        const form = element("form");
        const fields = {};

        function addField(key, label, options = {}) {
          const field = makeField({
            label,
            value: item[key] ?? "",
            ...options
          });

          fields[key] = field.input;
          form.appendChild(field.wrapper);
        }

        function addNotesField() {
          const field = makeTextarea(
            "Personal Thoughts / Observations",
            item.notes || ""
          );

          fields.notes = field.textarea;
          form.appendChild(field.wrapper);
        }

        addField(
          "title",
          "Title",
          { required: true }
        );

        if (type === "group" ||
            type === "production") {
          addField(
            "banner",
            "Banner Image URL"
          );

          addField(
            "genres",
            "Main Genres (comma-separated)",
            {
              value: (item.genres || []).join(", ")
            }
          );

          addField(
            "tags",
            "Secondary Genres (comma-separated)",
            {
              value: (item.tags || []).join(", ")
            }
          );
        }

        if (type === "production") {
          const groupField = makeSelect(
            "Parent Group",
            [
              {
                value: "",
                label: "Standalone"
              },
              ...STORE.all("group").map(group => ({
                value: group.id,
                label: group.title
              }))
            ],
            item.groupId || ""
          );

          fields.groupId =
            groupField.select;

          form.appendChild(
            groupField.wrapper
          );

          addField(
            "mediaType",
            "Form of Media"
          );
        }

        if (type === "production" ||
            type === "season" ||
            type === "episode") {
          addField(
            "releaseDate",
            "Release / Airing"
          );
        }

        if (type === "production" ||
            type === "season") {
          addField(
            "endDate",
            "End of Airing"
          );

          const status = makeSelect(
            "Watching Status",
            [
              { value: "", label: "Not Set" },
              { value: "Finished", label: "Finished" },
              { value: "Watching", label: "Watching" },
              { value: "Discontinued", label: "Discontinued" }
            ],
            item.status || ""
          );

          fields.status = status.select;
          form.appendChild(status.wrapper);
        }

        if (type === "production" ||
            type === "episode") {
          addField(
            "durationMinutes",
            "Duration (minutes)",
            {
              type: "number",
              min: 0,
              step: 1
            }
          );

          addField(
            "rating",
            "Rating (1–10, half-stars)",
            {
              type: "number",
              min: 1,
              max: 10,
              step: 0.5,
              value: item.rating ?? ""
            }
          );

          addField(
            "watchedAt",
            "Last Watched (YYYY-MM-DD)",
            {
              value: item.watchedAt || ""
            }
          );
        }

        if (type === "season" ||
            type === "episode") {
          addField(
            "number",
            "Number",
            {
              type: "number",
              min: 0,
              step: 1,
              value: item.number ?? ""
            }
          );
        }

        if (
          type === "group" ||
          type === "production" ||
          type === "season" ||
          type === "episode"
        ) {
          addNotesField();
        }

        const save = makeButton(
          "Save Changes",
          null,
          { primary: true }
        );

        save.type = "submit";
        form.appendChild(save);

        form.addEventListener(
          "submit",
          event => {
            event.preventDefault();

            const changes = {};

            for (
              const [key, input]
              of Object.entries(fields)
            ) {
              changes[key] = input.value;
            }

            if ("groupId" in changes) {
              changes.groupId =
                changes.groupId || null;
            }

            if ("number" in changes) {
              changes.number =
                changes.number === ""
                  ? null
                  : Number(changes.number);
            }

            const result =
              STORE.update(
                type,
                id,
                changes
              );

            if (!result) {
              showToast(
                "Changes could not be saved."
              );
              return;
            }

            archiveSkyDirty = true;

            showToast(
              "Entry updated."
            );

            openArchiveEntry(type, id);
          }
        );

        container.appendChild(form);
      }
    });
  }

  function deleteArchiveEntry(type, id) {
    const item = STORE.get(type, id);
    if (!item) return;

    const warning = type === "production"
      ? "Its seasons and episodes will also be deleted."
      : type === "season"
        ? "Its episodes will also be deleted."
        : type === "group"
          ? "Its productions will become standalone."
          : "";

    if (!confirm(
      `Delete "${item.title}"?\n${warning}`
    )) {
      return;
    }

    const result = STORE.delete(type, id);

    if (!result) {
      showToast("Deletion failed.");
      return;
    }

    archiveSkyDirty = true;

    panelHistory = [];

    showToast("Entry deleted.");

    showPanel({
      key: "library",
      title: "Library",
      wide: true,
      builder: buildLibraryPanel
    });
  }

  // ==========================================================
  // STATISTICS DATA
  // ==========================================================

  function productionRatingData() {
    return STORE.ratingDistribution();
  }

  function genreOverlapData() {
    const intersections =
      STORE.genreIntersections();

    const counts = new Map();

    for (const set of intersections) {
      for (const genre of set.genres) {
        counts.set(
          genre,
          (counts.get(genre) || 0) +
            set.count
        );
      }
    }

    return {
      sets: intersections,
      counts: [...counts].map(
        ([label, value]) => ({
          label,
          value
        })
      )
    };
  }

  function timeSeriesData() {
    const timeline = new Map();

    function add(date, minutes) {
      if (!date || !minutes) return;

      const parsed = Date.parse(date);
      if (!Number.isFinite(parsed)) return;

      const key = new Date(parsed)
        .toISOString()
        .slice(0, 10);

      timeline.set(
        key,
        (timeline.get(key) || 0) +
          minutes
      );
    }

    function record(entry) {
      const minutes =
        Number(entry.durationMinutes) || 0;

      if (!minutes) return;

      if (entry.viewings?.length) {
        for (const viewing of entry.viewings) {
          add(
            typeof viewing === "string"
              ? viewing
              : viewing.date,
            minutes
          );
        }
      } else {
        add(entry.watchedAt, minutes);
      }
    }

    for (
      const production
      of STORE.all("production")
    ) {
      if (
        !STORE.children(
          "production",
          production.id
        ).length
      ) {
        record(production);
      }
    }

    for (
      const episode
      of STORE.all("episode")
    ) {
      record(episode);
    }

    return [...timeline]
      .sort((a, b) =>
        a[0].localeCompare(b[0])
      )
      .map(([label, value]) => ({
        label,
        value
      }));
  }

  function getStatisticsData(datasetId) {
    if (datasetId === "watchTime") {
      return timeSeriesData();
    }

    if (datasetId === "mediaBreakdown") {
      return STORE.mediaTimeBreakdown()
        .filter(item => item.value > 0);
    }

    if (datasetId === "genreDistribution") {
      return STORE.genreDistribution();
    }

    if (datasetId === "genreOverlap") {
      return genreOverlapData();
    }

    if (datasetId === "ratingDistribution") {
      return productionRatingData().map(
        item => ({
          label: item.title,
          value: item.rating,
          ...item
        })
      );
    }

    if (datasetId === "ratingRankings") {
      return STORE.ranking().map(
        item => ({
          label: item.title,
          value: item.rating,
          ...item
        })
      );
    }

    return [];
  }

  // ==========================================================
  // SVG CHART UTILITIES
  // ==========================================================

  function chartSvg(width = 600, height = 300) {
    const svg = svgElement("svg", {
      viewBox: `0 0 ${width} ${height}`,
      role: "img",
      "aria-label": "Statistics diagram"
    });

    svg.style.width = "100%";
    svg.style.height = "auto";

    return svg;
  }

  function chartColor(index) {
    const colors =
      AC.statistics.palettes;

    return colors[index % colors.length];
  }

  function drawSvgText(
    svg,
    x,
    y,
    text,
    options = {}
  ) {
    const node = svgElement("text", {
      x,
      y,
      fill: options.fill ||
        "rgba(218,232,255,.74)",
      "font-size": options.size || 11,
      "font-family": "system-ui, sans-serif",
      "text-anchor": options.anchor ||
        "start"
    });

    node.textContent = String(text);
    svg.appendChild(node);

    return node;
  }

  function drawSvgLine(
    svg,
    x1,
    y1,
    x2,
    y2,
    options = {}
  ) {
    const line = svgElement("line", {
      x1,
      y1,
      x2,
      y2,
      stroke: options.stroke ||
        "rgba(189,215,255,.25)",
      "stroke-width": options.width || 1
    });

    svg.appendChild(line);
    return line;
  }

  function drawSvgRect(
    svg,
    x,
    y,
    width,
    height,
    options = {}
  ) {
    const rect = svgElement("rect", {
      x,
      y,
      width: Math.max(0, width),
      height: Math.max(0, height),
      rx: options.radius || 0,
      fill: options.fill ||
        chartColor(0),
      opacity: options.opacity ?? 1
    });

    svg.appendChild(rect);
    return rect;
  }

  function numericPairs(data) {
    if (!Array.isArray(data)) return [];

    return data.map(item => ({
      ...item,
      label: String(
        item.label ?? item.title ?? ""
      ),
      value: Number(item.value)
    })).filter(item =>
      Number.isFinite(item.value)
    );
  }

  // ==========================================================
  // RANKED BAR CHART
  // ==========================================================

  function renderRankedBar(data) {
    const values = numericPairs(data)
      .sort((a, b) => b.value - a.value)
      .slice(0, 14);

    const height = Math.max(
      240,
      values.length * 34 + 35
    );

    const svg = chartSvg(600, height);
    const max = Math.max(
      1,
      ...values.map(x => x.value)
    );

    values.forEach((item, index) => {
      const y = 12 + index * 34;

      drawSvgText(
        svg,
        10,
        y + 12,
        item.label.length > 22
          ? item.label.slice(0, 21) + "…"
          : item.label,
        { size: 11 }
      );

      drawSvgRect(
        svg,
        190,
        y,
        (item.value / max) * 335,
        17,
        {
          radius: 4,
          fill: chartColor(index),
          opacity: 0.76
        }
      );

      drawSvgText(
        svg,
        585,
        y + 12,
        Number(item.value.toFixed(2)),
        {
          anchor: "end",
          size: 11
        }
      );
    });

    return svg;
  }

  // ==========================================================
  // DONUT CHART
  // ==========================================================

  function renderDonut(data) {
    const values = numericPairs(data)
      .filter(x => x.value > 0)
      .slice(0, 12);

    const svg = chartSvg(600, 350);
    const total = values.reduce(
      (sum, x) => sum + x.value,
      0
    );

    if (!total) return svg;

    const cx = 190;
    const cy = 160;
    const radius = 110;
    const circumference = TAU * radius;

    let offset = 0;

    values.forEach((item, index) => {
      const fraction =
        item.value / total;

      const circleNode = svgElement(
        "circle",
        {
          cx,
          cy,
          r: radius,
          fill: "none",
          stroke: chartColor(index),
          "stroke-width": 37,
          "stroke-dasharray":
            `${fraction * circumference} ${circumference}`,
          "stroke-dashoffset":
            -offset * circumference,
          transform:
            `rotate(-90 ${cx} ${cy})`
        }
      );

      svg.appendChild(circleNode);
      offset += fraction;

      drawSvgRect(
        svg,
        360,
        30 + index * 25,
        10,
        10,
        {
          radius: 3,
          fill: chartColor(index)
        }
      );

      drawSvgText(
        svg,
        380,
        40 + index * 25,
        `${item.label.slice(0, 22)} (${Math.round(fraction * 100)}%)`,
        { size: 10 }
      );
    });

    drawSvgText(
      svg,
      cx,
      cy,
      "TOTAL",
      {
        anchor: "middle",
        size: 11
      }
    );

    drawSvgText(
      svg,
      cx,
      cy + 24,
      Number(total.toFixed(1)),
      {
        anchor: "middle",
        size: 22,
        fill: "#edf4ff"
      }
    );

    return svg;
  }

  // ==========================================================
  // LINE CHART
  // ==========================================================

  function renderLineChart(data) {
    const values = numericPairs(data);
    const svg = chartSvg(600, 310);

    if (!values.length) return svg;

    const max = Math.max(
      1,
      ...values.map(item => item.value)
    );

    const left = 55;
    const top = 25;
    const right = 570;
    const bottom = 255;

    for (let i = 0; i <= 4; i++) {
      const y =
        bottom - i * (bottom - top) / 4;

      drawSvgLine(
        svg,
        left,
        y,
        right,
        y
      );

      drawSvgText(
        svg,
        45,
        y + 4,
        (max * i / 4).toFixed(1),
        {
          anchor: "end",
          size: 10
        }
      );
    }

    const points = values.map(
      (item, index) => ({
        x: values.length === 1
          ? (left + right) / 2
          : left +
            index / (values.length - 1) *
            (right - left),

        y: bottom -
          item.value / max *
          (bottom - top)
      })
    );

    const path = svgElement("path", {
      d: points.map(
        (p, i) =>
          `${i ? "L" : "M"} ${p.x} ${p.y}`
      ).join(" "),

      fill: "none",
      stroke: chartColor(0),
      "stroke-width": 2.5,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    });

    svg.appendChild(path);

    points.forEach((p, i) => {
      const dot = svgElement(
        "circle",
        {
          cx: p.x,
          cy: p.y,
          r: 3.5,
          fill: "#dceaff"
        }
      );

      const tooltip = svgElement("title");
      tooltip.textContent =
        `${values[i].label}: ${values[i].value}`;

      dot.appendChild(tooltip);
      svg.appendChild(dot);
    });

    drawSvgText(
      svg,
      left,
      288,
      values[0].label,
      { size: 10 }
    );

    drawSvgText(
      svg,
      right,
      288,
      values[values.length - 1].label,
      {
        anchor: "end",
        size: 10
      }
    );

    return svg;
  }

  // ==========================================================
  // HISTOGRAM
  // ==========================================================

  function renderHistogram(data) {
    const values = numericPairs(data);
    const svg = chartSvg(600, 300);

    const bins = Array(19).fill(0);

    for (const item of values) {
      const index = clamp(
        Math.round((item.value - 1) * 2),
        0,
        18
      );

      bins[index]++;
    }

    const max = Math.max(1, ...bins);

    bins.forEach((value, index) => {
      const barWidth = 25;
      const x = 62 + index * 27;

      const height =
        value / max * 190;

      drawSvgRect(
        svg,
        x,
        235 - height,
        barWidth,
        height,
        {
          radius: 3,
          fill: chartColor(index)
        }
      );

      if (index % 2 === 0) {
        drawSvgText(
          svg,
          x + barWidth / 2,
          253,
          (index / 2 + 1).toFixed(0),
          {
            anchor: "middle",
            size: 9
          }
        );
      }
    });

    drawSvgText(
      svg,
      300,
      285,
      "Rating",
      { anchor: "middle", size: 11 }
    );

    return svg;
  }

  // ==========================================================
  // SCATTER PLOT
  // ==========================================================

  function renderScatter(data) {
    const values = numericPairs(data);
    const svg = chartSvg(600, 310);

    const left = 50;
    const bottom = 260;
    const width = 500;
    const height = 220;

    const xValues = values.map((item, index) => {
      const parsed = Date.parse(item.releaseDate || "");
      return Number.isFinite(parsed)
        ? new Date(parsed).getFullYear()
        : index;
    });

    const minX = Math.min(0, ...xValues);
    const maxX = Math.max(minX + 1, ...xValues);
    const minY = Math.min(0, ...values.map(x => x.value));
    const maxY = Math.max(minY + 1, ...values.map(x => x.value));

    drawSvgLine(
      svg, left, 35, left, bottom
    );

    drawSvgLine(
      svg, left, bottom, 560, bottom
    );

    values.forEach((item, index) => {
      const x =
        left +
        (xValues[index] - minX) /
        (maxX - minX) * width;

      const y =
        bottom -
        (item.value - minY) /
        (maxY - minY) * height;

      const dot = svgElement(
        "circle",
        {
          cx: x,
          cy: y,
          r: 4.5,
          fill: chartColor(index),
          opacity: 0.8
        }
      );

      const tooltip = svgElement("title");
      tooltip.textContent =
        `${item.label}: ${item.value}`;

      dot.appendChild(tooltip);
      svg.appendChild(dot);
    });

    return svg;
  }

  // ==========================================================
  // RADAR CHART
  // ==========================================================

  function renderRadar(data) {
    const values = numericPairs(data)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const svg = chartSvg(600, 360);

    if (values.length < 3) return svg;

    const cx = 300;
    const cy = 174;
    const radius = 118;

    const max = Math.max(
      1,
      ...values.map(x => x.value)
    );

    function point(i, fraction) {
      const angle =
        -Math.PI / 2 +
        i / values.length * TAU;

      return {
        x: cx +
          Math.cos(angle) *
          radius * fraction,

        y: cy +
          Math.sin(angle) *
          radius * fraction
      };
    }

    for (let level = 1; level <= 4; level++) {
      const points = values.map(
        (_, i) => point(i, level / 4)
      );

      const polygon = svgElement(
        "polygon",
        {
          points: points.map(p =>
            `${p.x},${p.y}`
          ).join(" "),
          fill: "none",
          stroke: "rgba(175,204,255,.18)"
        }
      );

      svg.appendChild(polygon);
    }

    values.forEach((item, i) => {
      const outer = point(i, 1);

      drawSvgLine(
        svg,
        cx,
        cy,
        outer.x,
        outer.y
      );

      const label = point(i, 1.18);

      drawSvgText(
        svg,
        label.x,
        label.y,
        item.label.slice(0, 16),
        {
          anchor: "middle",
          size: 10
        }
      );
    });

    const polygon = svgElement(
      "polygon",
      {
        points: values.map(
          (item, i) => {
            const p = point(
              i,
              item.value / max
            );

            return `${p.x},${p.y}`;
          }
        ).join(" "),

        fill: "rgba(146,187,255,.2)",
        stroke: chartColor(0),
        "stroke-width": 2
      }
    );

    svg.appendChild(polygon);

    return svg;
  }

  // ==========================================================
  // TREEMAP
  // ==========================================================

  function renderTreemap(data) {
    const values = numericPairs(data)
      .filter(x => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 18);

    const svg = chartSvg(600, 330);

    function subdivide(items, x, y, w, h, vertical) {
      if (!items.length) return;

      if (items.length === 1) {
        const item = items[0];
        const index = values.indexOf(item);

        drawSvgRect(
          svg,
          x + 2,
          y + 2,
          w - 4,
          h - 4,
          {
            radius: 6,
            fill: chartColor(index),
            opacity: 0.62
          }
        );

        if (w > 65 && h > 32) {
          drawSvgText(
            svg,
            x + 9,
            y + 20,
            item.label.slice(0, Math.floor(w / 9)),
            {
              fill: "#ffffff",
              size: 11
            }
          );
        }

        return;
      }

      const total = items.reduce(
        (sum, item) => sum + item.value,
        0
      );

      const halfway = total / 2;

      let accum = 0;
      let split = 1;

      for (let i = 0; i < items.length - 1; i++) {
        accum += items[i].value;

        if (accum >= halfway) {
          split = i + 1;
          break;
        }
      }

      const first = items.slice(0, split);
      const second = items.slice(split);

      const sumFirst = first.reduce(
        (a, b) => a + b.value,
        0
      );

      const ratio = sumFirst / total;

      if (vertical) {
        subdivide(
          first, x, y, w * ratio, h, !vertical
        );

        subdivide(
          second,
          x + w * ratio,
          y,
          w * (1 - ratio),
          h,
          !vertical
        );
      } else {
        subdivide(
          first, x, y, w, h * ratio, !vertical
        );

        subdivide(
          second,
          x,
          y + h * ratio,
          w,
          h * (1 - ratio),
          !vertical
        );
      }
    }

    if (values.length) {
      subdivide(values, 8, 8, 584, 314, true);
    }

    return svg;
  }

  // ==========================================================
  // BOX AND WHISKER
  // ==========================================================

  function renderBoxPlot(data) {
    const values = numericPairs(data)
      .map(x => x.value)
      .sort((a, b) => a - b);

    const svg = chartSvg(600, 240);
    if (!values.length) return svg;

    function quantile(q) {
      const position =
        (values.length - 1) * q;

      const lower = Math.floor(position);
      const upper = Math.ceil(position);

      return lerp(
        values[lower],
        values[upper],
        position - lower
      );
    }

    const q1 = quantile(0.25);
    const median = quantile(0.5);
    const q3 = quantile(0.75);
    const min = values[0];
    const max = values[values.length - 1];
    const iqr = q3 - q1;

    const low = values.find(
      v => v >= q1 - 1.5 * iqr
    ) ?? min;

    const high = [...values].reverse().find(
      v => v <= q3 + 1.5 * iqr
    ) ?? max;

    const axisMin = Math.min(0, min);
    const axisMax = Math.max(10, max);

    const x = value =>
      45 +
      (value - axisMin) /
      Math.max(1, axisMax - axisMin) *
      510;

    drawSvgLine(
      svg,
      45,
      180,
      555,
      180
    );

    drawSvgLine(
      svg,
      x(low),
      110,
      x(high),
      110,
      {
        stroke: "#c2d7ff",
        width: 2
      }
    );

    drawSvgRect(
      svg,
      x(q1),
      75,
      Math.max(1, x(q3) - x(q1)),
      70,
      {
        radius: 5,
        fill: chartColor(0),
        opacity: 0.48
      }
    );

    for (const value of [
      low,
      median,
      high
    ]) {
      drawSvgLine(
        svg,
        x(value),
        value === median ? 73 : 92,
        x(value),
        value === median ? 147 : 128,
        {
          stroke: "#edf4ff",
          width: 2
        }
      );
    }

    values.filter(
      v => v < low || v > high
    ).forEach(value => {
      svg.appendChild(
        svgElement("circle", {
          cx: x(value),
          cy: 110,
          r: 3.5,
          fill: "#e1c69e"
        })
      );
    });

    drawSvgText(
      svg, 300, 215,
      `Median ${median.toFixed(2)} · Q1 ${q1.toFixed(2)} · Q3 ${q3.toFixed(2)}`,
      { anchor: "middle", size: 11 }
    );

    return svg;
  }

  // ==========================================================
  // STACKED BAR CHART
  // ==========================================================

  function renderStackedBar(data) {
    const values = numericPairs(data)
      .filter(x => x.value > 0)
      .slice(0, 16);

    const svg = chartSvg(600, 275);

    const total = values.reduce(
      (sum, item) => sum + item.value,
      0
    );

    if (!total) return svg;

    let x = 25;

    values.forEach((item, index) => {
      const width = item.value / total * 550;

      drawSvgRect(
        svg,
        x,
        88,
        width,
        55,
        {
          fill: chartColor(index),
          opacity: 0.8
        }
      );

      x += width;
    });

    drawSvgText(
      svg,
      300,
      52,
      `Total: ${total.toFixed(1)}`,
      {
        anchor: "middle",
        size: 17,
        fill: "#edf4ff"
      }
    );

    values.slice(0, 10).forEach(
      (item, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);

        drawSvgRect(
          svg,
          35 + col * 270,
          165 + row * 21,
          9,
          9,
          {
            fill: chartColor(index),
            radius: 2
          }
        );

        drawSvgText(
          svg,
          50 + col * 270,
          174 + row * 21,
          item.label.slice(0, 24),
          { size: 10 }
        );
      }
    );

    return svg;
  }

  // ==========================================================
  // GENRE NETWORK
  // ==========================================================

  function renderNetwork(overlap) {
    const svg = chartSvg(600, 370);

    const genres = overlap.counts
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);

    const cx = 300;
    const cy = 180;
    const radius = 125;

    const positions = new Map();

    genres.forEach((genre, index) => {
      const angle =
        -Math.PI / 2 +
        index / genres.length * TAU;

      positions.set(genre.label, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
      });
    });

    const pairCounts = new Map();

    for (const set of overlap.sets) {
      const filtered = set.genres.filter(
        genre => positions.has(genre)
      );

      for (let i = 0; i < filtered.length; i++) {
        for (let j = i + 1; j < filtered.length; j++) {
          const key = [
            filtered[i],
            filtered[j]
          ].sort().join("|");

          pairCounts.set(
            key,
            (pairCounts.get(key) || 0) +
              set.count
          );
        }
      }
    }

    for (const [key, count] of pairCounts) {
      const [a, b] = key.split("|");
      const pa = positions.get(a);
      const pb = positions.get(b);

      if (!pa || !pb) continue;

      drawSvgLine(
        svg,
        pa.x,
        pa.y,
        pb.x,
        pb.y,
        {
          stroke: "rgba(165,195,255,.24)",
          width: Math.min(5, 0.5 + count)
        }
      );
    }

    genres.forEach((genre, index) => {
      const p = positions.get(genre.label);

      svg.appendChild(
        svgElement("circle", {
          cx: p.x,
          cy: p.y,
          r: 5 + Math.sqrt(genre.value) * 3,
          fill: chartColor(index),
          opacity: 0.85
        })
      );

      drawSvgText(
        svg,
        p.x,
        p.y + (
          p.y > cy ? 27 : -17
        ),
        genre.label.slice(0, 17),
        {
          anchor: "middle",
          size: 10
        }
      );
    });

    return svg;
  }

  // ==========================================================
  // UPSET PLOT
  // ==========================================================

  function renderUpSet(overlap) {
    const sets = overlap.sets
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const genres = [...new Set(
      sets.flatMap(x => x.genres)
    )].slice(0, 8);

    const svg = chartSvg(
      600,
      Math.max(300, genres.length * 28 + 125)
    );

    if (!sets.length) return svg;

    const max = Math.max(
      1,
      ...sets.map(x => x.count)
    );

    const columnWidth = 37;
    const left = 125;
    const gridTop = 125;

    genres.forEach((genre, row) => {
      drawSvgText(
        svg,
        115,
        gridTop + row * 28 + 5,
        genre.slice(0, 15),
        {
          anchor: "end",
          size: 10
        }
      );
    });

    sets.forEach((set, column) => {
      const x = left + column * columnWidth;
      const barHeight = set.count / max * 70;

      drawSvgRect(
        svg,
        x - 10,
        100 - barHeight,
        20,
        barHeight,
        {
          radius: 3,
          fill: chartColor(column)
        }
      );

      const activeRows = [];

      genres.forEach((genre, row) => {
        const included =
          set.genres.includes(genre);

        const y =
          gridTop + row * 28;

        svg.appendChild(
          svgElement("circle", {
            cx: x,
            cy: y,
            r: included ? 4 : 2.5,
            fill: included
              ? "#dceaff"
              : "rgba(160,190,235,.18)"
          })
        );

        if (included) {
          activeRows.push(y);
        }
      });

      if (activeRows.length > 1) {
        drawSvgLine(
          svg,
          x,
          Math.min(...activeRows),
          x,
          Math.max(...activeRows),
          {
            stroke: chartColor(column),
            width: 1.5
          }
        );
      }
    });

    return svg;
  }

  // ==========================================================
  // VENN DIAGRAM
  // ==========================================================

  function renderVenn(overlap) {
    const svg = chartSvg(600, 340);

    const genres = overlap.counts
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);

    if (genres.length < 2) return svg;

    const locations = [
      { x: 250, y: 145 },
      { x: 350, y: 145 },
      { x: 300, y: 225 }
    ];

    genres.forEach((genre, index) => {
      const p = locations[index];

      svg.appendChild(
        svgElement("circle", {
          cx: p.x,
          cy: p.y,
          r: 94,
          fill: chartColor(index),
          "fill-opacity": 0.20,
          stroke: chartColor(index),
          "stroke-opacity": 0.62,
          "stroke-width": 1.4
        })
      );

      drawSvgText(
        svg,
        p.x,
        p.y - 56,
        genre.label,
        {
          anchor: "middle",
          size: 11
        }
      );
    });

    const selected = genres.map(g => g.label);

    const productions = STORE.all("production");

    // Exact membership signatures for the displayed sets.
    const signatureCounts = new Map();

    for (const production of productions) {
      const members = selected.filter(
        genre => (production.genres || [])
          .includes(genre)
      );

      if (!members.length) continue;

      const key = members.sort().join("|");

      signatureCounts.set(
        key,
        (signatureCounts.get(key) || 0) + 1
      );
    }

    const legend = [...signatureCounts]
      .sort((a, b) => b[1] - a[1]);

    legend.slice(0, 5).forEach(
      ([key, count], index) => {
        drawSvgText(
          svg,
          300,
          300 + index * 12,
          `${key.replaceAll("|", " ∩ ")}: ${count}`,
          {
            anchor: "middle",
            size: 9
          }
        );
      }
    );

    return svg;
  }

  // ==========================================================
  // CHORD DIAGRAM
  // ==========================================================

  function renderChord(overlap) {
    const svg = chartSvg(600, 365);

    const genres = overlap.counts
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const cx = 300;
    const cy = 175;
    const radius = 126;

    const positions = genres.map((genre, index) => {
      const angle =
        -Math.PI / 2 +
        index / Math.max(1, genres.length) * TAU;

      return {
        genre: genre.label,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius
      };
    });

    positions.forEach((a, index) => {
      for (let j = index + 1; j < positions.length; j++) {
        const b = positions[j];

        let weight = 0;

        for (const set of overlap.sets) {
          if (
            set.genres.includes(a.genre) &&
            set.genres.includes(b.genre)
          ) {
            weight += set.count;
          }
        }

        if (!weight) continue;

        const path = svgElement("path", {
          d:
            `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
          fill: "none",
          stroke: chartColor(index),
          "stroke-opacity": Math.min(0.65, 0.18 + weight * 0.07),
          "stroke-width": Math.min(7, weight * 1.3)
        });

        svg.appendChild(path);
      }
    });

    positions.forEach((p, index) => {
      svg.appendChild(
        svgElement("circle", {
          cx: p.x,
          cy: p.y,
          r: 6,
          fill: chartColor(index)
        })
      );

      drawSvgText(
        svg,
        p.x,
        p.y + (p.y > cy ? 19 : -13),
        p.genre.slice(0, 15),
        {
          anchor: "middle",
          size: 10
        }
      );
    });

    return svg;
  }

  // ==========================================================
  // STATISTICS RENDERER
  // ==========================================================

  function renderStatisticsChart(datasetId, chartId, data) {
    const container = element(
      "div",
      "chart-surface"
    );

    if (
      !STATS.compatible(datasetId, chartId)
    ) {
      container.appendChild(
        element(
          "p",
          "chart-notice",
          "This diagram is not compatible with the selected statistical data."
        )
      );

      return container;
    }

    const hasData = datasetId === "genreOverlap"
      ? data.sets.length > 0
      : Array.isArray(data) && data.length > 0;

    if (!hasData) {
      container.appendChild(
        makeEmptyState(
          "Not enough recorded information yet. Add viewing dates, durations, ratings or genres to generate this statistic."
        )
      );

      return container;
    }

    let chart = null;

    switch (chartId) {
      case "line":
        chart = renderLineChart(data);
        break;

      case "donut":
        chart = renderDonut(data);
        break;

      case "stackedBar":
        chart = renderStackedBar(data);
        break;

      case "treemap":
        chart = renderTreemap(data);
        break;

      case "radar":
        chart = renderRadar(data);
        break;

      case "venn":
        chart = renderVenn(data);
        break;

      case "upset":
        chart = renderUpSet(data);
        break;

      case "chord":
        chart = renderChord(data);
        break;

      case "network":
        chart = renderNetwork(data);
        break;

      case "histogram":
        chart = renderHistogram(data);
        break;

      case "boxPlot":
        chart = renderBoxPlot(data);
        break;

      case "rankedBar":
        chart = renderRankedBar(data);
        break;

      case "scatter":
        chart = renderScatter(data);
        break;
    }

    if (chart) {
      container.appendChild(chart);
    } else {
      container.appendChild(
        makeEmptyState(
          "This diagram could not be generated."
        )
      );
    }

    return container;
  }

  // ==========================================================
  // STATISTICS PANEL
  // ==========================================================

  function buildStatisticsPanel(container) {
    const overview = STORE.overview();

    const overviewGrid = element(
      "div",
      "stat-overview"
    );

    const cards = [
      ["Productions", overview.productions],
      ["Episodes", overview.episodes],
      ["Watch Time", formatDuration(overview.watchedMinutes)],
      ["Rated Productions", overview.ratedProductions]
    ];

    for (const [label, value] of cards) {
      const card = element(
        "div",
        "stat-card"
      );

      card.appendChild(
        element("strong", "", value)
      );

      card.appendChild(
        element("span", "", label)
      );

      overviewGrid.appendChild(card);
    }

    container.appendChild(overviewGrid);

    const preferred =
      STORE.data.preferences;

    let datasetId =
      preferred.statisticsDataset;

    let chartId =
      preferred.statisticsChart;

    if (
      !STATS.datasets.some(x => x.id === datasetId)
    ) {
      datasetId = "watchTime";
    }

    if (!STATS.compatible(datasetId, chartId)) {
      chartId =
        STATS.defaultChart(datasetId);
    }

    const selectorGrid = element(
      "div",
      "stats-selectors"
    );

    const datasetSelect = makeSelect(
      "Statistical Data",
      STATS.datasets.map(dataset => ({
        value: dataset.id,
        label: dataset.label
      })),
      datasetId
    );

    const chartSelect = makeSelect(
      "Diagram",
      STATS.chartsFor(datasetId).map(chart => ({
        value: chart.id,
        label: chart.label
      })),
      chartId
    );

    selectorGrid.append(
      datasetSelect.wrapper,
      chartSelect.wrapper
    );

    container.appendChild(selectorGrid);

    const chartArea = element("div");

    container.appendChild(chartArea);

    function populateChartOptions() {
      const options = STATS.chartsFor(datasetId);

      chartSelect.select.replaceChildren();

      for (const option of options) {
        const node = element(
          "option",
          "",
          option.label
        );

        node.value = option.id;
        chartSelect.select.appendChild(node);
      }

      if (
        !STATS.compatible(datasetId, chartId)
      ) {
        chartId =
          STATS.defaultChart(datasetId);
      }

      chartSelect.select.value = chartId;
    }

    function updateChart() {
      chartArea.replaceChildren();

      const data =
        getStatisticsData(datasetId);

      const chart = renderStatisticsChart(
        datasetId,
        chartId,
        data
      );

      chartArea.appendChild(chart);

      STORE.setStatisticsPreferences(
        datasetId,
        chartId
      );
    }

    datasetSelect.select.addEventListener(
      "change",
      () => {
        datasetId =
          datasetSelect.select.value;

        populateChartOptions();
        updateChart();
      }
    );

    chartSelect.select.addEventListener(
      "change",
      () => {
        chartId = chartSelect.select.value;
        updateChart();
      }
    );

    populateChartOptions();
    updateChart();
  }

  // ==========================================================
  // EXPORT AND IMPORT
  // ==========================================================

  function exportArchiveJSON() {
    const json = STORE.exportJSON();

    const blob = new Blob(
      [json],
      {
        type: "application/json"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    const date = new Date()
      .toISOString()
      .slice(0, 10);

    link.href = url;
    link.download =
      `watch-archive-${date}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    showToast("Archive export prepared.");
  }

  function requestArchiveImport() {
    const picker =
      document.createElement("input");

    picker.type = "file";
    picker.accept = ".json,application/json";

    picker.addEventListener(
      "change",
      async () => {
        const file = picker.files?.[0];
        if (!file) return;

        if (!confirm(
          "Importing will replace your current library and watchlist. Continue?"
        )) return;

        try {
          const text = await file.text();

          const result =
            STORE.importJSON(text, "replace");

          if (!result) {
            showToast(
              "Import failed. No archive data was replaced."
            );
            return;
          }

          archiveSkyDirty = true;

          showToast(
            "Archive imported successfully."
          );

          refreshCurrentPanel();

        } catch (error) {
          console.error(error);

          showToast(
            "Unable to read the selected file."
          );
        }
      }
    );

    picker.click();
  }

  // ==========================================================
  // USER INPUT — PAN AND TWO-FINGER ZOOM
  // ==========================================================

  function pointerPosition(event) {
    const rect =
      canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function pinchMetrics() {
    if (pointers.size !== 2) {
      return null;
    }

    const [a, b] =
      [...pointers.values()];

    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,

      distance: Math.max(
        1,
        Math.hypot(
          a.x - b.x,
          a.y - b.y
        )
      )
    };
  }

  function bindCanvasNavigation() {
    canvas.addEventListener(
      "pointerdown",
      event => {
        if (
          event.pointerType === "mouse" &&
          event.button !== 0
        ) return;

        event.preventDefault();
        startAmbientAudio();

        pointers.set(
          event.pointerId,
          pointerPosition(event)
        );

        try {
          canvas.setPointerCapture(
            event.pointerId
          );
        } catch (_) {}

        pinchState = pinchMetrics();
      }
    );

    canvas.addEventListener(
      "pointermove",
      event => {
        if (!pointers.has(event.pointerId)) {
          return;
        }

        event.preventDefault();

        const previous =
          pointers.get(event.pointerId);

        const current =
          pointerPosition(event);

        if (pointers.size === 1) {
          camera.x -=
            (current.x - previous.x) /
            camera.zoom;

          camera.y -=
            (current.y - previous.y) /
            camera.zoom;

          pointers.set(
            event.pointerId,
            current
          );

          archiveSkyDirty = true;
          return;
        }

        if (pointers.size === 2) {
          const before =
            pinchState || pinchMetrics();

          pointers.set(
            event.pointerId,
            current
          );

          const after = pinchMetrics();

          if (!before || !after) {
            return;
          }

          const worldX =
            camera.x +
            (before.x - W / 2) /
            camera.zoom;

          const worldY =
            camera.y +
            (before.y - H / 2) /
            camera.zoom;

          camera.zoom = clamp(
            camera.zoom *
              after.distance /
              before.distance,

            C.camera.minZoom,
            C.camera.maxZoom
          );

          camera.x =
            worldX -
            (after.x - W / 2) /
            camera.zoom;

          camera.y =
            worldY -
            (after.y - H / 2) /
            camera.zoom;

          pinchState = after;
          archiveSkyDirty = true;

          return;
        }

        pointers.set(
          event.pointerId,
          current
        );
      }
    );

    function releasePointer(event) {
      pointers.delete(
        event.pointerId
      );

      try {
        if (
          canvas.hasPointerCapture(
            event.pointerId
          )
        ) {
          canvas.releasePointerCapture(
            event.pointerId
          );
        }
      } catch (_) {}

      pinchState = pinchMetrics();
    }

    canvas.addEventListener(
      "pointerup",
      releasePointer
    );

    canvas.addEventListener(
      "pointercancel",
      releasePointer
    );

    canvas.addEventListener(
      "lostpointercapture",
      releasePointer
    );

    // Wheel and trackpad move around the universe.
    // Pinching two fingers is the zoom gesture.
    canvas.addEventListener(
      "wheel",
      event => {
        event.preventDefault();

        if (
          event.ctrlKey ||
          event.metaKey
        ) return;

        const multiplier =
          event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? H
              : 1;

        camera.x +=
          event.deltaX * multiplier /
          camera.zoom;

        camera.y +=
          event.deltaY * multiplier /
          camera.zoom;

        archiveSkyDirty = true;
      },
      { passive: false }
    );
  }

  // ==========================================================
  // MAIN RENDER LOOP
  // ==========================================================

  let lastArchiveCamera = "";

  function render(now) {
    requestAnimationFrame(render);

    const frameInterval =
      1000 / C.rendering.targetFPS;

    if (
      now - lastFrame < frameInterval
    ) return;

    const delta = previousTime
      ? Math.min(
          60,
          now - previousTime
        )
      : 16;

    previousTime = now;
    lastFrame = now;

    if (!reducedMotion) {
      sceneTime += delta;
    }

    ctx.setTransform(
      DPR, 0, 0, DPR, 0, 0
    );

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation =
      "source-over";

    drawBackground();

    drawNebulaLayer(0, sceneTime);
    drawStarLayer(0, sceneTime);

    drawNebulaLayer(1, sceneTime);
    drawStarLayer(1, sceneTime);

    drawNebulaLayer(2, sceneTime);
    drawStarLayer(2, sceneTime);

    drawNebulaLayer(3, sceneTime);
    drawMeteors(now);

    updateNavigationConstellation();

    const cameraSignature =
      `${camera.x.toFixed(2)}:${camera.y.toFixed(2)}:${camera.zoom.toFixed(4)}:${W}:${H}`;

    if (
      archiveSkyDirty ||
      lastArchiveCamera !==
        cameraSignature
    ) {
      renderArchiveSky();

      lastArchiveCamera =
        cameraSignature;
    }
  }

  // ==========================================================
  // INITIALIZATION
  // ==========================================================

  function initializeApplication() {
    resize();
    resetToStart();

    // Norma constellation buttons.
    navButtons.forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const name =
            button.dataset.panel;

          openMenu(name, button);
        }
      );
    });

    // Glass popup close.
    DOM.closePanel.addEventListener(
      "click",
      closePanel
    );

    // Home button.
    DOM.homeBtn.addEventListener(
      "click",
      () => {
        resetToStart();
        showToast(
          "Returned to the starting point."
        );
      }
    );

    // Keyboard escape.
    document.addEventListener(
      "keydown",
      event => {
        if (event.key === "Escape") {
          closePanel();
        }
      }
    );

    // Resize.
    window.addEventListener(
      "resize",
      () => {
        resize();
        archiveSkyDirty = true;
      }
    );

    // Rebuild generated stars when entries change.
    STORE.subscribe(() => {
      archiveSkyDirty = true;

      rebuildArchiveSkyNodes();
    });

    // Pause sound when the browser is hidden.
    document.addEventListener(
      "visibilitychange",
      () => {
        previousTime = 0;

        if (
          document.hidden &&
          audioCtx &&
          audioCtx.state === "running"
        ) {
          audioCtx.suspend().catch(
            () => {}
          );
        }
      }
    );

    bindCanvasNavigation();

    rebuildArchiveSkyNodes();
    updateNavigationConstellation();

    requestAnimationFrame(render);
  }

  // ==========================================================
  // PUBLIC API
  // ==========================================================

  window.SpaceUniverse = {
    camera,
    scene,

    resetToStart,
    focusWorldPoint,

    openPanel: openMenu,
    closePanel,

    openArchiveEntry,
    startAmbientAudio,

    refreshArchiveSky() {
      rebuildArchiveSkyNodes();
      archiveSkyDirty = true;
    }
  };

  window.WatchArchiveApp = {
    openMenu,
    openArchiveEntry,
    openCreationForm,
    openEntryEditor,
    refreshCurrentPanel,
    exportArchiveJSON,
    requestArchiveImport
  };

  // ==========================================================
  // START APP
  // ==========================================================

  initializeApplication();

})();
