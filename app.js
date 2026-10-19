"use strict";

(() => {
  const CONFIG = window.SPACE_CONFIG;
  const canvas = document.getElementById("spaceCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  if (!ctx || !CONFIG) return;

  const TAU = Math.PI * 2;
  const camera = { ...CONFIG.camera };
  const pointers = new Map();
  const nebulaCache = new Map();

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let lastTime = 0;
  let sceneTime = 0;
  let pinchState = null;
  let shootingStar = null;
  let nextShootingStar = 0;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  function fract(v) {
    return v - Math.floor(v);
  }

  function hash(x, y, salt = 0) {
    let n =
      Math.imul(x, 374761393) ^
      Math.imul(y, 668265263) ^
      Math.imul((CONFIG.seed + salt), 1274126177);

    n = Math.imul(n ^ (n >>> 13), 1274126177);
    n ^= n >>> 16;

    return (n >>> 0) / 4294967296;
  }

  function randomGenerator(seed) {
    let s = seed >>> 0;
    return () => {
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFor(x, y, salt) {
    return randomGenerator(Math.floor(hash(x, y, salt) * 4294967295));
  }

  function choose(array, rnd) {
    return array[Math.floor(rnd() * array.length)];
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;

    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.rendering.maxPixelRatio);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function project(x, y, parallax = 1, zoomScale = camera.zoom) {
    return {
      x: width / 2 + (x - camera.x * parallax) * zoomScale,
      y: height / 2 + (y - camera.y * parallax) * zoomScale
    };
  }

  function visibleCells(cellSize, parallax = 1, zoomScale = camera.zoom) {
    const halfW = width / (2 * zoomScale);
    const halfH = height / (2 * zoomScale);

    const cx = camera.x * parallax;
    const cy = camera.y * parallax;

    const minX = Math.floor((cx - halfW) / cellSize) - 1;
    const maxX = Math.ceil((cx + halfW) / cellSize) + 1;
    const minY = Math.floor((cy - halfH) / cellSize) - 1;
    const maxY = Math.ceil((cy + halfH) / cellSize) + 1;

    const cells = [];

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        cells.push({ x: gx, y: gy });
      }
    }

    return cells;
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#041121");
    bg.addColorStop(0.42, "#04101d");
    bg.addColorStop(1, "#01040b");

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const atmospheric = ctx.createRadialGradient(
      width * 0.3, height * 0.45, 0,
      width * 0.3, height * 0.45, Math.max(width, height) * 0.95
    );
    atmospheric.addColorStop(0, "rgba(42, 110, 205, 0.10)");
    atmospheric.addColorStop(0.35, "rgba(18, 44, 105, 0.05)");
    atmospheric.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = atmospheric;
    ctx.fillRect(0, 0, width, height);
  }

  function drawKeyLight() {
    const sunX = width * 0.075;
    const sunY = height * 0.5;

    const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 180);
    glow.addColorStop(0, "rgba(255,255,255,0.95)");
    glow.addColorStop(0.08, "rgba(201,231,255,0.85)");
    glow.addColorStop(0.22, "rgba(122,187,255,0.35)");
    glow.addColorStop(1, "rgba(90,160,255,0)");

    ctx.fillStyle = glow;
    circle(sunX, sunY, 180);
    ctx.fill();

    ctx.fillStyle = "#f9ffff";
    circle(sunX, sunY, 4.5);
    ctx.fill();

    // Lens flare line
    const lineGrad = ctx.createLinearGradient(0, sunY, width, sunY);
    lineGrad.addColorStop(0, "rgba(90, 175, 255, 0)");
    lineGrad.addColorStop(0.15, "rgba(120, 190, 255, 0.28)");
    lineGrad.addColorStop(0.5, "rgba(100, 180, 255, 0.10)");
    lineGrad.addColorStop(0.85, "rgba(120, 190, 255, 0.22)");
    lineGrad.addColorStop(1, "rgba(90, 175, 255, 0)");

    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, sunY - 1, width, 2);

    ctx.fillStyle = "rgba(140, 200, 255, 0.06)";
    ctx.fillRect(0, sunY - 7, width, 14);
  }

  function makeNebula(cellX, cellY) {
    const key = `${cellX}:${cellY}`;

    if (nebulaCache.has(key)) {
      const cached = nebulaCache.get(key);
      nebulaCache.delete(key);
      nebulaCache.set(key, cached);
      return cached;
    }

    const rnd = rngFor(cellX, cellY, 9137);
    if (rnd() > CONFIG.nebulae.density) return null;

    const size = 900;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;

    const g = c.getContext("2d");
    const palette = CONFIG.nebulae.colors;
    const colorA = choose(palette, rnd);
    const colorB = choose(palette, rnd);
    const colorC = choose(palette, rnd);

    g.clearRect(0, 0, size, size);
    g.globalCompositeOperation = "screen";

    const centerX = 450 + (rnd() - 0.5) * 160;
    const centerY = 450 + (rnd() - 0.5) * 160;
    const axisAngle = rnd() * TAU;
    const stretch = 200 + rnd() * 220;

    function cloud(x, y, rx, ry, color, alpha) {
      g.save();
      g.translate(x, y);
      g.rotate(rnd() * TAU);
      g.scale(1, ry / rx);

      const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      grad.addColorStop(0, rgba(color, alpha));
      grad.addColorStop(0.22, rgba(color, alpha * 0.70));
      grad.addColorStop(0.55, rgba(color, alpha * 0.22));
      grad.addColorStop(1, rgba(color, 0));

      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, rx, 0, TAU);
      g.fill();
      g.restore();
    }

    // broad smoky base
    for (let i = 0; i < 42; i++) {
      const t = (i / 41) * 2 - 1;
      const drift = Math.sin(t * Math.PI * (1.1 + rnd())) * (65 + rnd() * 90);

      const x = centerX + Math.cos(axisAngle) * t * stretch + drift * 0.55;
      const y = centerY + Math.sin(axisAngle) * t * stretch - drift * 0.25;

      cloud(
        x + (rnd() - 0.5) * 90,
        y + (rnd() - 0.5) * 90,
        130 + rnd() * 170,
        55 + rnd() * 120,
        rnd() < 0.5 ? colorA : colorB,
        0.012 + rnd() * 0.03
      );
    }

    // inner brighter streams
    for (let band = 0; band < 4; band++) {
      const offset = (rnd() - 0.5) * 140;
      const freq = 1.2 + rnd() * 2.6;
      const phase = rnd() * TAU;

      for (let i = 0; i < 60; i++) {
        const t = i / 59;
        const along = (t - 0.5) * stretch * 2.2;
        const wave = Math.sin(t * freq * TAU + phase) * (18 + rnd() * 38);

        const x = centerX + Math.cos(axisAngle) * along - Math.sin(axisAngle) * (offset + wave);
        const y = centerY + Math.sin(axisAngle) * along + Math.cos(axisAngle) * (offset + wave);

        const taper = Math.pow(Math.sin(t * Math.PI), 0.8);

        cloud(
          x,
          y,
          40 + rnd() * 70,
          16 + rnd() * 34,
          band % 2 ? colorC : colorB,
          (0.02 + rnd() * 0.045) * taper
        );
      }
    }

    // subtle bright knots
    for (let i = 0; i < 18; i++) {
      cloud(
        centerX + (rnd() - 0.5) * 340,
        centerY + (rnd() - 0.5) * 260,
        16 + rnd() * 42,
        12 + rnd() * 28,
        rnd() < 0.4 ? [145, 205, 255] : colorA,
        0.03 + rnd() * 0.06
      );
    }

    nebulaCache.set(key, c);

    while (nebulaCache.size > CONFIG.rendering.nebulaCacheSize) {
      const oldest = nebulaCache.keys().next().value;
      nebulaCache.delete(oldest);
    }

    return c;
  }

  function drawNebulae(time) {
    const cellSize = CONFIG.nebulae.cellSize;
    const parallax = 0.34;
    const renderZoom = camera.zoom * 0.8;
    const drift = prefersReducedMotion ? 0 : Math.sin(time * CONFIG.scene.ambientDrift) * 10;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = CONFIG.nebulae.opacity;

    for (const cell of visibleCells(cellSize, parallax, renderZoom)) {
      const sprite = makeNebula(cell.x, cell.y);
      if (!sprite) continue;

      const rnd = rngFor(cell.x, cell.y, 1401);

      const pos = project(
        cell.x * cellSize + (rnd() - 0.5) * cellSize * 0.55,
        cell.y * cellSize + (rnd() - 0.5) * cellSize * 0.55,
        parallax,
        renderZoom
      );

      const size = cellSize * (0.95 + rnd() * 0.65) * renderZoom;

      ctx.save();
      ctx.translate(pos.x + drift, pos.y - drift * 0.2);
      ctx.rotate(rnd() * TAU);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawStar(x, y, radius, color, opacity, glow) {
    if (x < -50 || x > width + 50 || y < -50 || y > height + 50) return;

    ctx.globalAlpha = opacity;

    if (glow) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 10);
      halo.addColorStop(0, "rgba(220,240,255,0.40)");
      halo.addColorStop(0.18, "rgba(145,190,255,0.20)");
      halo.addColorStop(1, "rgba(95,140,255,0)");

      ctx.fillStyle = halo;
      circle(x, y, radius * 10);
      ctx.fill();
    }

    ctx.fillStyle = color;
    circle(x, y, Math.max(0.3, radius));
    ctx.fill();

    if (glow && radius > 1.35) {
      ctx.strokeStyle = "rgba(205,226,255,0.15)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - radius * 5, y);
      ctx.lineTo(x + radius * 5, y);
      ctx.moveTo(x, y - radius * 5);
      ctx.lineTo(x, y + radius * 5);
      ctx.stroke();
    }
  }

  function drawStarLayer(layerIndex, time) {
    const layerDefs = [
      { count: CONFIG.stars.farCount, parallax: 0.20, zoomMul: 0.52 },
      { count: CONFIG.stars.midCount, parallax: 0.54, zoomMul: 0.83 },
      { count: CONFIG.stars.nearCount, parallax: 1.0, zoomMul: 1.0 }
    ];

    const layer = layerDefs[layerIndex];
    const cellSize = CONFIG.stars.cellSize;
    const renderZoom = camera.zoom * layer.zoomMul;

    ctx.save();

    for (const cell of visibleCells(cellSize, layer.parallax, renderZoom)) {
      const rnd = rngFor(cell.x, cell.y, 600 + layerIndex);

      for (let i = 0; i < layer.count; i++) {
        const wx = cell.x * cellSize + rnd() * cellSize;
        const wy = cell.y * cellSize + rnd() * cellSize;
        const seed = rnd();
        const twinkleSeed = rnd();
        const phase = rnd() * TAU;

        let radius;
        if (layerIndex === 0) radius = 0.22 + Math.pow(seed, 5) * 0.7;
        else if (layerIndex === 1) radius = 0.3 + Math.pow(seed, 6) * 1.35;
        else radius = 0.4 + Math.pow(seed, 7) * 2.1;

        const glow = seed > 0.945 && layerIndex > 0;
        const brightness =
          0.18 + Math.pow(rnd(), 0.45) * 0.78;
        const twinkle =
          prefersReducedMotion
            ? 1
            : 0.86 + 0.14 * Math.sin(time * CONFIG.stars.twinkleSpeed * (0.6 + twinkleSeed) + phase);

        const pos = project(wx, wy, layer.parallax, renderZoom);

        drawStar(
          pos.x,
          pos.y,
          clamp(radius * Math.sqrt(renderZoom), 0.22, 4),
          choose(CONFIG.stars.colors, rnd),
          brightness * twinkle,
          glow
        );
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawPlanetSurface(pos, radius, palette, time, seed) {
    const rnd = randomGenerator(seed);

    circle(pos.x, pos.y, radius);
    ctx.clip();

    const baseGrad = ctx.createLinearGradient(
      pos.x - radius, pos.y - radius * 0.3,
      pos.x + radius, pos.y + radius
    );
    baseGrad.addColorStop(0, palette[2]);
    baseGrad.addColorStop(0.45, palette[1]);
    baseGrad.addColorStop(1, palette[0]);

    ctx.fillStyle = baseGrad;
    ctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);

    const drift = prefersReducedMotion ? 0 : time * 0.0004;

    // cloud bands / atmosphere streaks
    for (let i = 0; i < 34; i++) {
      const y = (rnd() * 2 - 1) * radius * 0.88;
      const h = radius * (0.01 + rnd() * 0.07);
      const wave = Math.sin(drift + rnd() * TAU) * radius * 0.10;
      const alpha = 0.02 + rnd() * 0.06;

      ctx.fillStyle = i % 2
        ? `rgba(255,255,255,${alpha * 0.35})`
        : `rgba(5,11,22,${alpha * 1.0})`;

      ctx.beginPath();
      ctx.ellipse(
        pos.x + wave,
        pos.y + y,
        radius * (0.82 + rnd() * 0.24),
        Math.max(1, h),
        (rnd() - 0.5) * 0.08,
        0,
        TAU
      );
      ctx.fill();
    }

    // soft storm / surface patches
    for (let i = 0; i < 12; i++) {
      const px = (rnd() * 2 - 1) * radius * 0.75;
      const py = (rnd() * 2 - 1) * radius * 0.75;
      const rx = radius * (0.05 + rnd() * 0.16);
      const ry = radius * (0.03 + rnd() * 0.11);

      const grad = ctx.createRadialGradient(
        pos.x + px, pos.y + py, 0,
        pos.x + px, pos.y + py, rx
      );
      grad.addColorStop(0, `rgba(190,220,245,${0.03 + rnd() * 0.08})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(pos.x + px, pos.y + py, rx, ry, rnd() * TAU, 0, TAU);
      ctx.fill();
    }

    // day-night shading
    const shadow = ctx.createRadialGradient(
      pos.x - radius * 0.62,
      pos.y - radius * 0.18,
      radius * 0.04,
      pos.x + radius * 0.25,
      pos.y + radius * 0.08,
      radius * 1.35
    );
    shadow.addColorStop(0, "rgba(255,255,255,0.08)");
    shadow.addColorStop(0.40, "rgba(0,0,0,0.05)");
    shadow.addColorStop(0.72, "rgba(0,7,18,0.52)");
    shadow.addColorStop(1, "rgba(0,2,9,0.96)");

    ctx.fillStyle = shadow;
    ctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);
  }

  function drawPlanet(x, y, radius, palette, seed, time) {
    const pos = project(x, y);
    const r = radius * camera.zoom;

    if (r < 4) return;
    if (pos.x + r < -120 || pos.x - r > width + 120 || pos.y + r < -120 || pos.y - r > height + 120) return;

    // outer atmosphere
    ctx.save();
    const halo = ctx.createRadialGradient(pos.x, pos.y, r * 0.68, pos.x, pos.y, r * 1.55);
    halo.addColorStop(0, "rgba(70,140,220,0.02)");
    halo.addColorStop(0.55, "rgba(66,145,230,0.08)");
    halo.addColorStop(1, "rgba(66,145,230,0)");

    ctx.fillStyle = halo;
    circle(pos.x, pos.y, r * 1.55);
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawPlanetSurface(pos, r, palette, time, seed);
    ctx.restore();

    // rim light
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, Math.PI * 0.68, Math.PI * 1.34);
    ctx.strokeStyle = "rgba(130,210,255,0.20)";
    ctx.lineWidth = Math.max(0.8, r * 0.014);
    ctx.stroke();
    ctx.restore();

    // edge atmosphere line
    ctx.save();
    circle(pos.x, pos.y, r);
    ctx.strokeStyle = "rgba(125, 195, 255, 0.24)";
    ctx.lineWidth = Math.max(0.5, r * 0.008);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlanets(time) {
    // Hero planet close to the references
    drawPlanet(520, -120, 208, CONFIG.planets.palettes[0], 556601, time);

    const cellSize = CONFIG.planets.cellSize;

    for (const cell of visibleCells(cellSize)) {
      const rnd = rngFor(cell.x, cell.y, 291);

      if (rnd() > CONFIG.planets.probability) continue;

      const x = cell.x * cellSize + rnd() * cellSize;
      const y = cell.y * cellSize + rnd() * cellSize;

      if (Math.hypot(x - 520, y + 120) < 720) continue;

      const radius = lerp(CONFIG.planets.minRadius, CONFIG.planets.maxRadius, rnd());
      const palette = choose(CONFIG.planets.palettes, rnd);
      const seed = Math.floor(rnd() * 4294967295);

      drawPlanet(x, y, radius, palette, seed, time);
    }
  }

  function asteroidPolygon(x, y, r, seed, lightAngle, time) {
    const rnd = randomGenerator(seed);
    const drift = prefersReducedMotion ? 0 : Math.sin(time * 0.00008 + seed) * 3.5;

    const pos = project(x + drift, y + drift * 0.6);
    const radius = r * camera.zoom;

    if (radius < 1) return;
    if (pos.x + radius < -50 || pos.x - radius > width + 50 || pos.y + radius < -50 || pos.y - radius > height + 50) return;

    const count = 7 + Math.floor(rnd() * 5);
    const pts = [];

    for (let i = 0; i < count; i++) {
      const ang = (i / count) * TAU + rnd() * 0.22;
      const dist = radius * (0.72 + rnd() * 0.34);
      pts.push({
        x: pos.x + Math.cos(ang) * dist,
        y: pos.y + Math.sin(ang) * dist
      });
    }

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();

    const grad = ctx.createLinearGradient(
      pos.x - Math.cos(lightAngle) * radius,
      pos.y - Math.sin(lightAngle) * radius,
      pos.x + Math.cos(lightAngle) * radius,
      pos.y + Math.sin(lightAngle) * radius
    );
    grad.addColorStop(0, "#6b8394");
    grad.addColorStop(0.32, "#375268");
    grad.addColorStop(1, "#07111f");

    ctx.fillStyle = grad;
    ctx.fill();

    // subtle highlight edge
    ctx.strokeStyle = "rgba(155, 205, 235, 0.18)";
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // shadow facets
    for (let i = 0; i < Math.min(4, pts.length - 2); i++) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[(i + 1) % pts.length].x, pts[(i + 1) % pts.length].y);
      ctx.closePath();
      ctx.fillStyle = i % 2
        ? "rgba(255,255,255,0.04)"
        : "rgba(0,0,0,0.14)";
      ctx.fill();
    }

    ctx.restore();
  }

  function drawAsteroids(time) {
    const lightAngle = Math.PI;

    // hero asteroid field — reduced vs previous version
    const fieldRnd = rngFor(5, 2, 884);

    for (let i = 0; i < 26; i++) {
      const angle = fieldRnd() * TAU;
      const dist = 240 + Math.pow(fieldRnd(), 0.6) * 590;
      const x = 520 + Math.cos(angle) * dist;
      const y = -120 + Math.sin(angle) * dist;
      const r = 6 + Math.pow(fieldRnd(), 3.3) * 42;

      asteroidPolygon(
        x,
        y,
        r,
        Math.floor(fieldRnd() * 4294967295),
        lightAngle,
        time
      );
    }

    // procedural fields elsewhere — also reduced
    const cellSize = CONFIG.asteroids.cellSize;
    for (const cell of visibleCells(cellSize)) {
      const rnd = rngFor(cell.x, cell.y, 786);

      if (rnd() > CONFIG.asteroids.density) continue;

      const count = 1 + Math.floor(rnd() * CONFIG.asteroids.maxPerCell);

      for (let i = 0; i < count; i++) {
        const x = cell.x * cellSize + rnd() * cellSize;
        const y = cell.y * cellSize + rnd() * cellSize;
        const r = lerp(
          CONFIG.asteroids.minRadius,
          CONFIG.asteroids.maxRadius,
          Math.pow(rnd(), 1.75)
        );

        asteroidPolygon(
          x,
          y,
          r,
          Math.floor(rnd() * 4294967295),
          lightAngle,
          time
        );
      }
    }
  }

  function scheduleShootingStar(time) {
    nextShootingStar = time + lerp(
      CONFIG.shootingStars.minDelay,
      CONFIG.shootingStars.maxDelay,
      Math.random()
    );
  }

  function drawShootingStar(now) {
    if (prefersReducedMotion || !CONFIG.shootingStars.enabled) return;

    if (!nextShootingStar) scheduleShootingStar(now);

    if (!shootingStar && now > nextShootingStar) {
      shootingStar = {
        born: now,
        x: Math.random() * width * 0.8,
        y: Math.random() * height * 0.45,
        angle: Math.PI * (0.08 + Math.random() * 0.18),
        dist: 180 + Math.random() * 220,
        duration: CONFIG.shootingStars.duration
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
    const alpha = Math.sin(t * Math.PI) * 0.75;

    const hx = s.x + Math.cos(s.angle) * s.dist * p;
    const hy = s.y + Math.sin(s.angle) * s.dist * p;
    const tail = 100 + 65 * (1 - t);
    const tx = hx - Math.cos(s.angle) * tail;
    const ty = hy - Math.sin(s.angle) * tail;

    const grad = ctx.createLinearGradient(tx, ty, hx, hy);
    grad.addColorStop(0, "rgba(90,160,255,0)");
    grad.addColorStop(0.65, `rgba(130,190,255,${alpha * 0.36})`);
    grad.addColorStop(1, `rgba(245,250,255,${alpha})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 16);
    glow.addColorStop(0, `rgba(255,255,255,${alpha * 0.5})`);
    glow.addColorStop(1, "rgba(100,180,255,0)");
    ctx.fillStyle = glow;
    circle(hx, hy, 16);
    ctx.fill();
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function getPinchMetrics() {
    const list = [...pointers.values()];
    if (list.length !== 2) return null;

    const a = list[0];
    const b = list[1];

    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    const pos = pointerPosition(event);
    pointers.set(event.pointerId, pos);

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_) {}

    pinchState = pointers.size === 2 ? getPinchMetrics() : null;
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;

    event.preventDefault();

    const prev = pointers.get(event.pointerId);
    const current = pointerPosition(event);

    if (pointers.size === 1) {
      camera.x -= (current.x - prev.x) / camera.zoom;
      camera.y -= (current.y - prev.y) / camera.zoom;
      pointers.set(event.pointerId, current);
      return;
    }

    if (pointers.size === 2) {
      const before = pinchState || getPinchMetrics();
      pointers.set(event.pointerId, current);
      const after = getPinchMetrics();

      if (!before || !after) return;

      const worldX = camera.x + (before.x - width / 2) / camera.zoom;
      const worldY = camera.y + (before.y - height / 2) / camera.zoom;

      const newZoom = clamp(
        camera.zoom * (after.distance / before.distance),
        CONFIG.camera.minZoom,
        CONFIG.camera.maxZoom
      );

      camera.zoom = newZoom;
      camera.x = worldX - (after.x - width / 2) / newZoom;
      camera.y = worldY - (after.y - height / 2) / newZoom;

      pinchState = after;
    }
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);

    try {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}

    pinchState = pointers.size === 2 ? getPinchMetrics() : null;
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();

      // No wheel zoom. Only panning.
      if (event.ctrlKey || event.metaKey) return;

      const multiplier =
        event.deltaMode === 1 ? 16 :
        event.deltaMode === 2 ? height :
        1;

      camera.x += (event.deltaX * multiplier) / camera.zoom;
      camera.y += (event.deltaY * multiplier) / camera.zoom;
    },
    { passive: false }
  );

  function render(timestamp) {
    const frameStep = 1000 / CONFIG.rendering.targetFPS;

    if (!lastTime) lastTime = timestamp;
    const delta = Math.min(64, timestamp - lastTime);

    if (delta < frameStep) {
      requestAnimationFrame(render);
      return;
    }

    lastTime = timestamp;

    if (!prefersReducedMotion) {
      sceneTime += delta;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    drawBackground();
    drawNebulae(sceneTime);
    drawStarLayer(0, sceneTime);
    drawStarLayer(1, sceneTime);
    drawKeyLight();
    drawPlanets(sceneTime);
    drawStarLayer(2, sceneTime);
    drawAsteroids(sceneTime);
    drawShootingStar(timestamp);

    requestAnimationFrame(render);
  }

  window.addEventListener("resize", resize);

  document.addEventListener("visibilitychange", () => {
    lastTime = 0;
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
      camera.zoom = clamp(value, CONFIG.camera.minZoom, CONFIG.camera.maxZoom);
    }
  };
})();
