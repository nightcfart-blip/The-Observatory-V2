"use strict";

(() => {
  const C = window.SPACE_CONFIG;
  const AC = window.ARCHIVE_CONFIG;
  const STORE = window.WatchArchive;
  const STATS = window.ARCHIVE_STATISTICS;
  const U = window.ArchiveUtil;

  const canvas = document.getElementById("spaceCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const DOM = {
    constellationLayer: document.getElementById("constellationLayer"),
    constellationSvg: document.getElementById("constellationSvg"),
    lineABase: document.getElementById("lineA-base"),
    lineBBase: document.getElementById("lineB-base"),
    lineAGlow: document.getElementById("lineA-glow"),
    lineBGlow: document.getElementById("lineB-glow"),
    archiveLines: document.getElementById("archiveLines"),
    archiveStars: document.getElementById("archiveStars"),
    panel: document.getElementById("glassPanel"),
    panelTitle: document.getElementById("panelTitle"),
    panelEyebrow: document.getElementById("panelEyebrow"),
    panelContent: document.getElementById("panelContent"),
    panelToolbar: document.getElementById("panelToolbar"),
    panelFooter: document.getElementById("panelFooter"),
    closePanel: document.getElementById("closePanel"),
    homeBtn: document.getElementById("homeBtn"),
    toast: document.getElementById("toast")
  };

  const navButtons = [...document.querySelectorAll(".nav-star")];
  const TAU = Math.PI * 2;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const NAV_STARS = [
    { panel: "settings", x: -260, y: -110, size: 15, tint: "198,222,255", breathe: "7.8s" },
    { panel: "library", x: -130, y: -255, size: 18, tint: "232,239,255", breathe: "8.6s" },
    { panel: "creation", x: 24, y: -180, size: 20, tint: "196,204,255", breathe: "6.8s" },
    { panel: "watchlist", x: 210, y: -310, size: 16, tint: "198,236,255", breathe: "9s" },
    { panel: "statistics", x: 152, y: 18, size: 17, tint: "220,203,255", breathe: "7.5s" }
  ];

  const NAV_LINES = [
    [0, 1, 2, 3],
    [2, 4, 3]
  ];

  const camera = { ...C.camera };
  const scene = { ...C.baseScene };

  let W = 0;
  let H = 0;
  let DPR = 1;
  let sceneTime = 0;
  let lastFrame = 0;
  let previousTime = 0;
  let shootingStar = null;
  let nextMeteor = 0;
  let toastTimer = null;
  let activePanel = null;
  let archiveNodes = new Map();
  let archiveSignature = "";
  let archiveDirty = true;
  let pointers = new Map();
  let pinchState = null;
  let audioCtx = null;
  let masterGain = null;
  const nebulaCache = new Map();

  try {
    const saved = JSON.parse(localStorage.getItem("watchArchiveSpaceSettings") || "{}");
    Object.keys(scene).forEach(key => {
      if (typeof saved[key] === "number" && Number.isFinite(saved[key])) {
        scene[key] = saved[key];
      }
    });
  } catch (error) {
    console.warn(error);
  }

  function saveSpaceSettings() {
    localStorage.setItem("watchArchiveSpaceSettings", JSON.stringify(scene));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function element(tag, className = "", text = null) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== null) node.textContent = text;
    return node;
  }

  function svg(tag, attrs = {}) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attrs).forEach(([key, value]) => {
      node.setAttribute(key, String(value));
    });
    return node;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    DOM.toast.textContent = String(message);
    DOM.toast.classList.add("show");
    toastTimer = setTimeout(() => {
      DOM.toast.classList.remove("show");
    }, 2600);
  }

  function project(x, y, depth = 1, scale = camera.zoom) {
    return {
      x: W / 2 + (x - camera.x * depth) * scale,
      y: H / 2 + (y - camera.y * depth) * scale
    };
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, C.rendering.maxPixelRatio);

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

    DOM.constellationSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    DOM.archiveLines.setAttribute("viewBox", `0 0 ${W} ${H}`);
    archiveDirty = true;
  }

  function resetToStart() {
    camera.x = C.startPoint.x;
    camera.y = C.startPoint.y;
    camera.zoom = C.startPoint.zoom;
    archiveDirty = true;
  }

  function focusWorldPoint(x, y, zoom = camera.zoom) {
    camera.x = x;
    camera.y = y;
    camera.zoom = clamp(zoom, C.camera.minZoom, C.camera.maxZoom);
    archiveDirty = true;
  }

  function formatRating(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    return value.toFixed(1);
  }

  function formatDuration(minutes) {
    const total = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    if (!hours) return `${rest}m`;
    if (!rest) return `${hours}h`;
    return `${hours}h ${rest}m`;
  }

  function visibleCells(size, depth = 1, scale = camera.zoom, margin = 1) {
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
    return mulberry32((hash(x, y, salt) * 4294967295) >>> 0);
  }

  function choose(array, random) {
    return array[Math.floor(random() * array.length)];
  }

  function rgba(color, opacity) {
    return `rgba(${color[0]},${color[1]},${color[2]},${opacity})`;
  }

  function hexRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function circle(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, C.sky.backgroundTop);
    gradient.addColorStop(1, C.sky.backgroundBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    const vignette = ctx.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.1, W * 0.5, H * 0.5, Math.max(W, H) * 0.74);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, `rgba(0,0,0,${C.sky.vignetteStrength})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function buildNebulaSprite(layerIndex, cellX, cellY) {
    const key = [layerIndex, cellX, cellY, scene.nebulaColorVariance.toFixed(2)].join(":");
    if (nebulaCache.has(key)) return nebulaCache.get(key);

    const layer = C.nebulae.layers[layerIndex];
    const rnd = rngFor(cellX, cellY, 9000 + layerIndex * 31);

    const sprite = document.createElement("canvas");
    sprite.width = 768;
    sprite.height = 768;

    const g = sprite.getContext("2d");
    const palette = C.nebulae.palette;
    const colors = [choose(palette, rnd), choose(palette, rnd), choose(palette, rnd)];

    function colorize(color) {
      const average = (color[0] + color[1] + color[2]) / 3;
      return color.map(value =>
        Math.round(clamp(average + (value - average) * scene.nebulaColorVariance, 0, 255))
      );
    }

    function drawCloud(x, y, rx, ry, color, alpha) {
      const radius = Math.max(rx, ry);
      if (radius <= 0) return;

      g.save();
      g.translate(x, y);
      g.scale(rx / radius, ry / radius);

      const grad = g.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, rgba(color, alpha));
      grad.addColorStop(0.22, rgba(color, alpha * 0.72));
      grad.addColorStop(0.56, rgba(color, alpha * 0.18));
      grad.addColorStop(1, rgba(color, 0));

      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, radius, 0, TAU);
      g.fill();
      g.restore();
    }

    const mx = 330 + rnd() * 110;
    const my = 330 + rnd() * 130;
    const angle = rnd() * TAU;
    const length = 180 + rnd() * 180;

    g.globalCompositeOperation = "screen";

    for (let i = 0; i < 18; i++) {
      const t = rnd() * 2 - 1;
      drawCloud(
        mx + Math.cos(angle) * length * t + (rnd() - 0.5) * 175,
        my + Math.sin(angle) * length * t + (rnd() - 0.5) * 145,
        60 + rnd() * 120,
        35 + rnd() * 90,
        colorize(choose(colors, rnd)),
        0.02 + rnd() * 0.04
      );
    }

    const strands = 4 + Math.floor(rnd() * 4);

    for (let s = 0; s < strands; s++) {
      const phase = rnd() * TAU;
      const frequency = 1.2 + rnd() * 3;
      const amplitude = 30 + rnd() * 68;
      const tilt = angle + (rnd() - 0.5) * 1.2;
      const thickness = 14 + rnd() * 34;
      const offset = (rnd() - 0.5) * 120;
      const color = colorize(choose(colors, rnd));
      const steps = 40;

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const along = (t - 0.5) * 2 * length;
        const wave = Math.sin(t * frequency * TAU + phase) * amplitude;
        const across = offset + wave;
        const x = mx + Math.cos(tilt) * along - Math.sin(tilt) * across;
        const y = my + Math.sin(tilt) * along + Math.cos(tilt) * across;
        const taper = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.8);

        drawCloud(
          x + (rnd() - 0.5) * 12,
          y + (rnd() - 0.5) * 12,
          thickness * (0.7 + rnd()) * taper + 5,
          thickness * (0.4 + rnd() * 0.7) * taper + 4,
          color,
          (0.02 + rnd() * 0.055) * taper
        );
      }
    }

    for (let i = 0; i < 16; i++) {
      drawCloud(
        mx + (rnd() - 0.5) * 190,
        my + (rnd() - 0.5) * 170,
        10 + rnd() * 34,
        8 + rnd() * 28,
        colorize(choose(colors, rnd)),
        0.03 + rnd() * 0.08
      );
    }

    nebulaCache.set(key, sprite);
    while (nebulaCache.size > C.rendering.nebulaCacheSize) {
      nebulaCache.delete(nebulaCache.keys().next().value);
    }

    return sprite;
  }

  function drawNebulaLayer(index, time) {
    const layer = C.nebulae.layers[index];
    const scale = camera.zoom * layer.zoomFactor;
    const drift = reducedMotion ? 0 : Math.sin(time * C.nebulae.driftSpeed + index * 1.7) * 12 * layer.drift;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const cell of visibleCells(layer.cellSize, layer.parallax, scale, 2)) {
      const rnd = rngFor(cell.x, cell.y, 4000 + index * 100);
      const probability = clamp(layer.density * scene.nebulaFrequency, 0, 1);
      if (rnd() > probability) continue;

      const wx = cell.x * layer.cellSize + (rnd() - 0.5) * layer.cellSize * 0.55;
      const wy = cell.y * layer.cellSize + (rnd() - 0.5) * layer.cellSize * 0.55;
      const size = lerp(layer.sizeMin, layer.sizeMax, rnd()) * scene.nebulaSize * scale;
      const rotation = rnd() * TAU;
      const opacity = 0.55 + rnd() * 0.45;
      const p = project(wx, wy, layer.parallax, scale);

      if (p.x + size < 0 || p.x - size > W || p.y + size < 0 || p.y - size > H) continue;

      const sprite = buildNebulaSprite(index, cell.x, cell.y);

      ctx.save();
      ctx.globalAlpha = clamp(layer.opacity * scene.nebulaBrightness * opacity, 0, 1);
      ctx.translate(p.x + drift, p.y - drift * 0.35);
      ctx.rotate(rotation);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    ctx.restore();
  }

  function starColor(hex) {
    const color = hexRgb(hex);
    const average = (color[0] + color[1] + color[2]) / 3;
    const changed = color.map(value =>
      Math.round(clamp(average + (value - average) * scene.starsColorVariance, 0, 255))
    );
    return `rgb(${changed.join(",")})`;
  }

  function drawStar(x, y, radius, color, alpha, glow) {
    if (x < -30 || x > W + 30 || y < -30 || y > H + 30) return;

    ctx.save();

    if (glow > 0) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 10);
      halo.addColorStop(0, `rgba(255,255,255,${alpha * 0.3})`);
      halo.addColorStop(0.25, `rgba(140,190,255,${alpha * glow})`);
      halo.addColorStop(1, "rgba(60,100,170,0)");

      ctx.fillStyle = halo;
      circle(x, y, radius * 10);
      ctx.fill();
    }

    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = color;
    circle(x, y, Math.max(0.2, radius));
    ctx.fill();

    if (radius > 1.3) {
      ctx.strokeStyle = "rgba(230,238,255,0.18)";
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
      { count: C.stars.distantCount, depth: 0.18, factor: 0.58, radius: 0.75 },
      { count: C.stars.middleCount, depth: 0.48, factor: 0.82, radius: 1 },
      { count: C.stars.nearCount, depth: 1, factor: 1, radius: 1.1 }
    ];

    const layer = layers[index];
    const scale = camera.zoom * layer.factor;
    const count = Math.max(0, Math.round(layer.count * scene.starsAmount));

    for (const cell of visibleCells(C.stars.cellSize, layer.depth, scale, 1)) {
      const rnd = rngFor(cell.x, cell.y, 1300 + index);

      for (let i = 0; i < count; i++) {
        const x = cell.x * C.stars.cellSize + rnd() * C.stars.cellSize;
        const y = cell.y * C.stars.cellSize + rnd() * C.stars.cellSize;
        const seed = rnd();
        const phase = rnd() * TAU;
        const speed = 0.7 + rnd() * 1.3;
        const brightness = rnd();
        const color = choose(C.stars.colors, rnd);

        const radius =
          index === 0
            ? 0.18 + Math.pow(seed, 4) * 0.76
            : index === 1
              ? 0.28 + Math.pow(seed, 4.5) * 1.55
              : 0.4 + Math.pow(seed, 5.4) * 2.15;

        const twinkle = reducedMotion
          ? 1
          : 1 + Math.sin(time * C.stars.twinkleSpeed * speed + phase) * 0.13 * scene.starsTwinkle;

        const alpha = (0.17 + Math.pow(brightness, 0.42) * 0.82) * scene.starsBrightness * twinkle;
        const p = project(x, y, layer.depth, scale);

        drawStar(
          p.x,
          p.y,
          clamp(radius * Math.sqrt(scale) * layer.radius, 0.2, 4.3),
          starColor(color),
          alpha,
          seed > 0.91 ? 0.08 + rnd() * 0.16 : 0
        );
      }
    }
  }
    function scheduleMeteor(now) {
    if (scene.shootingFrequency <= 0) {
      nextMeteor = Infinity;
      return;
    }

    nextMeteor = now + lerp(C.shootingStars.minDelay, C.shootingStars.maxDelay, Math.random()) / scene.shootingFrequency;
  }

  function drawMeteors(now) {
    if (reducedMotion || !C.shootingStars.enabled || scene.shootingFrequency <= 0) return;
    if (!nextMeteor) scheduleMeteor(now);

    if (!shootingStar && now > nextMeteor) {
      shootingStar = {
        born: now,
        x: Math.random() * W,
        y: Math.random() * H * 0.65,
        angle: Math.PI * (0.12 + Math.random() * 0.18),
        distance: 120 + Math.random() * 200,
        duration: C.shootingStars.duration
      };
    }

    if (!shootingStar) return;

    const s = shootingStar;
    const t = (now - s.born) / s.duration;

    if (t >= 1) {
      shootingStar = null;
      scheduleMeteor(now);
      return;
    }

    const progress = t * t * (3 - 2 * t);
    const alpha = Math.sin(Math.PI * t) * 0.28;

    const hx = s.x + Math.cos(s.angle) * s.distance * progress;
    const hy = s.y + Math.sin(s.angle) * s.distance * progress;
    const length = 55 + 75 * (1 - t);
    const tx = hx - Math.cos(s.angle) * length;
    const ty = hy - Math.sin(s.angle) * length;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const gradient = ctx.createLinearGradient(tx, ty, hx, hy);
    gradient.addColorStop(0, "rgba(70,110,180,0)");
    gradient.addColorStop(0.7, `rgba(135,180,255,${alpha * 0.28})`);
    gradient.addColorStop(1, `rgba(245,250,255,${alpha})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.restore();
  }

  function updateNavigationConstellation() {
    const positions = [];

    NAV_STARS.forEach((star, index) => {
      const button = navButtons[index];
      if (!button) return;

      const p = project(star.x, star.y, 1.06, camera.zoom);
      positions.push(p);

      button.style.left = `${p.x}px`;
      button.style.top = `${p.y}px`;
      button.style.setProperty("--star-size", `${star.size}px`);
      button.style.setProperty("--star-scale", "1");
      button.style.setProperty("--star-tint", star.tint);
      button.style.setProperty("--star-breathe", star.breathe);

      const visible = p.x > -80 && p.x < W + 80 && p.y > -80 && p.y < H + 80;
      button.style.opacity = visible ? "1" : "0";
      button.style.pointerEvents = visible ? "auto" : "none";
    });

    function polyline(indices) {
      return indices.map((index, i) => {
        const p = positions[index];
        return `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      }).join(" ");
    }

    const pathA = polyline(NAV_LINES[0]);
    const pathB = polyline(NAV_LINES[1]);

    DOM.lineABase.setAttribute("d", pathA);
    DOM.lineBBase.setAttribute("d", pathB);
    DOM.lineAGlow.setAttribute("d", pathA);
    DOM.lineBGlow.setAttribute("d", pathB);
  }

  function starVisibility(type) {
    const zoom = camera.zoom;

    if (type === "group") return 1;
    if (type === "production") return 1;
    if (type === "season") {
      if (zoom < AC.constellation.seasonMinZoom) return 0;
      return clamp((zoom - AC.constellation.seasonMinZoom) / 0.35, 0, 1);
    }
    return 1;
  }

  function createArchiveStarNode(type, item) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "archive-star";
    node.dataset.level = type;
    node.dataset.id = item.id;
    node.setAttribute("aria-label", `${item.title} — ${type}`);

    const halo = element("span", "star-halo");
    const spikeX = element("span", "star-spike star-spike-x");
    const spikeY = element("span", "star-spike star-spike-y");
    const core = element("span", "star-core");

    node.append(halo, spikeX, spikeY, core);

    const label = element("span", "star-label", item.title);
    node.appendChild(label);

    node.addEventListener("click", event => {
      event.stopPropagation();
      openArchiveEntry(type, item.id);
    });

    return node;
  }

  function collectSkyEntries() {
    return [
      ...STORE.all("group").map(item => ({ type: "group", item })),
      ...STORE.all("production").map(item => ({ type: "production", item })),
      ...STORE.all("season").map(item => ({ type: "season", item }))
    ].filter(entry => entry.item.constellation?.center && entry.item.constellation?.stars?.length);
  }

  function rebuildArchiveNodes() {
    DOM.archiveStars.replaceChildren();
    archiveNodes.clear();

    for (const { type, item } of collectSkyEntries()) {
      const node = createArchiveStarNode(type, item);
      archiveNodes.set(`${type}:${item.id}`, node);
      DOM.archiveStars.appendChild(node);
    }

    archiveSignature = collectSkyEntries().map(({ type, item }) => `${type}:${item.id}:${item.title}`).join("|");
    archiveDirty = true;
  }

  function svgArchiveLine(a, b, type, animated = false, delay = 0) {
    const path = svg("path", {
      d: `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`
    });

    path.classList.add(animated ? "archive-connection-flow" : "archive-connection");

    if (!animated) {
      path.classList.add(type === "season" ? "season-link" : "group-link");
    } else {
      path.style.animationDelay = `${-delay}s`;
    }

    return path;
  }

  function renderArchiveSky() {
    const entries = collectSkyEntries();
    const signature = entries.map(({ type, item }) => `${type}:${item.id}:${item.title}`).join("|");
    if (signature !== archiveSignature) {
      rebuildArchiveNodes();
    }

    DOM.archiveLines.replaceChildren();
    const fragment = document.createDocumentFragment();

    for (const { type, item } of entries) {
      const visibility = starVisibility(type);
      const star = item.constellation.stars[0];
      const p = project(item.constellation.center.x, item.constellation.center.y, 1, camera.zoom);
      const node = archiveNodes.get(`${type}:${item.id}`);
      if (!node) continue;

      const scale = clamp(Math.sqrt(camera.zoom), 0.7, 1.7);

      node.style.left = `${p.x}px`;
      node.style.top = `${p.y}px`;
      node.style.setProperty("--star-tint", (star.tint || [205, 225, 255]).join(","));
      node.style.setProperty("--star-scale", scale.toFixed(3));
      node.style.setProperty("--star-breathe", `${5 + ((star.twinklePhase || 0) / TAU) * 5}s`);
      node.style.setProperty("--star-size", `${star.size}px`);
      node.style.opacity = String(visibility * (star.brightness || 1));
      node.style.pointerEvents = visibility > 0.24 ? "auto" : "none";
      node.tabIndex = visibility > 0.24 ? 0 : -1;

      const visible = p.x >= -90 && p.x <= W + 90 && p.y >= -90 && p.y <= H + 90;
      if (!visible) {
        node.style.opacity = "0";
        node.style.pointerEvents = "none";
        node.tabIndex = -1;
      }

      let parentItem = null;
      if (type === "production" && item.groupId) parentItem = STORE.get("group", item.groupId);
      if (type === "season" && item.productionId) parentItem = STORE.get("production", item.productionId);

      if (parentItem?.constellation?.center && visibility > 0) {
        const start = project(parentItem.constellation.center.x, parentItem.constellation.center.y, 1, camera.zoom);
        const end = p;

        const line = svgArchiveLine(start, end, type === "season" ? "season" : "group");
        line.style.opacity = (visibility * (type === "season" ? 0.46 : 0.88)).toFixed(3);
        fragment.appendChild(line);

        if (type === "production") {
          const flow = svgArchiveLine(start, end, "group", true, U.hashString(item.id) % 23);
          flow.style.opacity = (visibility * 0.72).toFixed(3);
          fragment.appendChild(flow);
        }
      }
    }

    DOM.archiveLines.appendChild(fragment);
    archiveDirty = false;
  }

  function setPanelOrigin(source) {
    if (!source) {
      DOM.panel.style.setProperty("--origin-x", "50%");
      DOM.panel.style.setProperty("--origin-y", "14%");
      return;
    }

    const rect = source.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    DOM.panel.style.setProperty("--origin-x", `${clamp(cx / W * 100, 12, 88)}%`);
    DOM.panel.style.setProperty("--origin-y", `${clamp(cy / H * 100, 8, 84)}%`);
  }

  function clearPanelRegions() {
    DOM.panelContent.replaceChildren();
    DOM.panelToolbar.replaceChildren();
    DOM.panelFooter.replaceChildren();
    DOM.panelToolbar.hidden = true;
    DOM.panelFooter.hidden = true;
    DOM.panelContent.scrollTop = 0;
  }

  function showPanel({ key, title, eyebrow = "WATCH ARCHIVE", source = null, builder = null }) {
    activePanel = { key, title, eyebrow, source, builder };
    setPanelOrigin(source);
    clearPanelRegions();

    DOM.panelEyebrow.textContent = eyebrow;
    DOM.panelTitle.textContent = title;

    if (typeof builder === "function") {
      builder(DOM.panelContent);
    }

    DOM.panel.inert = false;
    DOM.panel.setAttribute("aria-hidden", "false");
    DOM.panel.classList.add("open");

    navButtons.forEach(button => {
      button.classList.toggle("active", button.dataset.panel === key);
    });
  }

  function closePanel() {
    DOM.panel.classList.remove("open");
    DOM.panel.setAttribute("aria-hidden", "true");
    DOM.panel.inert = true;
    activePanel = null;
    navButtons.forEach(button => button.classList.remove("active"));
  }

  function setToolbar(nodes = []) {
    DOM.panelToolbar.replaceChildren();
    nodes.forEach(node => DOM.panelToolbar.appendChild(node));
    DOM.panelToolbar.hidden = nodes.length === 0;
  }

  function setFooter(nodes = []) {
    DOM.panelFooter.replaceChildren();
    nodes.forEach(node => DOM.panelFooter.appendChild(node));
    DOM.panelFooter.hidden = nodes.length === 0;
  }

  function makeButton(text, onClick, options = {}) {
    const button = element("button", "archive-button" + (options.primary ? " primary" : "") + (options.small ? " small" : "") + (options.danger ? " danger" : ""), text);
    button.type = "button";
    if (options.disabled) button.disabled = true;
    if (typeof onClick === "function") button.addEventListener("click", onClick);
    return button;
  }

  function makeField({ label, value = "", type = "text", placeholder = "", required = false, min = null, max = null, step = null }) {
    const wrapper = element("label", "archive-field");
    const caption = element("span", "", label);
    const input = element("input", "archive-input");
    input.type = type;
    input.value = value ?? "";
    input.placeholder = placeholder;
    input.required = required;
    if (min !== null) input.min = min;
    if (max !== null) input.max = max;
    if (step !== null) input.step = step;
    wrapper.append(caption, input);
    return { wrapper, input };
  }

  function makeTextarea(label, value = "", placeholder = "") {
    const wrapper = element("label", "archive-field");
    const caption = element("span", "", label);
    const textarea = element("textarea", "archive-textarea");
    textarea.value = value;
    textarea.placeholder = placeholder;
    wrapper.append(caption, textarea);
    return { wrapper, textarea };
  }

  function makeSelect(label, options, selected = "") {
    const wrapper = element("label", "archive-field");
    const caption = element("span", "", label);
    const select = element("select", "archive-select");

    options.forEach(option => {
      const node = element("option");
      if (typeof option === "string") {
        node.value = option;
        node.textContent = option;
      } else {
        node.value = option.value;
        node.textContent = option.label;
      }
      select.appendChild(node);
    });

    select.value = selected;
    wrapper.append(caption, select);
    return { wrapper, select };
  }

  function makeEmptyState(message) {
    const box = element("div", "archive-empty");
    box.appendChild(element("span", "empty-symbol", "✦"));
    box.appendChild(element("p", "", message));
    return box;
  }

  function makeEntryRow({ title, metadata = [], rating = null, onOpen = null, onEdit = null }) {
    const row = element("div", "archive-entry");
    const content = element("div", "entry-content");
    content.appendChild(element("h4", "entry-title", title));

    const meta = element("div", "entry-meta");
    metadata.filter(Boolean).forEach(text => meta.appendChild(element("span", "", text)));
    content.appendChild(meta);
    row.appendChild(content);

    if (rating !== null) {
      row.appendChild(element("span", "entry-rating", `${formatRating(rating)} / 10`));
    }

    if (onOpen) row.appendChild(makeButton("Open", onOpen, { small: true }));
    if (onEdit) row.appendChild(makeButton("Edit", onEdit, { small: true }));

    return row;
  }

  async function pickImage() {
    return new Promise(resolve => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
      input.click();
    });
  }

  function openMenu(name, source = null) {
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

    showPanel({
      key: name,
      title,
      eyebrow: "WATCH ARCHIVE",
      source,
      builder
    });
  }

  function refreshCurrentPanel() {
    if (!activePanel) return;
    showPanel(activePanel);
  }
    function renderTenStars(rating) {
    const wrap = element("div", "rating-stars");
    const value = typeof rating === "number" ? rating : 0;

    for (let i = 1; i <= 10; i++) {
      const star = element("span", "rating-star", "★");
      if (value >= i) {
        star.classList.add("filled");
      } else if (value >= i - 0.5) {
        star.classList.add("half");
      }
      wrap.appendChild(star);
    }

    return wrap;
  }

  function updateArcScroller(scroller) {
    const track = scroller.querySelector(".group-mini-track");
    if (!track) return;
    const cards = [...track.querySelectorAll(".group-mini-card")];
    const viewportCenter = scroller.scrollLeft + scroller.clientWidth / 2;

    cards.forEach(card => {
      const center = card.offsetLeft + card.offsetWidth / 2;
      const distance = (center - viewportCenter) / Math.max(1, scroller.clientWidth / 2);
      const clamped = clamp(distance, -1.6, 1.6);
      const curve = Math.pow(Math.abs(clamped), 1.8);
      const translateY = curve * 46;
      const rotate = clamped * 8;
      const scale = 1 - Math.min(Math.abs(clamped) * 0.08, 0.08);
      card.style.transform = `translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`;
      card.style.opacity = `${1 - Math.min(Math.abs(clamped) * 0.18, 0.18)}`;
    });
  }

  function buildGroupPanel(container, group) {
    const rating = STORE.calculatedRating("group", group);
    const productions = STORE.children("group", group.id);

    const root = element("div", "group-view");
    const hero = element("div", "group-hero");

    if (group.bannerImage) {
      const imageWrap = element("div", "group-banner-image");
      const img = document.createElement("img");
      img.src = group.bannerImage;
      img.alt = `${group.title} banner`;
      imageWrap.appendChild(img);
      hero.appendChild(imageWrap);
    } else {
      hero.appendChild(element("div", "group-banner-fallback"));
    }

    const heroActions = element("div", "group-hero-actions");

    const bannerButton = element("button", "icon-button", "⇪");
    bannerButton.type = "button";
    bannerButton.title = "Change banner";
    bannerButton.addEventListener("click", async () => {
      const image = await pickImage();
      if (!image) return;
      STORE.update("group", group.id, { bannerImage: image });
      openArchiveEntry("group", group.id);
      showToast("Banner updated.");
    });

    const editButton = element("button", "icon-button", "✎");
    editButton.type = "button";
    editButton.title = "Edit group";
    editButton.addEventListener("click", () => openGroupEditor(group.id));

    heroActions.append(bannerButton, editButton);
    hero.appendChild(heroActions);

    root.appendChild(hero);

    const overview = element("div", "group-overview");

    const left = element("div", "group-title-wrap");
    left.appendChild(element("h3", "group-display-title", group.title));

    const scoreWrap = element("div", "group-score-wrap");
    scoreWrap.appendChild(renderTenStars(rating));
    scoreWrap.appendChild(element("span", "group-score-number", `(${rating !== null ? formatRating(rating) : "—"})`));
    left.appendChild(scoreWrap);

    const right = element("div", "group-genre-block");
    right.appendChild(element("div", "group-main-genres", (group.genres || []).join(" · ") || " "));
    right.appendChild(element("div", "group-secondary-genres", (group.tags || []).join(" · ") || " "));

    overview.append(left, right);
    root.appendChild(overview);

    const opinion = element("div", "group-opinion");
    const opinionCopy = element("p", "group-opinion-copy" + (!group.notes ? " empty" : ""), group.notes || "Personal opinion...");
    opinion.appendChild(opinionCopy);
    root.appendChild(opinion);

    const miniLibrary = element("div", "group-mini-library");
    const miniShell = element("div", "group-mini-shell");
    const miniScroller = element("div", "group-mini-scroller");
    const miniTrack = element("div", "group-mini-track");

    if (!productions.length) {
      miniTrack.appendChild(element("div", "group-mini-empty", "No productions in this group yet."));
    }

    productions.forEach(production => {
      const card = element("article", "group-mini-card");

      const image = element("div", "group-mini-card-image");
      if (production.shelfImage) {
        const img = document.createElement("img");
        img.src = production.shelfImage;
        img.alt = `${production.title} library image`;
        image.appendChild(img);
      }

      const body = element("div", "group-mini-card-body");
      body.appendChild(element("h4", "group-mini-card-title", production.title));

      const meta = [];
      if (production.mediaType) meta.push(production.mediaType);
      if (production.releaseDate) meta.push(production.releaseDate);
      body.appendChild(element("div", "group-mini-card-meta", meta.join(" · ")));

      const prating = STORE.calculatedRating("production", production);
      body.appendChild(element("div", "group-mini-card-rating", prating !== null ? `${formatRating(prating)} / 10` : "Unrated"));

      const tools = element("div", "group-mini-card-tools");

      tools.appendChild(makeButton("Open", () => openArchiveEntry("production", production.id), { small: true }));

      tools.appendChild(makeButton("Image", async () => {
        const imageData = await pickImage();
        if (!imageData) return;
        STORE.update("production", production.id, { shelfImage: imageData });
        openArchiveEntry("group", group.id);
        showToast("Mini-library image updated.");
      }, { small: true }));

      body.appendChild(tools);
      card.append(image, body);
      miniTrack.appendChild(card);
    });

    miniScroller.appendChild(miniTrack);
    miniShell.appendChild(miniScroller);
    miniLibrary.appendChild(miniShell);
    root.appendChild(miniLibrary);

    container.appendChild(root);

    requestAnimationFrame(() => updateArcScroller(miniScroller));
    miniScroller.addEventListener("scroll", () => updateArcScroller(miniScroller));
    window.addEventListener("resize", () => updateArcScroller(miniScroller), { once: true });

    setFooter([
      makeButton("+ Production", () => openCreationForm("production", { groupId: group.id })),
      makeButton("Find in Universe", () => {
        focusWorldPoint(group.constellation.center.x, group.constellation.center.y, 1);
        closePanel();
      }),
      makeButton("Delete", () => {
        if (!confirm(`Delete "${group.title}"? Productions will become standalone.`)) return;
        STORE.delete("group", group.id);
        archiveDirty = true;
        showToast("Group deleted.");
        openMenu("library");
      }, { danger: true })
    ]);
  }

  function openGroupEditor(id) {
    const group = STORE.get("group", id);
    if (!group) return;

    showPanel({
      key: `edit-group-${id}`,
      title: group.title,
      eyebrow: "GROUP",
      builder(container) {
        const wrap = element("div", "group-edit-sheet");

        const title = makeField({ label: "Title", value: group.title, required: true });
        const genres = makeField({ label: "Main Genres", value: (group.genres || []).join(", ") });
        const tags = makeField({ label: "Secondary Genres", value: (group.tags || []).join(", ") });
        const notes = makeTextarea("Personal Opinion", group.notes || "");
        const grid = element("div", "inline-edit-grid two");

        grid.append(title.wrapper, genres.wrapper);
        wrap.appendChild(grid);

        const grid2 = element("div", "inline-edit-grid");
        grid2.append(tags.wrapper, notes.wrapper);
        wrap.appendChild(grid2);

        const actions = element("div", "archive-actions");
        actions.appendChild(makeButton("Save", () => {
          STORE.update("group", id, {
            title: title.input.value.trim(),
            genres: genres.input.value,
            tags: tags.input.value,
            notes: notes.textarea.value
          });
          showToast("Group updated.");
          openArchiveEntry("group", id);
        }, { primary: true }));

        actions.appendChild(makeButton("Banner", async () => {
          const image = await pickImage();
          if (!image) return;
          STORE.update("group", id, { bannerImage: image });
          showToast("Banner updated.");
          openArchiveEntry("group", id);
        }));

        wrap.appendChild(actions);
        container.appendChild(wrap);
      }
    });
  }

  function openArchiveEntry(type, id) {
    const item = STORE.get(type, id);
    if (!item) {
      showToast("Entry not found.");
      return;
    }

    const eyebrow = type.toUpperCase();

    showPanel({
      key: `${type}-${id}`,
      title: item.title,
      eyebrow,
      builder(container) {
        setToolbar([makeButton("← Back", () => openMenu("library"), { small: true })]);

        if (type === "group") {
          buildGroupPanel(container, item);
          return;
        }

        const rating = STORE.calculatedRating(type, item);
        const section = element("div", "archive-section");
        section.appendChild(makeEntryRow({
          title: item.title,
          metadata: [
            item.mediaType || "",
            item.releaseDate || "",
            item.status || ""
          ],
          rating,
          onEdit: () => openEntryEditor(type, id)
        }));

        if (item.notes) {
          section.appendChild(element("p", "archive-description", item.notes));
        }

        container.appendChild(section);

        if (type === "production") {
          const seasons = STORE.children("production", item.id);
          container.appendChild(element("h3", "section-title", "Seasons"));
          const list = element("div", "archive-list");
          if (!seasons.length) list.appendChild(makeEmptyState("No seasons yet."));
          seasons.forEach(season => {
            list.appendChild(makeEntryRow({
              title: season.title,
              metadata: [season.releaseDate || "", season.status || ""],
              rating: STORE.calculatedRating("season", season),
              onOpen: () => openArchiveEntry("season", season.id),
              onEdit: () => openEntryEditor("season", season.id)
            }));
          });
          container.appendChild(list);
          setFooter([
            makeButton("+ Season", () => openCreationForm("season", { productionId: item.id })),
            makeButton("Edit", () => openEntryEditor("production", item.id)),
            makeButton("Delete", () => {
              if (!confirm(`Delete "${item.title}"? All seasons and episodes will also be deleted.`)) return;
              STORE.delete("production", item.id);
              archiveDirty = true;
              showToast("Production deleted.");
              openMenu("library");
            }, { danger: true })
          ]);
          return;
        }

        if (type === "season") {
          const episodes = STORE.children("season", item.id);
          container.appendChild(element("h3", "section-title", "Episodes"));
          const list = element("div", "archive-list");
          if (!episodes.length) list.appendChild(makeEmptyState("No episodes yet."));
          episodes.forEach(ep => {
            list.appendChild(makeEntryRow({
              title: ep.title,
              metadata: [ep.number ? `#${ep.number}` : "", ep.durationMinutes ? formatDuration(ep.durationMinutes) : ""],
              rating: STORE.calculatedRating("episode", ep),
              onOpen: () => openArchiveEntry("episode", ep.id),
              onEdit: () => openEntryEditor("episode", ep.id)
            }));
          });
          container.appendChild(list);
          setFooter([
            makeButton("+ Episode", () => openCreationForm("episode", { seasonId: item.id })),
            makeButton("Edit", () => openEntryEditor("season", item.id)),
            makeButton("Delete", () => {
              if (!confirm(`Delete "${item.title}"? All episodes will also be deleted.`)) return;
              STORE.delete("season", item.id);
              archiveDirty = true;
              showToast("Season deleted.");
              openMenu("library");
            }, { danger: true })
          ]);
          return;
        }

        if (type === "episode") {
          setFooter([
            makeButton("Edit", () => openEntryEditor("episode", item.id)),
            makeButton("Delete", () => {
              if (!confirm(`Delete "${item.title}"?`)) return;
              STORE.delete("episode", item.id);
              showToast("Episode deleted.");
              openMenu("library");
            }, { danger: true })
          ]);
        }
      }
    });
  }

  function openEntryEditor(type, id) {
    const item = STORE.get(type, id);
    if (!item) return;

    showPanel({
      key: `edit-${type}-${id}`,
      title: `Edit ${item.title}`,
      eyebrow: `EDIT ${type.toUpperCase()}`,
      builder(container) {
        const form = element("form");

        const title = makeField({ label: "Title", value: item.title, required: true });
        form.appendChild(title.wrapper);

        let media = null;
        let release = null;
        let status = null;
        let genres = null;
        let tags = null;
        let notes = null;
        let duration = null;
        let rating = null;
        let number = null;

        if (type === "production") {
          media = makeField({ label: "Form of Media", value: item.mediaType || "" });
          release = makeField({ label: "Release / Airing", value: item.releaseDate || "" });
          status = makeSelect("Status", [
            { value: "", label: "Not Set" },
            { value: "Finished", label: "Finished" },
            { value: "Watching", label: "Watching" },
            { value: "Discontinued", label: "Discontinued" }
          ], item.status || "");
          genres = makeField({ label: "Main Genres", value: (item.genres || []).join(", ") });
          tags = makeField({ label: "Secondary Genres", value: (item.tags || []).join(", ") });
          notes = makeTextarea("Personal Opinion", item.notes || "");
          duration = makeField({ label: "Duration (minutes)", type: "number", step: 1, min: 0, value: item.durationMinutes || 0 });
          rating = makeField({ label: "Rating (1-10, .5 allowed)", type: "number", step: 0.5, min: 1, max: 10, value: item.rating ?? "" });

          [media, release, status, genres, tags, duration, rating, notes].forEach(part => form.appendChild(part.wrapper));
        }

        if (type === "season") {
          number = makeField({ label: "Season Number", type: "number", min: 0, step: 1, value: item.number ?? "" });
          release = makeField({ label: "Time of Airing", value: item.releaseDate || "" });
          status = makeSelect("Status", [
            { value: "", label: "Not Set" },
            { value: "Finished", label: "Finished" },
            { value: "Watching", label: "Watching" },
            { value: "Discontinued", label: "Discontinued" }
          ], item.status || "");
          notes = makeTextarea("Personal Opinion", item.notes || "");
          [number, release, status, notes].forEach(part => form.appendChild(part.wrapper));
        }

        if (type === "episode") {
          number = makeField({ label: "Episode Number", type: "number", min: 0, step: 1, value: item.number ?? "" });
          duration = makeField({ label: "Duration (minutes)", type: "number", min: 0, step: 1, value: item.durationMinutes || 0 });
          rating = makeField({ label: "Rating (1-10, .5 allowed)", type: "number", min: 1, max: 10, step: 0.5, value: item.rating ?? "" });
          notes = makeTextarea("Personal Opinion", item.notes || "");
          [number, duration, rating, notes].forEach(part => form.appendChild(part.wrapper));
        }

        const actions = element("div", "archive-actions");
        const save = makeButton("Save Changes", null, { primary: true });
        save.type = "submit";
        actions.appendChild(save);
        form.appendChild(actions);

        form.addEventListener("submit", event => {
          event.preventDefault();

          const changes = { title: title.input.value.trim() };

          if (media) changes.mediaType = media.input.value;
          if (release) changes.releaseDate = release.input.value;
          if (status) changes.status = status.select.value;
          if (genres) changes.genres = genres.input.value;
          if (tags) changes.tags = tags.input.value;
          if (notes) changes.notes = notes.textarea.value;
          if (duration) changes.durationMinutes = duration.input.value;
          if (rating) changes.rating = rating.input.value;
          if (number) changes.number = number.input.value;

          STORE.update(type, id, changes);
          archiveDirty = true;
          showToast("Entry updated.");
          openArchiveEntry(type, id);
        });

        container.appendChild(form);
      }
    });
  }

  function buildWatchlistPanel(container) {
    const intro = element("p", "archive-description", "A personal watchlist. Ticking an entry moves it into the Library as a Production.");
    container.appendChild(intro);

    const form = element("form");
    const title = makeField({ label: "Title", placeholder: "Enter a title", required: true });
    const media = makeField({ label: "Form of Media", placeholder: "Movie, Series..." });
    const release = makeField({ label: "Release / Airing", placeholder: "Optional" });

    form.append(title.wrapper, media.wrapper, release.wrapper);
    const add = makeButton("Add to Watchlist", null, { primary: true });
    add.type = "submit";
    form.appendChild(add);
    form.addEventListener("submit", event => {
      event.preventDefault();
      STORE.addWatchlist({
        title: title.input.value,
        mediaType: media.input.value,
        releaseDate: release.input.value
      });
      showToast("Added to Watchlist.");
      refreshCurrentPanel();
    });

    container.appendChild(form);
    container.appendChild(element("div", "archive-divider"));

    const list = element("div", "archive-list");
    const items = STORE.all("watchlist").sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    if (!items.length) list.appendChild(makeEmptyState("Your watchlist is empty."));

    items.forEach(item => {
      const row = element("div", "watchlist-item");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.addEventListener("change", () => {
        if (!check.checked) return;
        STORE.completeWatchlist(item.id);
        archiveDirty = true;
        showToast(`"${item.title}" moved to Library.`);
        refreshCurrentPanel();
      });

      const content = element("div", "entry-content");
      content.appendChild(element("h4", "entry-title", item.title));
      content.appendChild(element("div", "entry-meta", [item.mediaType, item.releaseDate].filter(Boolean).join(" · ")));

      row.append(check, content, makeButton("×", () => {
        STORE.removeWatchlist(item.id);
        showToast("Watchlist entry removed.");
        refreshCurrentPanel();
      }, { small: true, danger: true }));

      list.appendChild(row);
    });

    container.appendChild(list);
  }

  function buildCreationPanel(container) {
    const intro = element("p", "archive-description", "Create a Group, Production, Season, or Episode. Constellations grow automatically from the hierarchy.");
    container.appendChild(intro);

    const grid = element("div", "creation-options");
    [
      ["group", "✦", "Group"],
      ["production", "✧", "Production"],
      ["season", "⋆", "Season"],
      ["episode", "·", "Episode"]
    ].forEach(([type, symbol, label]) => {
      const button = element("button", "creation-option");
      button.type = "button";
      button.appendChild(element("span", "creation-symbol", symbol));
      button.appendChild(element("strong", "", label));
      button.appendChild(element("small", "", `Create a ${label.toLowerCase()}.`));
      button.addEventListener("click", () => openCreationForm(type));
      grid.appendChild(button);
    });

    container.appendChild(grid);
  }

  function openCreationForm(type, defaults = {}) {
    const label = type.charAt(0).toUpperCase() + type.slice(1);

    showPanel({
      key: `create-${type}`,
      title: `Create ${label}`,
      eyebrow: "CREATION",
      builder(container) {
        const form = element("form");
        const title = makeField({ label: "Title", required: true, value: defaults.title || "" });
        form.appendChild(title.wrapper);

        let group = null;
        let production = null;
        let season = null;
        let media = null;
        let release = null;
        let status = null;
        let number = null;
        let duration = null;
        let rating = null;
        let genres = null;
        let tags = null;
        let notes = null;

        if (type === "group") {
          genres = makeField({ label: "Main Genres" });
          tags = makeField({ label: "Secondary Genres" });
          notes = makeTextarea("Personal Opinion");
          [genres, tags, notes].forEach(part => form.appendChild(part.wrapper));
        }

        if (type === "production") {
          group = makeSelect("Parent Group", [{ value: "", label: "Standalone" }, ...STORE.all("group").map(g => ({ value: g.id, label: g.title }))], defaults.groupId || "");
          media = makeField({ label: "Form of Media" });
          release = makeField({ label: "Release / Airing" });
          status = makeSelect("Status", [
            { value: "", label: "Not Set" },
            { value: "Finished", label: "Finished" },
            { value: "Watching", label: "Watching" },
            { value: "Discontinued", label: "Discontinued" }
          ]);
          genres = makeField({ label: "Main Genres" });
          tags = makeField({ label: "Secondary Genres" });
          notes = makeTextarea("Personal Opinion");
          [group, media, release, status, genres, tags, notes].forEach(part => form.appendChild(part.wrapper));
        }

        if (type === "season") {
          production = makeSelect("Parent Production", STORE.all("production").map(p => ({ value: p.id, label: p.title })), defaults.productionId || "");
          number = makeField({ label: "Season Number", type: "number", min: 0, step: 1 });
          release = makeField({ label: "Time of Airing" });
          status = makeSelect("Status", [
            { value: "", label: "Not Set" },
            { value: "Finished", label: "Finished" },
            { value: "Watching", label: "Watching" },
            { value: "Discontinued", label: "Discontinued" }
          ]);
          [production, number, release, status].forEach(part => form.appendChild(part.wrapper));
        }

        if (type === "episode") {
          season = makeSelect("Parent Season", STORE.all("season").map(s => ({ value: s.id, label: s.title })), defaults.seasonId || "");
          number = makeField({ label: "Episode Number", type: "number", min: 0, step: 1 });
          duration = makeField({ label: "Duration (minutes)", type: "number", min: 0, step: 1 });
          rating = makeField({ label: "Rating (1-10, .5 allowed)", type: "number", min: 1, max: 10, step: 0.5 });
          notes = makeTextarea("Personal Opinion");
          [season, number, duration, rating, notes].forEach(part => form.appendChild(part.wrapper));
        }

        const save = makeButton(`Create ${label}`, null, { primary: true });
        save.type = "submit";
        form.appendChild(save);

        form.addEventListener("submit", event => {
          event.preventDefault();

          let created = null;

          if (type === "group") {
            created = STORE.createGroup({
              title: title.input.value,
              genres: genres.input.value,
              tags: tags.input.value,
              notes: notes.textarea.value
            });
          }

          if (type === "production") {
            created = STORE.createProduction({
              title: title.input.value,
              groupId: group.select.value || null,
              mediaType: media.input.value,
              releaseDate: release.input.value,
              status: status.select.value,
              genres: genres.input.value,
              tags: tags.input.value,
              notes: notes.textarea.value
            });
          }

          if (type === "season") {
            created = STORE.createSeason({
              title: title.input.value,
              productionId: production.select.value,
              number: number.input.value,
              releaseDate: release.input.value,
              status: status.select.value
            });
          }

          if (type === "episode") {
            created = STORE.createEpisode({
              title: title.input.value,
              seasonId: season.select.value,
              number: number.input.value,
              durationMinutes: duration.input.value,
              rating: rating.input.value,
              notes: notes.textarea.value
            });
          }

          if (!created) {
            showToast("Creation failed. Check the parent selection and title.");
            return;
          }

          archiveDirty = true;
          showToast(`${label} created.`);
          openArchiveEntry(type, created.id);
        });

        container.appendChild(form);
      }
    });
  }

  function buildLibraryPanel(container) {
    const prefs = STORE.data.preferences;
    const sorting = makeSelect("Sort by", AC.sorting.map(item => ({ value: item.id, label: item.label })), prefs.librarySort);
    sorting.select.addEventListener("change", () => {
      STORE.setLibraryPreferences({ sort: sorting.select.value });
      refreshCurrentPanel();
    });
    container.appendChild(sorting.wrapper);

    const filters = element("div", "archive-toolbar-row");
    [["group", "Groups"], ["production", "Productions"], ["season", "Seasons"], ["episode", "Episodes"]].forEach(([type, label]) => {
      const wrapper = element("label", "archive-check");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!prefs.libraryVisibility[type];
      input.addEventListener("change", () => {
        STORE.setLibraryPreferences({ visibility: { [type]: input.checked } });
        refreshCurrentPanel();
      });
      wrapper.append(input, element("span", "", label));
      filters.appendChild(wrapper);
    });
    container.appendChild(filters);
    container.appendChild(element("div", "archive-divider"));

    const list = element("div", "archive-list");
    const entries = STORE.libraryEntries();

    if (!entries.length) list.appendChild(makeEmptyState("No entries match your current filters."));

    entries.forEach(record => {
      list.appendChild(makeEntryRow({
        title: record.item.title,
        metadata: [
          record.type,
          record.item.mediaType || "",
          record.item.releaseDate || ""
        ],
        rating: record.rating,
        onOpen: () => openArchiveEntry(record.type, record.item.id),
        onEdit: () => openEntryEditor(record.type, record.item.id)
      }));
    });

    container.appendChild(list);
  }

  function buildSettingsPanel(container) {
    const groups = [
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
        items: [["shootingFrequency", "Frequency", 0, 2, 0.05]]
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
        items: [["ambientVolume", "Volume", 0, 0.2, 0.0025]]
      }
    ];

    groups.forEach(group => {
      const section = element("section", "settings-group");
      section.appendChild(element("h3", "", group.title));

      group.items.forEach(([key, label, min, max, step]) => {
        const row = element("label", "setting");
        const top = element("div", "setting-heading");
        const out = element("output", "", Number(scene[key]).toFixed(key === "ambientVolume" ? 3 : 2));
        top.append(element("span", "", label), out);

        const input = document.createElement("input");
        input.type = "range";
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = scene[key];

        input.addEventListener("input", () => {
          scene[key] = Number(input.value);
          out.textContent = scene[key].toFixed(key === "ambientVolume" ? 3 : 2);
          if (key === "ambientVolume") updateAudioVolume();
          if (key === "nebulaColorVariance") nebulaCache.clear();
          if (key === "shootingFrequency") {
            shootingStar = null;
            nextMeteor = 0;
          }
          saveSpaceSettings();
        });

        row.append(top, input);
        section.appendChild(row);
      });

      container.appendChild(section);
    });

    const backup = element("section", "settings-group");
    backup.appendChild(element("h3", "", "Archive Backup"));

    const actions = element("div", "archive-actions");
    actions.appendChild(makeButton("Export Archive", exportArchiveJSON));
    actions.appendChild(makeButton("Import Archive", requestArchiveImport));
    backup.appendChild(actions);

    container.appendChild(backup);
  }

  function numericPairs(data) {
    return (Array.isArray(data) ? data : [])
      .map(item => ({ ...item, label: String(item.label ?? item.title ?? ""), value: Number(item.value) }))
      .filter(item => Number.isFinite(item.value));
  }

  function chartColor(index) {
    const colors = AC.statistics.palettes;
    return colors[index % colors.length];
  }

  function chartSvg(width = 600, height = 320) {
    const node = svg("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
    node.style.width = "100%";
    node.style.height = "auto";
    return node;
  }

  function getStatisticsData(datasetId) {
    if (datasetId === "watchTime") {
      const timeline = new Map();

      STORE.all("production").forEach(prod => {
        if (STORE.children("production", prod.id).length) return;
        if (!prod.watchedAt || !prod.durationMinutes) return;
        timeline.set(prod.watchedAt, (timeline.get(prod.watchedAt) || 0) + Number(prod.durationMinutes || 0));
      });

      STORE.all("episode").forEach(ep => {
        if (!ep.watchedAt || !ep.durationMinutes) return;
        timeline.set(ep.watchedAt, (timeline.get(ep.watchedAt) || 0) + Number(ep.durationMinutes || 0));
      });

      return [...timeline].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));
    }

    if (datasetId === "mediaBreakdown") return STORE.mediaTimeBreakdown();
    if (datasetId === "genreDistribution") return STORE.genreDistribution();
    if (datasetId === "genreOverlap") return { sets: STORE.genreIntersections(), counts: STORE.genreDistribution() };
    if (datasetId === "ratingDistribution") return STORE.ratingDistribution().map(item => ({ ...item, label: item.title, value: item.rating }));
    if (datasetId === "ratingRankings") return STORE.ranking().map(item => ({ ...item, label: item.title, value: item.rating }));
    return [];
  }

  function renderRankedBar(data) {
    const values = numericPairs(data).sort((a, b) => b.value - a.value).slice(0, 14);
    const height = Math.max(240, values.length * 34 + 35);
    const svgNode = chartSvg(600, height);
    const max = Math.max(1, ...values.map(x => x.value));

    values.forEach((item, index) => {
      const y = 12 + index * 34;
      svgNode.appendChild(svg("text", { x: 10, y: y + 12, fill: "rgba(218,232,255,.74)", "font-size": 11 }));
      svgNode.lastChild.textContent = item.label.length > 22 ? item.label.slice(0, 21) + "…" : item.label;

      svgNode.appendChild(svg("rect", {
        x: 190, y, width: (item.value / max) * 335, height: 17, rx: 4,
        fill: chartColor(index), opacity: 0.76
      }));

      const label = svg("text", { x: 585, y: y + 12, fill: "rgba(218,232,255,.74)", "font-size": 11, "text-anchor": "end" });
      label.textContent = item.value.toFixed(2);
      svgNode.appendChild(label);
    });

    return svgNode;
  }

  function renderDonut(data) {
    const values = numericPairs(data).filter(x => x.value > 0).slice(0, 12);
    const svgNode = chartSvg(600, 350);
    const total = values.reduce((sum, x) => sum + x.value, 0);
    if (!total) return svgNode;

    const cx = 190;
    const cy = 160;
    const radius = 110;
    const circumference = TAU * radius;
    let offset = 0;

    values.forEach((item, index) => {
      const fraction = item.value / total;
      svgNode.appendChild(svg("circle", {
        cx, cy, r: radius, fill: "none", stroke: chartColor(index), "stroke-width": 37,
        "stroke-dasharray": `${fraction * circumference} ${circumference}`,
        "stroke-dashoffset": -offset * circumference,
        transform: `rotate(-90 ${cx} ${cy})`
      }));

      offset += fraction;

      svgNode.appendChild(svg("rect", { x: 360, y: 30 + index * 25, width: 10, height: 10, rx: 3, fill: chartColor(index) }));
      const label = svg("text", { x: 380, y: 40 + index * 25, fill: "rgba(218,232,255,.74)", "font-size": 10 });
      label.textContent = `${item.label.slice(0, 22)} (${Math.round(fraction * 100)}%)`;
      svgNode.appendChild(label);
    });

    const totalText = svg("text", { x: cx, y: cy, "text-anchor": "middle", fill: "rgba(218,232,255,.74)", "font-size": 11 });
    totalText.textContent = "TOTAL";
    svgNode.appendChild(totalText);

    const totalValue = svg("text", { x: cx, y: cy + 24, "text-anchor": "middle", fill: "#edf4ff", "font-size": 22 });
    totalValue.textContent = total.toFixed(1);
    svgNode.appendChild(totalValue);

    return svgNode;
  }

  function renderLineChart(data) {
    const values = numericPairs(data);
    const svgNode = chartSvg(600, 310);
    if (!values.length) return svgNode;

    const max = Math.max(1, ...values.map(v => v.value));
    const left = 55;
    const top = 25;
    const right = 570;
    const bottom = 255;

    for (let i = 0; i <= 4; i++) {
      const y = bottom - i * (bottom - top) / 4;
      svgNode.appendChild(svg("line", { x1: left, y1: y, x2: right, y2: y, stroke: "rgba(189,215,255,.25)", "stroke-width": 1 }));
      const t = svg("text", { x: 45, y: y + 4, fill: "rgba(218,232,255,.74)", "font-size": 10, "text-anchor": "end" });
      t.textContent = (max * i / 4).toFixed(1);
      svgNode.appendChild(t);
    }

    const points = values.map((item, index) => ({
      x: values.length === 1 ? (left + right) / 2 : left + index / (values.length - 1) * (right - left),
      y: bottom - item.value / max * (bottom - top)
    }));

    const path = svg("path", {
      d: points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" "),
      fill: "none",
      stroke: chartColor(0),
      "stroke-width": 2.5,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    });
    svgNode.appendChild(path);

    points.forEach((p, index) => {
      const dot = svg("circle", { cx: p.x, cy: p.y, r: 3.5, fill: "#dceaff" });
      const title = svg("title");
      title.textContent = `${values[index].label}: ${values[index].value}`;
      dot.appendChild(title);
      svgNode.appendChild(dot);
    });

    return svgNode;
  }

  function renderStatisticsChart(datasetId, chartId, data) {
    const surface = element("div", "chart-surface");

    if (!STATS.compatible(datasetId, chartId)) {
      surface.appendChild(element("p", "chart-notice", "This diagram is not compatible with the selected data."));
      return surface;
    }

    const hasData = datasetId === "genreOverlap"
      ? data.sets.length > 0
      : Array.isArray(data) && data.length > 0;

    if (!hasData) {
      surface.appendChild(makeEmptyState("Not enough data yet."));
      return surface;
    }

    let chart = null;
    if (chartId === "rankedBar") chart = renderRankedBar(data);
    if (chartId === "donut") chart = renderDonut(data);
    if (chartId === "line") chart = renderLineChart(data);

    if (!chart) {
      surface.appendChild(element("p", "chart-notice", "This diagram is reserved for a later refinement pass."));
      return surface;
    }

    surface.appendChild(chart);
    return surface;
  }

  function buildStatisticsPanel(container) {
    const overview = STORE.overview();
    const overviewGrid = element("div", "stat-overview");
    [
      ["Productions", overview.productions],
      ["Episodes", overview.episodes],
      ["Watch Time", formatDuration(overview.watchedMinutes)],
      ["Rated Productions", overview.ratedProductions]
    ].forEach(([label, value]) => {
      const card = element("div", "stat-card");
      card.appendChild(element("strong", "", String(value)));
      card.appendChild(element("span", "", label));
      overviewGrid.appendChild(card);
    });
    container.appendChild(overviewGrid);

    let datasetId = STORE.data.preferences.statisticsDataset;
    let chartId = STORE.data.preferences.statisticsChart;

    if (!STATS.datasets.some(x => x.id === datasetId)) datasetId = "watchTime";
    if (!STATS.compatible(datasetId, chartId)) chartId = STATS.defaultChart(datasetId);

    const selectors = element("div", "stats-selectors");
    const datasetSelect = makeSelect("Statistical Data", STATS.datasets.map(d => ({ value: d.id, label: d.label })), datasetId);
    const chartSelect = makeSelect("Diagram", STATS.chartsFor(datasetId).map(c => ({ value: c.id, label: c.label })), chartId);

    selectors.append(datasetSelect.wrapper, chartSelect.wrapper);
    container.appendChild(selectors);

    const chartArea = element("div");
    container.appendChild(chartArea);

    function populateCharts() {
      chartSelect.select.replaceChildren();
      STATS.chartsFor(datasetId).forEach(c => {
        const option = element("option");
        option.value = c.id;
        option.textContent = c.label;
        chartSelect.select.appendChild(option);
      });
      if (!STATS.compatible(datasetId, chartId)) chartId = STATS.defaultChart(datasetId);
      chartSelect.select.value = chartId;
    }

    function updateChart() {
      chartArea.replaceChildren();
      const data = getStatisticsData(datasetId);
      chartArea.appendChild(renderStatisticsChart(datasetId, chartId, data));
      STORE.setStatisticsPreferences(datasetId, chartId);
    }

    datasetSelect.select.addEventListener("change", () => {
      datasetId = datasetSelect.select.value;
      populateCharts();
      updateChart();
    });

    chartSelect.select.addEventListener("change", () => {
      chartId = chartSelect.select.value;
      updateChart();
    });

    populateCharts();
    updateChart();
  }

  function exportArchiveJSON() {
    const blob = new Blob([STORE.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `watch-archive-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Archive export prepared.");
  }

  function requestArchiveImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!confirm("Importing will replace your current archive. Continue?")) return;
      const text = await file.text();
      const ok = STORE.importJSON(text, "replace");
      if (!ok) {
        showToast("Import failed.");
        return;
      }
      archiveDirty = true;
      rebuildArchiveNodes();
      showToast("Archive imported.");
      refreshCurrentPanel();
    });
    input.click();
  }

  function startAmbientAudio() {
    if (!C.ambientAudio.enabled) return;
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
      return;
    }

    try {
      const ACtx = window.AudioContext || window.webkitAudioContext;
      if (!ACtx) return;

      audioCtx = new ACtx();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = scene.ambientVolume;
      masterGain.connect(audioCtx.destination);

      const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const low = audioCtx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 1500;

      const high = audioCtx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 55;

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0.9;

      noise.connect(low);
      low.connect(high);
      high.connect(noiseGain);
      noiseGain.connect(masterGain);

      const humGain = audioCtx.createGain();
      humGain.gain.value = 0.05;
      humGain.connect(masterGain);

      [52, 81].forEach(freq => {
        const osc = audioCtx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        osc.connect(humGain);
        osc.start();
      });

      noise.start();
      audioCtx.resume().catch(() => {});
    } catch (error) {
      console.warn(error);
    }
  }

  function updateAudioVolume() {
    if (!masterGain || !audioCtx) return;
    masterGain.gain.setTargetAtTime(scene.ambientVolume, audioCtx.currentTime, 0.03);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pinchMetrics() {
    if (pointers.size !== 2) return null;
    const [a, b] = [...pointers.values()];
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
    };
  }

  function bindCanvasNavigation() {
    canvas.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      startAmbientAudio();
      pointers.set(event.pointerId, pointerPosition(event));
      try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
      pinchState = pinchMetrics();
    });

    canvas.addEventListener("pointermove", event => {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();

      const previous = pointers.get(event.pointerId);
      const current = pointerPosition(event);

      if (pointers.size === 1) {
        camera.x -= (current.x - previous.x) / camera.zoom;
        camera.y -= (current.y - previous.y) / camera.zoom;
        pointers.set(event.pointerId, current);
        archiveDirty = true;
        return;
      }

      if (pointers.size === 2) {
        const before = pinchState || pinchMetrics();
        pointers.set(event.pointerId, current);
        const after = pinchMetrics();
        if (!before || !after) return;

        const worldX = camera.x + (before.x - W / 2) / camera.zoom;
        const worldY = camera.y + (before.y - H / 2) / camera.zoom;

        camera.zoom = clamp(camera.zoom * after.distance / before.distance, C.camera.minZoom, C.camera.maxZoom);
        camera.x = worldX - (after.x - W / 2) / camera.zoom;
        camera.y = worldY - (after.y - H / 2) / camera.zoom;

        pinchState = after;
        archiveDirty = true;
        return;
      }

      pointers.set(event.pointerId, current);
    });

    function release(event) {
      pointers.delete(event.pointerId);
      try {
        if (canvas.hasPointerCapture(event.pointerId)) {
          canvas.releasePointerCapture(event.pointerId);
        }
      } catch (_) {}
      pinchState = pinchMetrics();
    }

    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("lostpointercapture", release);

    canvas.addEventListener("wheel", event => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) return;
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? H : 1;
      camera.x += event.deltaX * multiplier / camera.zoom;
      camera.y += event.deltaY * multiplier / camera.zoom;
      archiveDirty = true;
    }, { passive: false });
  }

  function render(now) {
    requestAnimationFrame(render);

    const frameInterval = 1000 / C.rendering.targetFPS;
    if (now - lastFrame < frameInterval) return;

    const delta = previousTime ? Math.min(60, now - previousTime) : 16;
    previousTime = now;
    lastFrame = now;
    if (!reducedMotion) sceneTime += delta;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

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
    if (archiveDirty) renderArchiveSky();
  }

  function initializeApplication() {
    resize();
    resetToStart();
    rebuildArchiveNodes();

    navButtons.forEach(button => {
      button.addEventListener("click", () => openMenu(button.dataset.panel, button));
    });

    DOM.closePanel.addEventListener("click", closePanel);

    DOM.homeBtn.addEventListener("click", () => {
      resetToStart();
      showToast("Returned to the starting point.");
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closePanel();
    });

    window.addEventListener("resize", () => {
      resize();
      archiveDirty = true;
    });

    STORE.subscribe(() => {
      archiveDirty = true;
      rebuildArchiveNodes();
    });

    document.addEventListener("visibilitychange", () => {
      previousTime = 0;
      if (document.hidden && audioCtx && audioCtx.state === "running") {
        audioCtx.suspend().catch(() => {});
      }
    });

    bindCanvasNavigation();
    requestAnimationFrame(render);
  }

  window.WatchArchiveApp = {
    openMenu,
    openArchiveEntry,
    openCreationForm,
    openEntryEditor,
    refreshCurrentPanel,
    exportArchiveJSON,
    requestArchiveImport
  };

  initializeApplication();
})();
