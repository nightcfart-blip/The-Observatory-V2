"use strict";

(() => {
  const C = window.SPACE_CONFIG;
  const canvas = document.getElementById("spaceCanvas");
  if (!C || !canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const camera = { ...C.camera };
  const scene = { ...C.baseScene };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const nebulaCache = new Map();
  const pointers = new Map();

  let W = 0;
  let H = 0;
  let DPR = 1;
  let lastFrame = 0;
  let previousTime = 0;
  let sceneTime = 0;
  let pinch = null;
  let shootingStar = null;
  let nextMeteor = 0;
  let activePanel = null;
  let audioCtx = null;
  let masterGain = null;

  const panel = document.getElementById("glassPanel");
  const panelTitle = document.getElementById("panelTitle");
  const panelContent = document.getElementById("panelContent");
  const closePanelBtn = document.getElementById("closePanel");
  const homeBtn = document.getElementById("homeBtn");

  const constellationLayer = document.getElementById("constellationLayer");
  const constellationSvg = document.getElementById("constellationSvg");
  const navButtons = [...constellationLayer.querySelectorAll(".nav-star")];
  const lineABase = document.getElementById("lineA-base");
  const lineBBase = document.getElementById("lineB-base");
  const lineAGlow = document.getElementById("lineA-glow");
  const lineBGlow = document.getElementById("lineB-glow");

  const CONSTELLATION_STARS = [
  {
    panel: "settings",
    worldX: -290,
    worldY: -80,
    depth: 1.08,
    size: 11,
    tint: "192,214,255",
    breathe: "7.1s",
    labelOffsetY: 0
  },
  {
    panel: "library",
    worldX: -160,
    worldY: -250,
    depth: 1.08,
    size: 14,
    tint: "223,232,255",
    breathe: "8.4s",
    labelOffsetY: -2
  },
  {
    panel: "creation",
    worldX: 18,
    worldY: -165,
    depth: 1.1,
    size: 17,
    tint: "178,188,255",
    breathe: "6.8s",
    labelOffsetY: 0
  },
  {
    panel: "watchlist",
    worldX: 220,
    worldY: -300,
    depth: 1.1,
    size: 12,
    tint: "184,231,255",
    breathe: "8.9s",
    labelOffsetY: -2
  },
  {
    panel: "statistics",
    worldX: 150,
    worldY: 18,
    depth: 1.09,
    size: 13,
    tint: "201,182,255",
    breathe: "7.6s",
    labelOffsetY: 2
  }
];

  const LINE_GROUPS = [
    [0, 1, 2, 3],
    [2, 4, 3]
  ];

  const settingsGroups = [
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

  // -------------------------------
  // saved settings
  // -------------------------------

  try {
    const saved = JSON.parse(localStorage.getItem("watchArchiveSpaceSettings") || "{}");
    for (const key of Object.keys(scene)) {
      if (typeof saved[key] === "number" && Number.isFinite(saved[key])) {
        scene[key] = saved[key];
      }
    }
  } catch (_) {}

  function saveSettings() {
    try {
      localStorage.setItem("watchArchiveSpaceSettings", JSON.stringify(scene));
    } catch (_) {}
  }

  // -------------------------------
  // utils
  // -------------------------------

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
    return function () {
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

  function choose(array, rnd) {
    return array[Math.floor(rnd() * array.length)];
  }

  function rgba(c, alpha) {
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }

  function hexRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, C.rendering.maxPixelRatio);

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
  }

  function project(x, y, depth = 1, scale = camera.zoom) {
    return {
      x: W / 2 + (x - camera.x * depth) * scale,
      y: H / 2 + (y - camera.y * depth) * scale
    };
  }

  function visibleCells(size, depth, scale, margin = 1) {
    const x = camera.x * depth;
    const y = camera.y * depth;
    const hw = W / scale / 2;
    const hh = H / scale / 2;
    const cells = [];

    for (let cy = Math.floor((y - hh) / size) - margin; cy <= Math.ceil((y + hh) / size) + margin; cy++) {
      for (let cx = Math.floor((x - hw) / size) - margin; cx <= Math.ceil((x + hw) / size) + margin; cx++) {
        cells.push({ x: cx, y: cy });
      }
    }

    return cells;
  }

  function resetToStart() {
    camera.x = C.startPoint.x;
    camera.y = C.startPoint.y;
    camera.zoom = C.startPoint.zoom;
  }

  // -------------------------------
  // background
  // -------------------------------

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.sky.backgroundTop);
    g.addColorStop(1, C.sky.backgroundBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const v = ctx.createRadialGradient(
      W * 0.5, H * 0.45, Math.min(W, H) * 0.1,
      W * 0.5, H * 0.5, Math.max(W, H) * 0.74
    );

    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,0,0,${C.sky.vignetteStrength})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // -------------------------------
  // nebulae
  // -------------------------------

  function nebulaSprite(layerIndex, cx, cy) {
    const key = [layerIndex, cx, cy, scene.nebulaColorVariance.toFixed(2)].join(":");

    if (nebulaCache.has(key)) {
      const result = nebulaCache.get(key);
      nebulaCache.delete(key);
      nebulaCache.set(key, result);
      return result;
    }

    const layer = C.nebulae.layers[layerIndex];
    const rnd = rngFor(cx, cy, 9137 + layerIndex * 101);

    const off = document.createElement("canvas");
    off.width = off.height = 768;

    const g = off.getContext("2d");
    if (!g) return null;

    const colors = [
      choose(C.nebulae.palette, rnd),
      choose(C.nebulae.palette, rnd),
      choose(C.nebulae.palette, rnd)
    ];

    function colorize(c) {
      const avg = (c[0] + c[1] + c[2]) / 3;
      return c.map(v =>
        Math.round(clamp(avg + (v - avg) * scene.nebulaColorVariance, 0, 255))
      );
    }

    function cloud(x, y, rx, ry, color, alpha) {
      const r = Math.max(rx, ry);
      if (r <= 0) return;

      g.save();
      g.translate(x, y);
      g.scale(rx / r, ry / r);

      const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, rgba(color, alpha));
      grad.addColorStop(0.2, rgba(color, alpha * 0.72));
      grad.addColorStop(0.55, rgba(color, alpha * 0.17));
      grad.addColorStop(1, rgba(color, 0));

      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
      g.restore();
    }

    const mx = 330 + rnd() * 110;
    const my = 310 + rnd() * 145;
    const angle = rnd() * TAU;
    const length = 180 + rnd() * 185;
    const shape = Math.floor(rnd() * 4);

    g.globalCompositeOperation = "screen";

    for (let i = 0; i < Math.round(18 * layer.diffuse); i++) {
      const t = rnd() * 2 - 1;
      cloud(
        mx + Math.cos(angle) * length * t + (rnd() - 0.5) * 175 * layer.diffuse,
        my + Math.sin(angle) * length * t + (rnd() - 0.5) * 150 * layer.diffuse,
        (65 + rnd() * 125) * layer.diffuse,
        (35 + rnd() * 95) * layer.diffuse,
        colorize(choose(colors, rnd)),
        0.025 + rnd() * 0.04
      );
    }

    const strands = Math.round((3 + rnd() * 4) * layer.detail);

    for (let s = 0; s < strands; s++) {
      const phase = rnd() * TAU;
      const frequency = 1.2 + rnd() * 3;
      const amplitude = 25 + rnd() * 70;
      const tilt = angle + (rnd() - 0.5) * 1.2;
      const thickness = (17 + rnd() * 37) * layer.diffuse;
      const offset = (rnd() - 0.5) * 130;
      const color = colorize(choose(colors, rnd));
      const steps = Math.max(2, Math.round(45 * layer.detail));

      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const along = (t - 0.5) * 2 * length;
        const wave = Math.sin(t * frequency * TAU + phase) * amplitude;
        const across = offset + wave;

        let x = mx + Math.cos(tilt) * along - Math.sin(tilt) * across;
        let y = my + Math.sin(tilt) * along + Math.cos(tilt) * across;

        if (shape === 1) y += Math.sin(t * Math.PI) * 90;
        if (shape === 2) x += Math.cos(t * TAU) * 65;
        if (shape === 3) y += Math.sin(t * TAU * 2) * 40;

        const taper = Math.pow(Math.max(0, Math.sin(t * Math.PI)), 0.8);

        cloud(
          x + (rnd() - 0.5) * 12,
          y + (rnd() - 0.5) * 12,
          thickness * (0.7 + rnd()) * taper + 5,
          thickness * (0.4 + rnd() * 0.7) * taper + 4,
          color,
          (0.025 + rnd() * 0.055) * taper
        );
      }
    }

    for (let i = 0; i < Math.round(20 * layer.detail); i++) {
      const t = rnd() * 2 - 1;
      cloud(
        mx + Math.cos(angle) * length * t + (rnd() - 0.5) * 125,
        my + Math.sin(angle) * length * t + (rnd() - 0.5) * 125,
        10 + rnd() * 35,
        8 + rnd() * 30,
        colorize(choose(colors, rnd)),
        0.035 + rnd() * 0.09
      );
    }

    g.globalCompositeOperation = "destination-out";

    for (let i = 0; i < 8 + layer.detail * 7; i++) {
      cloud(
        mx + (rnd() - 0.5) * length * 1.6,
        my + (rnd() - 0.5) * length * 1.6,
        20 + rnd() * 65,
        12 + rnd() * 48,
        [0, 0, 0],
        0.12 + rnd() * 0.2
      );
    }

    nebulaCache.set(key, off);

    while (nebulaCache.size > C.rendering.nebulaCacheSize) {
      nebulaCache.delete(nebulaCache.keys().next().value);
    }

    return off;
  }

  function drawNebulaLayer(index, time) {
    const layer = C.nebulae.layers[index];
    const scale = camera.zoom * layer.zoomFactor;
    const drift = reducedMotion ? 0 : Math.sin(time * C.nebulae.driftSpeed + index * 1.7) * 12 * layer.drift;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const cell of visibleCells(layer.cellSize, layer.parallax, scale, 2)) {
      const rnd = rngFor(cell.x, cell.y, 5000 + index * 179);

      if (rnd() > clamp(layer.density * scene.nebulaFrequency, 0, 1)) continue;

      const wx = cell.x * layer.cellSize + (rnd() - 0.5) * layer.cellSize * 0.55;
      const wy = cell.y * layer.cellSize + (rnd() - 0.5) * layer.cellSize * 0.55;
      const size = lerp(layer.sizeMin, layer.sizeMax, rnd()) * scene.nebulaSize * scale;
      const rotation = rnd() * TAU;
      const opacity = 0.55 + rnd() * 0.45;
      const p = project(wx, wy, layer.parallax, scale);

      if (p.x + size < 0 || p.x - size > W || p.y + size < 0 || p.y - size > H) continue;

      const sprite = nebulaSprite(index, cell.x, cell.y);
      if (!sprite) continue;

      ctx.save();
      ctx.globalAlpha = clamp(layer.opacity * scene.nebulaBrightness * opacity, 0, 1);
      ctx.translate(p.x + drift, p.y - drift * 0.35);
      ctx.rotate(rotation);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    ctx.restore();
  }

  // -------------------------------
  // stars
  // -------------------------------

  function starColor(hex) {
    const c = hexRgb(hex);
    const avg = (c[0] + c[1] + c[2]) / 3;
    return "rgb(" + c.map(v => Math.round(clamp(avg + (v - avg) * scene.starsColorVariance, 0, 255))).join(",") + ")";
  }

  function drawStar(x, y, radius, color, alpha, glow) {
    if (x < -30 || x > W + 30 || y < -30 || y > H + 30) return;

    ctx.save();

    if (glow) {
      const h = ctx.createRadialGradient(x, y, 0, x, y, radius * 10);
      h.addColorStop(0, `rgba(255,255,255,${alpha * 0.3})`);
      h.addColorStop(0.25, `rgba(140,190,255,${alpha * glow})`);
      h.addColorStop(1, "rgba(60,100,170,0)");
      ctx.fillStyle = h;
      circle(x, y, radius * 10);
      ctx.fill();
    }

    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = color;
    circle(x, y, Math.max(0.22, radius));
    ctx.fill();

    if (radius > 1.3) {
      ctx.strokeStyle = "rgba(225,240,255,.13)";
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
      { count: C.stars.nearCount, depth: 1, factor: 1, radius: 1.14 }
    ];

    const layer = layers[index];
    const scale = camera.zoom * layer.factor;
    const count = Math.max(0, Math.round(layer.count * scene.starsAmount));

    for (const cell of visibleCells(C.stars.cellSize, layer.depth, scale)) {
      const rnd = rngFor(cell.x, cell.y, 1300 + index);

      for (let i = 0; i < count; i++) {
        const x = cell.x * C.stars.cellSize + rnd() * C.stars.cellSize;
        const y = cell.y * C.stars.cellSize + rnd() * C.stars.cellSize;
        const seed = rnd();
        const phase = rnd() * TAU;
        const speed = 0.7 + rnd() * 1.3;
        const bright = rnd();
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

        const alpha = (0.17 + Math.pow(bright, 0.42) * 0.82) * scene.starsBrightness * twinkle;
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

  // -------------------------------
  // shooting stars
  // -------------------------------

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
    const alpha = Math.sin(Math.PI * t) * 0.32;

    const hx = s.x + Math.cos(s.angle) * s.distance * progress;
    const hy = s.y + Math.sin(s.angle) * s.distance * progress;
    const length = 55 + 75 * (1 - t);
    const tx = hx - Math.cos(s.angle) * length;
    const ty = hy - Math.sin(s.angle) * length;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const grad = ctx.createLinearGradient(tx, ty, hx, hy);
    grad.addColorStop(0, "rgba(70,110,180,0)");
    grad.addColorStop(0.7, `rgba(135,180,255,${alpha * 0.28})`);
    grad.addColorStop(1, `rgba(245,250,255,${alpha})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.restore();
  }

  // -------------------------------
  // ambient audio
  // -------------------------------

  function startAmbientAudio() {
    if (!C.ambientAudio.enabled) return;

    if (audioCtx) {
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = scene.ambientVolume;
      masterGain.connect(audioCtx.destination);

      const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const low = audioCtx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 1600;

      const high = audioCtx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 60;

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0.95;

      noise.connect(low);
      low.connect(high);
      high.connect(noiseGain);
      noiseGain.connect(masterGain);

      const hum = audioCtx.createGain();
      hum.gain.value = 0.06;
      hum.connect(masterGain);

      for (const frequency of [52, 81]) {
        const oscillator = audioCtx.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.connect(hum);
        oscillator.start();
      }

      noise.start();
      audioCtx.resume().catch(() => {});
    } catch (error) {
      console.warn("Audio unavailable:", error);
    }
  }

  // -------------------------------
  // settings / panels
  // -------------------------------

  function setPanelOriginFromButton(button) {
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const xPct = clamp(((rect.left + rect.width / 2) / window.innerWidth) * 100, 18, 82);
    const yPct = clamp(((rect.top + rect.height / 2) / window.innerHeight) * 100, 8, 80);

    panel.style.setProperty("--origin-x", `${xPct}%`);
    panel.style.setProperty("--origin-y", `${yPct}%`);
  }

  function createSettingsView() {
    panelContent.replaceChildren();

    for (const group of settingsGroups) {
      const section = document.createElement("section");
      section.className = "settings-group";

      const heading = document.createElement("h3");
      heading.textContent = group.title;
      section.appendChild(heading);

      for (const [key, label, min, max, step] of group.items) {
        const wrapper = document.createElement("label");
        wrapper.className = "setting";

        const headingRow = document.createElement("div");
        headingRow.className = "setting-heading";

        const name = document.createElement("span");
        name.textContent = label;

        const output = document.createElement("output");
        const decimals = key === "ambientVolume" ? 3 : 2;
        output.textContent = scene[key].toFixed(decimals);

        headingRow.append(name, output);

        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = clamp(scene[key], min, max);
        slider.setAttribute("aria-label", label);

        slider.addEventListener("input", () => {
          scene[key] = Number(slider.value);
          output.textContent = scene[key].toFixed(decimals);

          if (key === "nebulaColorVariance") {
            nebulaCache.clear();
          }

          if (key === "shootingFrequency") {
            shootingStar = null;
            nextMeteor = 0;
          }

          if (key === "ambientVolume") {
            startAmbientAudio();
            if (masterGain && audioCtx) {
              masterGain.gain.setTargetAtTime(scene.ambientVolume, audioCtx.currentTime, 0.03);
            }
          }

          saveSettings();
        });

        wrapper.append(headingRow, slider);
        section.appendChild(wrapper);
      }

      panelContent.appendChild(section);
    }

    const note = document.createElement("p");
    note.className = "settings-note";
    note.textContent = "Settings save automatically in this browser. Ambient sound starts only after interaction.";
    panelContent.appendChild(note);
  }

  function createEmptyView(label) {
    panelContent.innerHTML = `
      <div class="empty-view">
        <p>${label} is still empty for now.</p>
      </div>
    `;
  }

  function setActiveButton(name) {
    navButtons.forEach(button => {
      button.classList.toggle("active", button.dataset.panel === name);
    });
  }

  function openPanel(name, sourceButton) {
    if (activePanel === name && panel.classList.contains("open")) {
      closePanel();
      return;
    }

    activePanel = name;
    setPanelOriginFromButton(sourceButton);
    setActiveButton(name);

    panelTitle.textContent = name.charAt(0).toUpperCase() + name.slice(1);

    if (name === "settings") {
      createSettingsView();
    } else {
      createEmptyView(panelTitle.textContent);
    }

    panel.scrollTop = 0;
    panel.inert = false;
    panel.setAttribute("aria-hidden", "false");
    panel.classList.add("open");
  }

  function closePanel() {
    activePanel = null;
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
    setActiveButton("");
  }

  navButtons.forEach(button => {
    button.addEventListener("click", () => {
      startAmbientAudio();
      openPanel(button.dataset.panel, button);
    });
  });

  closePanelBtn.addEventListener("click", closePanel);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closePanel();
  });

  homeBtn.addEventListener("click", () => {
    resetToStart();
  });

  // -------------------------------
  // constellation layout
  // -------------------------------

  function polylinePath(indices, projected) {
    return indices.map((index, i) => {
      const p = projected[index];
      if (!p) return i === 0 ? "M 0 0" : "L 0 0";
      return `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }).join(" ");
  }

  
function updateConstellation() {
  if (!constellationSvg) return;

  // Match SVG coordinates to actual screen pixels.
  constellationSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const projected = [];

  CONSTELLATION_STARS.forEach((star, index) => {
    const button = navButtons[index];
    if (!button) return;

    const p = project(
      star.worldX,
      star.worldY,
      star.depth,
      camera.zoom
    );

    projected.push(p);

    const scale = clamp(
      Math.pow(camera.zoom, 0.2),
      0.88,
      1.18
    );

    button.style.left = `${p.x}px`;
    button.style.top = `${p.y}px`;

    button.style.setProperty(
      "--star-scale",
      scale.toFixed(3)
    );

    button.style.setProperty(
      "--star-size",
      `${star.size}px`
    );

    button.style.setProperty(
      "--star-tint",
      star.tint
    );

    button.style.setProperty(
      "--star-breathe",
      star.breathe
    );

    const label = button.querySelector(".star-label");

    if (label) {
      label.style.marginTop = `${star.labelOffsetY}px`;
    }

    const visible =
      p.x > -80 &&
      p.x < W + 80 &&
      p.y > -80 &&
      p.y < H + 80;

    button.style.opacity = visible ? "1" : "0";

    button.style.pointerEvents = visible
      ? "auto"
      : "none";
  });

  function makePath(indices) {
    return indices
      .map((index, i) => {
        const p = projected[index];

        if (!p) {
          return i === 0 ? "M 0 0" : "L 0 0";
        }

        return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
      })
      .join(" ");
  }

  const pathA = makePath(LINE_GROUPS[0]);
  const pathB = makePath(LINE_GROUPS[1]);

  lineABase.setAttribute("d", pathA);
  lineBBase.setAttribute("d", pathB);

  lineAGlow.setAttribute("d", pathA);
  lineBGlow.setAttribute("d", pathB);
}


  // -------------------------------
  // input
  // -------------------------------

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
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

  canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    startAmbientAudio();

    pointers.set(event.pointerId, pointerPosition(event));

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_) {}

    pinch = pinchMetrics();
  });

  canvas.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    event.preventDefault();

    const old = pointers.get(event.pointerId);
    const current = pointerPosition(event);

    if (pointers.size === 1) {
      camera.x -= (current.x - old.x) / camera.zoom;
      camera.y -= (current.y - old.y) / camera.zoom;
      pointers.set(event.pointerId, current);
      return;
    }

    if (pointers.size === 2) {
      const before = pinch || pinchMetrics();
      pointers.set(event.pointerId, current);
      const after = pinchMetrics();
      if (!before || !after) return;

      const wx = camera.x + (before.x - W / 2) / camera.zoom;
      const wy = camera.y + (before.y - H / 2) / camera.zoom;

      camera.zoom = clamp(
        camera.zoom * after.distance / before.distance,
        C.camera.minZoom,
        C.camera.maxZoom
      );

      camera.x = wx - (after.x - W / 2) / camera.zoom;
      camera.y = wy - (after.y - H / 2) / camera.zoom;
      pinch = after;
    } else {
      pointers.set(event.pointerId, current);
    }
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);
    try {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}
    pinch = pinchMetrics();
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);

  canvas.addEventListener("wheel", event => {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) return;

    const factor =
      event.deltaMode === 1 ? 16 :
      event.deltaMode === 2 ? H : 1;

    camera.x += event.deltaX * factor / camera.zoom;
    camera.y += event.deltaY * factor / camera.zoom;
  }, { passive: false });

  // -------------------------------
  // render
  // -------------------------------

  function render(now) {
    requestAnimationFrame(render);

    const interval = 1000 / C.rendering.targetFPS;
    if (now - lastFrame < interval) return;

    const delta = previousTime ? Math.min(60, now - previousTime) : 16;
    previousTime = now;
    lastFrame = now;

    if (!reducedMotion) {
      sceneTime += delta;
    }

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

    updateConstellation();
  }

  // -------------------------------
  // boot
  // -------------------------------

  window.addEventListener("resize", () => {
    resize();
    updateConstellation();
  });

  document.addEventListener("visibilitychange", () => {
    previousTime = 0;
    if (document.hidden && audioCtx && audioCtx.state === "running") {
      audioCtx.suspend().catch(() => {});
    }
  });

  resize();
  resetToStart();
  updateConstellation();
  requestAnimationFrame(render);

  window.SpaceUniverse = {
    camera,
    scene,
    openPanel,
    closePanel,
    resetToStart,
    startAmbientAudio
  };
})();
