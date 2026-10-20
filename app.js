"use strict";

(() => {
  const C = window.SPACE_CONFIG;
  const canvas = document.getElementById("spaceCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  if (!C || !canvas || !ctx) return;

  const TAU = Math.PI * 2;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const camera = { ...C.camera };
  const pointers = new Map();

  const nebulaCache = new Map();
  const planetCache = new Map();
  const asteroidCache = new Map();

  let W = 0;
  let H = 0;
  let DPR = 1;

  let lastFrameTime = 0;
  let lastAnimationTime = 0;
  let universeTime = 0;

  let pinchState = null;
  let shootingStar = null;
  let nextShootingStar = 0;

  let audioStarted = false;
  let audioCtx = null;
  let masterGain = null;

  // -------------------------------------------------
  // Utilities
  // -------------------------------------------------

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = t => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  function hash(a, b, salt = 0) {
    let n =
      Math.imul((a | 0) ^ 0x9e3779b1, 374761393) ^
      Math.imul((b | 0) ^ 0x85ebca77, 668265263) ^
      Math.imul((salt + C.seed) | 0, 2246822519);

    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;
    return (n >>> 0) / 4294967296;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let s = t;
      s = Math.imul(s ^ (s >>> 15), s | 1);
      s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
      return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFor(x, y, salt = 0) {
    return mulberry32((hash(x, y, salt) * 4294967295) >>> 0);
  }

  function choose(list, rnd) {
    return list[Math.floor(rnd() * list.length)];
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const bigint = parseInt(normalized, 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  function cacheGet(map, key) {
    if (!map.has(key)) return null;
    const value = map.get(key);
    map.delete(key);
    map.set(key, value);
    return value;
  }

  function cacheSet(map, key, value, maxSize) {
    map.set(key, value);
    while (map.size > maxSize) {
      const oldest = map.keys().next().value;
      map.delete(oldest);
    }
  }

  // -------------------------------------------------
  // Resize / Projection
  // -------------------------------------------------

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, C.rendering.maxPixelRatio);

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function project(x, y, parallax = 1, scale = camera.zoom) {
    return {
      x: W / 2 + (x - camera.x * parallax) * scale,
      y: H / 2 + (y - camera.y * parallax) * scale
    };
  }

  function visibleCells(cellSize, parallax = 1, scale = camera.zoom) {
    const worldHalfW = W / (2 * scale);
    const worldHalfH = H / (2 * scale);

    const centerX = camera.x * parallax;
    const centerY = camera.y * parallax;

    const minX = Math.floor((centerX - worldHalfW) / cellSize) - 1;
    const maxX = Math.ceil((centerX + worldHalfW) / cellSize) + 1;
    const minY = Math.floor((centerY - worldHalfH) / cellSize) - 1;
    const maxY = Math.ceil((centerY + worldHalfH) / cellSize) + 1;

    const out = [];
    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        out.push({ x: gx, y: gy });
      }
    }
    return out;
  }

  // -------------------------------------------------
  // Background
  // -------------------------------------------------

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.sky.backgroundTop);
    bg.addColorStop(1, C.sky.backgroundBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const vignette = ctx.createRadialGradient(
      W * 0.5,
      H * 0.48,
      Math.min(W, H) * 0.12,
      W * 0.5,
      H * 0.5,
      Math.max(W, H) * 0.74
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, `rgba(0,0,0,${C.sky.vignetteStrength})`);

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  // -------------------------------------------------
  // Nebulae (more photographic / less cartoony)
  // -------------------------------------------------

  function generateNebulaSprite(cellX, cellY) {
    const key = `${cellX}:${cellY}`;
    const cached = cacheGet(nebulaCache, key);
    if (cached) return cached;

    const rnd = rngFor(cellX, cellY, 8101);
    if (rnd() > C.nebulae.density) return null;

    const size = 1024;
    const off = document.createElement("canvas");
    off.width = off.height = size;
    const g = off.getContext("2d");

    const base1 = choose(C.nebulae.palette, rnd);
    const base2 = choose(C.nebulae.palette, rnd);
    const base3 = choose(C.nebulae.palette, rnd);

    g.clearRect(0, 0, size, size);
    g.globalCompositeOperation = "screen";

    const strands = 4 + Math.floor(rnd() * 4);
    const angle = rnd() * TAU;
    const centerX = size * (0.42 + rnd() * 0.16);
    const centerY = size * (0.42 + rnd() * 0.16);
    const overallLength = 240 + rnd() * 220;

    function blob(x, y, rx, ry, col, alpha) {
      const maxR = Math.max(rx, ry);
      g.save();
      g.translate(x, y);
      g.scale(rx / maxR, ry / maxR);

      const grad = g.createRadialGradient(0, 0, 0, 0, 0, maxR);
      grad.addColorStop(0, rgba(col, alpha));
      grad.addColorStop(0.16, rgba(col, alpha * 0.8));
      grad.addColorStop(0.5, rgba(col, alpha * 0.26));
      grad.addColorStop(1, rgba(col, 0));

      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, maxR, 0, TAU);
      g.fill();
      g.restore();
    }

    // broad dim gas
    for (let i = 0; i < 20; i++) {
      const t = rnd() * 2 - 1;
      const spread = 140 + rnd() * 180;
      const x = centerX + Math.cos(angle) * overallLength * t + (rnd() - 0.5) * spread;
      const y = centerY + Math.sin(angle) * overallLength * t + (rnd() - 0.5) * spread;

      blob(
        x,
        y,
        120 + rnd() * 180,
        40 + rnd() * 130,
        rnd() < 0.5 ? base1 : base2,
        0.012 + rnd() * 0.028
      );
    }

    // filament structures
    for (let s = 0; s < strands; s++) {
      const strandAngle = angle + (rnd() - 0.5) * 0.9;
      const amplitude = 35 + rnd() * 80;
      const thickness = 22 + rnd() * 55;
      const color = choose([base1, base2, base3], rnd);
      const phase = rnd() * TAU;
      const length = overallLength * (0.8 + rnd() * 0.35);

      for (let i = 0; i < 60; i++) {
        const t = i / 59;
        const along = (t - 0.5) * length * 2;
        const wave = Math.sin(t * TAU * (1.4 + rnd() * 2.4) + phase) * amplitude;
        const x = centerX + Math.cos(strandAngle) * along - Math.sin(strandAngle) * wave;
        const y = centerY + Math.sin(strandAngle) * along + Math.cos(strandAngle) * wave;
        const taper = Math.pow(Math.sin(Math.PI * t), 0.7);

        blob(
          x + (rnd() - 0.5) * 12,
          y + (rnd() - 0.5) * 12,
          thickness * (0.7 + rnd() * 0.6) * taper + 6,
          thickness * (0.32 + rnd() * 0.45) * taper + 6,
          color,
          (0.016 + rnd() * 0.05) * taper
        );
      }
    }

    // small bright knots
    for (let i = 0; i < 24; i++) {
      const x = centerX + (rnd() - 0.5) * overallLength * 1.6;
      const y = centerY + (rnd() - 0.5) * overallLength * 1.3;
      blob(
        x,
        y,
        16 + rnd() * 54,
        12 + rnd() * 44,
        rnd() < 0.7 ? base3 : base2,
        0.02 + rnd() * 0.06
      );
    }

    // dark cutouts to avoid "soft wallpaper" feeling
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 14; i++) {
      const x = centerX + (rnd() - 0.5) * overallLength * 1.4;
      const y = centerY + (rnd() - 0.5) * overallLength * 1.2;
      blob(
        x,
        y,
        30 + rnd() * 90,
        22 + rnd() * 80,
        [0, 0, 0],
        0.04 + rnd() * 0.08
      );
    }

    cacheSet(nebulaCache, key, off, C.rendering.nebulaCacheSize);
    return off;
  }

  function drawNebulae(time) {
    if (!C.motion.nebulae && reducedMotion) return;

    const parallax = 0.38;
    const scale = camera.zoom * 0.92;
    const drift = reducedMotion ? 0 : Math.sin(time * C.nebulae.driftSpeed) * 14;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = C.nebulae.opacity;

    for (const cell of visibleCells(C.nebulae.cellSize, parallax, scale)) {
      const sprite = generateNebulaSprite(cell.x, cell.y);
      if (!sprite) continue;

      const rnd = rngFor(cell.x, cell.y, 5221);
      const worldX = cell.x * C.nebulae.cellSize + (rnd() - 0.5) * 620;
      const worldY = cell.y * C.nebulae.cellSize + (rnd() - 0.5) * 620;
      const pos = project(worldX, worldY, parallax, scale);

      const size = lerp(C.nebulae.sizeMin, C.nebulae.sizeMax, rnd()) * scale;
      const rotation = rnd() * TAU;

      ctx.save();
      ctx.translate(pos.x + drift, pos.y - drift * 0.35);
      ctx.rotate(rotation);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    ctx.restore();
  }

  // -------------------------------------------------
  // Stars
  // -------------------------------------------------

  function drawStarPoint(x, y, radius, color, alpha, glowStrength) {
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return;

    if (glowStrength > 0) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 10);
      halo.addColorStop(0, `rgba(255,255,255,${alpha * 0.28})`);
      halo.addColorStop(0.24, `rgba(150,190,255,${alpha * glowStrength})`);
      halo.addColorStop(1, "rgba(60,100,160,0)");
      ctx.fillStyle = halo;
      circle(x, y, radius * 10);
      ctx.fill();
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    circle(x, y, Math.max(0.22, radius));
    ctx.fill();

    if (radius > 1.4) {
      ctx.strokeStyle = `rgba(220,235,255,${alpha * 0.14})`;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(x - radius * 6, y);
      ctx.lineTo(x + radius * 6, y);
      ctx.moveTo(x, y - radius * 6);
      ctx.lineTo(x, y + radius * 6);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  function drawStarLayer(layer, time) {
    const configs = [
      { count: C.stars.distantCount, parallax: 0.18, scaleFactor: 0.6, sizeBoost: 0.7 },
      { count: C.stars.middleCount, parallax: 0.5, scaleFactor: 0.82, sizeBoost: 1 },
      { count: C.stars.nearCount, parallax: 1, scaleFactor: 1, sizeBoost: 1.15 }
    ];

    const conf = configs[layer];
    const scale = camera.zoom * conf.scaleFactor;

    for (const cell of visibleCells(C.stars.cellSize, conf.parallax, scale)) {
      const rnd = rngFor(cell.x, cell.y, 1300 + layer);

      for (let i = 0; i < conf.count; i++) {
        const wx = cell.x * C.stars.cellSize + rnd() * C.stars.cellSize;
        const wy = cell.y * C.stars.cellSize + rnd() * C.stars.cellSize;

        const brightnessSeed = rnd();
        const phase = rnd() * TAU;
        const twinkle = reducedMotion
          ? 1
          : 0.85 + Math.sin(time * C.stars.twinkleSpeed * (0.8 + rnd() * 1.4) + phase) * 0.15;

        const pos = project(wx, wy, conf.parallax, scale);
        const baseRadius =
          layer === 0
            ? 0.18 + Math.pow(brightnessSeed, 4) * 0.72
            : layer === 1
              ? 0.28 + Math.pow(brightnessSeed, 4.5) * 1.6
              : 0.38 + Math.pow(brightnessSeed, 5.3) * 2.1;

        const radius = clamp(baseRadius * Math.sqrt(scale) * conf.sizeBoost, 0.2, 4.4);
        const alpha = (0.22 + Math.pow(rnd(), 0.45) * 0.76) * twinkle;
        const glowStrength = brightnessSeed > 0.9 ? 0.12 + rnd() * 0.2 : 0;

        drawStarPoint(
          pos.x,
          pos.y,
          radius,
          choose(C.stars.colors, rnd),
          alpha,
          glowStrength
        );
      }
    }
  }

  // -------------------------------------------------
  // Planet textures
  // -------------------------------------------------

  function makePlanetSprite(radius, palette, seed) {
    const key = `${radius}:${palette.base}:${palette.dark}:${palette.light}:${seed}`;
    const cached = cacheGet(planetCache, key);
    if (cached) return cached;

    const size = Math.ceil(radius * 2 + 120);
    const off = document.createElement("canvas");
    off.width = off.height = size;
    const g = off.getContext("2d");
    const rnd = mulberry32(seed);

    const cx = size / 2;
    const cy = size / 2;
    const r = radius;

    const base = hexToRgb(palette.base);
    const dark = hexToRgb(palette.dark);
    const light = hexToRgb(palette.light);
    const cloud = hexToRgb(palette.cloud);

    // halo
    let grad = g.createRadialGradient(cx, cy, r * 0.65, cx, cy, r * 1.35);
    grad.addColorStop(0, "rgba(90,140,200,0.02)");
    grad.addColorStop(0.7, "rgba(90,150,220,0.08)");
    grad.addColorStop(1, "rgba(90,150,220,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, r * 1.35, 0, TAU);
    g.fill();

    g.save();
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.clip();

    // base sphere gradient
    grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    grad.addColorStop(0, `rgb(${light.r},${light.g},${light.b})`);
    grad.addColorStop(0.5, `rgb(${base.r},${base.g},${base.b})`);
    grad.addColorStop(1, `rgb(${dark.r},${dark.g},${dark.b})`);
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);

    // surface banding / textural forms
    for (let i = 0; i < 55; i++) {
      const y = cy + (rnd() * 2 - 1) * r;
      const h = Math.max(1, r * (0.01 + rnd() * 0.055));
      const width = r * (0.8 + rnd() * 0.45);
      const alpha = 0.02 + rnd() * 0.06;

      g.fillStyle =
        rnd() < 0.58
          ? `rgba(${light.r},${light.g},${light.b},${alpha})`
          : `rgba(${dark.r},${dark.g},${dark.b},${alpha * 1.3})`;

      g.beginPath();
      g.ellipse(
        cx + (rnd() - 0.5) * r * 0.16,
        y,
        width,
        h,
        (rnd() - 0.5) * 0.08,
        0,
        TAU
      );
      g.fill();
    }

    // crater/continent-like patches
    for (let i = 0; i < 28; i++) {
      const x = cx + (rnd() * 2 - 1) * r * 0.8;
      const y = cy + (rnd() * 2 - 1) * r * 0.8;
      const rx = r * (0.03 + rnd() * 0.12);
      const ry = rx * (0.6 + rnd() * 0.8);

      g.fillStyle =
        rnd() < 0.45
          ? `rgba(${dark.r},${dark.g},${dark.b},${0.08 + rnd() * 0.12})`
          : `rgba(${light.r},${light.g},${light.b},${0.04 + rnd() * 0.08})`;

      g.beginPath();
      g.ellipse(x, y, rx, ry, rnd() * TAU, 0, TAU);
      g.fill();
    }

    // clouds
    for (let i = 0; i < 16; i++) {
      const x = cx + (rnd() * 2 - 1) * r * 0.68;
      const y = cy + (rnd() * 2 - 1) * r * 0.68;
      const rx = r * (0.08 + rnd() * 0.18);
      const ry = rx * (0.32 + rnd() * 0.45);

      const cg = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      cg.addColorStop(0, `rgba(${cloud.r},${cloud.g},${cloud.b},${0.1 + rnd() * 0.08})`);
      cg.addColorStop(1, `rgba(${cloud.r},${cloud.g},${cloud.b},0)`);
      g.fillStyle = cg;

      g.save();
      g.translate(x, y);
      g.rotate(rnd() * TAU);
      g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
      g.beginPath();
      g.arc(0, 0, Math.max(rx, ry), 0, TAU);
      g.fill();
      g.restore();
    }

    // day/night spherical shading
    grad = g.createRadialGradient(
      cx - r * 0.42,
      cy - r * 0.45,
      r * 0.08,
      cx + r * 0.12,
      cy + r * 0.08,
      r * 1.32
    );
    grad.addColorStop(0, "rgba(255,255,255,0.12)");
    grad.addColorStop(0.33, "rgba(255,255,255,0.03)");
    grad.addColorStop(0.62, "rgba(0,0,0,0.1)");
    grad.addColorStop(0.78, "rgba(0,0,0,0.42)");
    grad.addColorStop(1, "rgba(0,0,0,0.95)");
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);

    g.restore();

    // terminator rim
    g.strokeStyle = "rgba(170,210,255,0.18)";
    g.lineWidth = Math.max(1, r * 0.01);
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.stroke();

    const sprite = { canvas: off, size };
    cacheSet(planetCache, key, sprite, C.rendering.planetCacheSize);
    return sprite;
  }

  function drawPlanet(worldX, worldY, radius, palette, seed, time) {
    const driftAmount = reducedMotion || !C.motion.planets
      ? 0
      : Math.sin(time * 0.00012 + seed) * C.planets.driftAmplitude;

    const pos = project(worldX + driftAmount, worldY - driftAmount * 0.4);
    const scaledRadius = radius * camera.zoom;

    if (
      scaledRadius < 4 ||
      pos.x + scaledRadius < -80 ||
      pos.x - scaledRadius > W + 80 ||
      pos.y + scaledRadius < -80 ||
      pos.y - scaledRadius > H + 80
    ) {
      return;
    }

    const sprite = makePlanetSprite(radius, palette, seed);
    const size = sprite.size * camera.zoom;

    ctx.drawImage(
      sprite.canvas,
      pos.x - size / 2,
      pos.y - size / 2,
      size,
      size
    );
  }

  function drawPlanets(time) {
    // Main hero planet
    drawPlanet(560, -140, 200, C.planets.palettes[0], 9011, time);

    // Secondary moon-like body
    drawPlanet(-980, -690, 120, C.planets.palettes[1], 22981, time);

    for (const cell of visibleCells(C.planets.cellSize)) {
      const rnd = rngFor(cell.x, cell.y, 7007);
      if (rnd() > C.planets.probability) continue;

      const x = cell.x * C.planets.cellSize + rnd() * C.planets.cellSize;
      const y = cell.y * C.planets.cellSize + rnd() * C.planets.cellSize;

      if (Math.hypot(x - 560, y + 140) < 900) continue;
      if (Math.hypot(x + 980, y + 690) < 700) continue;

      const radius = lerp(C.planets.minRadius, C.planets.maxRadius, rnd());
      const palette = choose(C.planets.palettes, rnd);
      const seed = Math.floor(rnd() * 999999);

      drawPlanet(x, y, radius, palette, seed, time);
    }
  }

  // -------------------------------------------------
  // Asteroid sprites / drawing
  // -------------------------------------------------

  function makeAsteroidSprite(radius, seed) {
    const key = `${radius}:${seed}`;
    const cached = cacheGet(asteroidCache, key);
    if (cached) return cached;

    const rnd = mulberry32(seed);
    const pad = Math.ceil(radius * 1.1 + 12);
    const size = pad * 2;
    const off = document.createElement("canvas");
    off.width = off.height = size;
    const g = off.getContext("2d");

    const cx = size / 2;
    const cy = size / 2;

    const points = [];
    const count = 10 + Math.floor(rnd() * 5);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU;
      const dist = radius * (0.68 + rnd() * 0.42);
      points.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist
      });
    }

    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.closePath();
    g.clip();

    let grad = g.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    grad.addColorStop(0, "#b5b6b2");
    grad.addColorStop(0.32, "#7d817d");
    grad.addColorStop(0.7, "#3d4246");
    grad.addColorStop(1, "#12171f");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);

    // crater forms
    for (let i = 0; i < 22; i++) {
      const x = cx + (rnd() * 2 - 1) * radius * 0.7;
      const y = cy + (rnd() * 2 - 1) * radius * 0.7;
      const r = radius * (0.05 + rnd() * 0.18);

      const dark = g.createRadialGradient(x, y, 0, x, y, r);
      dark.addColorStop(0, `rgba(0,0,0,${0.18 + rnd() * 0.2})`);
      dark.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = dark;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();

      g.strokeStyle = `rgba(210,215,215,${0.05 + rnd() * 0.07})`;
      g.lineWidth = 0.8;
      g.beginPath();
      g.arc(x - r * 0.1, y - r * 0.1, r * 0.8, 0, TAU);
      g.stroke();
    }

    // faceting
    for (let i = 0; i < 7; i++) {
      g.beginPath();
      const a = points[Math.floor(rnd() * points.length)];
      const b = points[Math.floor(rnd() * points.length)];
      const mx = cx + (rnd() * 2 - 1) * radius * 0.35;
      const my = cy + (rnd() * 2 - 1) * radius * 0.35;
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.lineTo(mx, my);
      g.closePath();
      g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.07)";
      g.fill();
    }

    // overall shading
    grad = g.createRadialGradient(
      cx - radius * 0.45,
      cy - radius * 0.45,
      radius * 0.12,
      cx + radius * 0.1,
      cy + radius * 0.1,
      radius * 1.3
    );
    grad.addColorStop(0, "rgba(255,255,255,0.18)");
    grad.addColorStop(0.34, "rgba(255,255,255,0.02)");
    grad.addColorStop(0.72, "rgba(0,0,0,0.18)");
    grad.addColorStop(1, "rgba(0,0,0,0.82)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);

    // edge restore
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.closePath();
    g.strokeStyle = "rgba(180,190,200,0.12)";
    g.lineWidth = 1;
    g.stroke();

    const sprite = { canvas: off, size };
    cacheSet(asteroidCache, key, sprite, C.rendering.asteroidCacheSize);
    return sprite;
  }

  function drawAsteroid(worldX, worldY, radius, seed, time) {
    const drift = reducedMotion || !C.motion.asteroids
      ? 0
      : Math.sin(time * C.asteroids.driftSpeed + seed * 0.0001) * 8;

    const pos = project(worldX + drift, worldY + drift * 0.4);
    const scaledRadius = radius * camera.zoom;

    if (
      scaledRadius < 0.8 ||
      pos.x + scaledRadius < -100 ||
      pos.x - scaledRadius > W + 100 ||
      pos.y + scaledRadius < -100 ||
      pos.y - scaledRadius > H + 100
    ) {
      return;
    }

    const sprite = makeAsteroidSprite(radius, seed);
    const size = sprite.size * camera.zoom;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(Math.sin(time * 0.00005 + seed) * 0.12);
    ctx.drawImage(sprite.canvas, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  function drawAsteroids(time) {
    // More restrained "hero" asteroid field around main planet
    const clusterRng = rngFor(4, 8, 9090);

    for (let i = 0; i < 26; i++) {
      const angle = clusterRng() * TAU;
      const distance = 250 + Math.pow(clusterRng(), 0.7) * 540;
      const worldX = 560 + Math.cos(angle) * distance;
      const worldY = -140 + Math.sin(angle) * distance * 0.78;
      const radius = 4 + Math.pow(clusterRng(), 3.2) * 42;
      const seed = Math.floor(clusterRng() * 999999);

      drawAsteroid(worldX, worldY, radius, seed, time);
    }

    for (const cell of visibleCells(C.asteroids.cellSize)) {
      const rnd = rngFor(cell.x, cell.y, 4411);
      if (rnd() > C.asteroids.density) continue;

      const count = 1 + Math.floor(rnd() * C.asteroids.maxPerCell);

      for (let i = 0; i < count; i++) {
        const x = cell.x * C.asteroids.cellSize + rnd() * C.asteroids.cellSize;
        const y = cell.y * C.asteroids.cellSize + rnd() * C.asteroids.cellSize;
        const radius = lerp(
          C.asteroids.minRadius,
          C.asteroids.maxRadius,
          Math.pow(rnd(), 2.1)
        );
        const seed = Math.floor(rnd() * 999999);
        drawAsteroid(x, y, radius, seed, time);
      }
    }
  }

  // -------------------------------------------------
  // Shooting stars
  // -------------------------------------------------

  function scheduleShootingStar(now) {
    nextShootingStar = now + lerp(
      C.shootingStars.minDelay,
      C.shootingStars.maxDelay,
      Math.random()
    );
  }

  function drawShootingStars(now) {
    if (reducedMotion || !C.motion.shootingStars || !C.shootingStars.enabled) return;

    if (!nextShootingStar) scheduleShootingStar(now);

    if (!shootingStar && now > nextShootingStar) {
      shootingStar = {
        born: now,
        x: Math.random() * W,
        y: Math.random() * H * 0.6,
        angle: Math.PI * (0.1 + Math.random() * 0.25),
        distance: 180 + Math.random() * 280,
        duration: C.shootingStars.duration
      };
    }

    if (!shootingStar) return;

    const s = shootingStar;
    const t = (now - s.born) / s.duration;
    if (t >= 1) {
      shootingStar = null;
      scheduleShootingStar(now);
      return;
    }

    const p = smoothstep(t);
    const alpha = Math.sin(t * Math.PI) * 0.8;

    const hx = s.x + Math.cos(s.angle) * s.distance * p;
    const hy = s.y + Math.sin(s.angle) * s.distance * p;
    const tailLen = 90 + 100 * (1 - t);
    const tx = hx - Math.cos(s.angle) * tailLen;
    const ty = hy - Math.sin(s.angle) * tailLen;

    const grad = ctx.createLinearGradient(tx, ty, hx, hy);
    grad.addColorStop(0, "rgba(70,120,255,0)");
    grad.addColorStop(0.74, `rgba(150,200,255,${alpha * 0.35})`);
    grad.addColorStop(1, `rgba(255,255,255,${alpha})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14);
    glow.addColorStop(0, `rgba(255,255,255,${alpha * 0.65})`);
    glow.addColorStop(1, "rgba(120,180,255,0)");
    ctx.fillStyle = glow;
    circle(hx, hy, 14);
    ctx.fill();
  }

  // -------------------------------------------------
  // Ambient audio
  // -------------------------------------------------

  function startAmbientAudio() {
    if (!C.ambientAudio.enabled || audioStarted) return;
    audioStarted = true;

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = C.ambientAudio.volume;
      masterGain.connect(audioCtx.destination);

      const lowNoiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
      const data = lowNoiseBuffer.getChannelData(0);

      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.28;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = lowNoiseBuffer;
      noise.loop = true;

      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.value = 340;
      noiseFilter.Q.value = 0.3;

      const noiseHighpass = audioCtx.createBiquadFilter();
      noiseHighpass.type = "highpass";
      noiseHighpass.frequency.value = 28;

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0.65;

      const osc1 = audioCtx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 52;

      const osc2 = audioCtx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 81;

      const osc1Gain = audioCtx.createGain();
      osc1Gain.gain.value = 0.05;

      const osc2Gain = audioCtx.createGain();
      osc2Gain.gain.value = 0.03;

      const lfo1 = audioCtx.createOscillator();
      lfo1.type = "sine";
      lfo1.frequency.value = 0.03;

      const lfo1Gain = audioCtx.createGain();
      lfo1Gain.gain.value = 18;

      const lfo2 = audioCtx.createOscillator();
      lfo2.type = "sine";
      lfo2.frequency.value = 0.021;

      const lfo2Gain = audioCtx.createGain();
      lfo2Gain.gain.value = 10;

      lfo1.connect(lfo1Gain);
      lfo1Gain.connect(osc1.frequency);

      lfo2.connect(lfo2Gain);
      lfo2Gain.connect(osc2.frequency);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseHighpass);
      noiseHighpass.connect(noiseGain);
      noiseGain.connect(masterGain);

      osc1.connect(osc1Gain);
      osc2.connect(osc2Gain);
      osc1Gain.connect(masterGain);
      osc2Gain.connect(masterGain);

      noise.start();
      osc1.start();
      osc2.start();
      lfo1.start();
      lfo2.start();
    } catch (err) {
      console.warn("Ambient audio could not start:", err);
    }
  }

  // -------------------------------------------------
  // Pointer controls
  // -------------------------------------------------

  function getPointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function currentPinchMetrics() {
    const values = [...pointers.values()];
    if (values.length !== 2) return null;

    const a = values[0];
    const b = values[1];

    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
    };
  }

  function maybeStartAudioFromGesture() {
    if (C.ambientAudio.startOnFirstGesture) {
      startAmbientAudio();
    }
  }

  canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    maybeStartAudioFromGesture();

    const pos = getPointerPosition(event);
    pointers.set(event.pointerId, pos);

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_) {}

    if (pointers.size === 2) {
      pinchState = currentPinchMetrics();
    } else if (pointers.size > 2) {
      pinchState = null;
    }
  });

  canvas.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;

    event.preventDefault();

    const prev = pointers.get(event.pointerId);
    const curr = getPointerPosition(event);

    if (pointers.size === 1) {
      camera.x -= (curr.x - prev.x) / camera.zoom;
      camera.y -= (curr.y - prev.y) / camera.zoom;
      pointers.set(event.pointerId, curr);
      return;
    }

    if (pointers.size === 2) {
      const before = pinchState || currentPinchMetrics();

      pointers.set(event.pointerId, curr);

      const after = currentPinchMetrics();
      if (!before || !after) return;

      const anchorWorldX = camera.x + (before.x - W / 2) / camera.zoom;
      const anchorWorldY = camera.y + (before.y - H / 2) / camera.zoom;

      const newZoom = clamp(
        camera.zoom * (after.distance / before.distance),
        C.camera.minZoom,
        C.camera.maxZoom
      );

      camera.zoom = newZoom;
      camera.x = anchorWorldX - (after.x - W / 2) / newZoom;
      camera.y = anchorWorldY - (after.y - H / 2) / newZoom;

      pinchState = after;
      return;
    }

    pointers.set(event.pointerId, curr);
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);

    try {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}

    pinchState = pointers.size === 2 ? currentPinchMetrics() : null;
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);

  // wheel / trackpad only pan, never zoom
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) return;

    maybeStartAudioFromGesture();

    const multiplier =
      event.deltaMode === 1 ? 16 :
      event.deltaMode === 2 ? H : 1;

    camera.x += (event.deltaX * multiplier) / camera.zoom;
    camera.y += (event.deltaY * multiplier) / camera.zoom;
  }, { passive: false });

  // -------------------------------------------------
  // Render
  // -------------------------------------------------

  function render(now) {
    const targetFrame = 1000 / C.rendering.targetFPS;

    if (now - lastFrameTime < targetFrame) {
      requestAnimationFrame(render);
      return;
    }

    const delta = lastAnimationTime ? Math.min(60, now - lastAnimationTime) : 16;
    lastAnimationTime = now;
    lastFrameTime = now;

    if (!reducedMotion) {
      universeTime += delta;
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);

    drawBackground();
    drawStarLayer(0, universeTime);
    drawNebulae(universeTime);
    drawStarLayer(1, universeTime);
    drawPlanets(universeTime);
    drawStarLayer(2, universeTime);
    drawAsteroids(universeTime);
    drawShootingStars(now);

    requestAnimationFrame(render);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    lastAnimationTime = 0;
  });

  resize();
  requestAnimationFrame(render);

  window.SpaceUniverse = {
    camera,
    moveTo(x, y) {
      camera.x = x;
      camera.y = y;
    },
    setZoom(value) {
      camera.zoom = clamp(value, C.camera.minZoom, C.camera.maxZoom);
    },
    startAmbientAudio
  };
})();
