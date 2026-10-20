"use strict";

(() => {
  const C = window.SPACE_CONFIG;
  const canvas = document.getElementById("spaceCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  if (!C || !canvas || !ctx) return;

  const TAU = Math.PI * 2;
  const camera = { ...C.camera };
  const startPoint = { ...C.startPoint };

  const pointers = new Map();
  const nebulaCache = new Map();

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scene = {
    ...C.baseScene
  };

  let W = 0;
  let H = 0;
  let DPR = 1;

  let pinchState = null;
  let lastFrame = 0;
  let previousTime = 0;
  let sceneTime = 0;

  let shootingStar = null;
  let nextShootingStar = 0;

  let audioStarted = false;
  let audioCtx = null;
  let masterGain = null;

  let moonImageLoaded = false;
  let moonImageFailed = false;
  const moonImage = new Image();

  const settingsPanel = document.getElementById("settingsPanel");
  const settingsBtn = document.getElementById("settingsBtn");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");
  const homeBtn = document.getElementById("homeBtn");

  const controls = {
    starsAmount: document.getElementById("starsAmount"),
    starsBrightness: document.getElementById("starsBrightness"),
    starsColorVariance: document.getElementById("starsColorVariance"),
    starsTwinkle: document.getElementById("starsTwinkle"),

    shootingFrequency: document.getElementById("shootingFrequency"),

    nebulaColorVariance: document.getElementById("nebulaColorVariance"),
    nebulaBrightness: document.getElementById("nebulaBrightness"),
    nebulaSize: document.getElementById("nebulaSize"),
    nebulaFrequency: document.getElementById("nebulaFrequency"),

    ambientVolume: document.getElementById("ambientVolume")
  };

  const outputs = {
    starsAmount: document.getElementById("starsAmountValue"),
    starsBrightness: document.getElementById("starsBrightnessValue"),
    starsColorVariance: document.getElementById("starsColorVarianceValue"),
    starsTwinkle: document.getElementById("starsTwinkleValue"),

    shootingFrequency: document.getElementById("shootingFrequencyValue"),

    nebulaColorVariance: document.getElementById("nebulaColorVarianceValue"),
    nebulaBrightness: document.getElementById("nebulaBrightnessValue"),
    nebulaSize: document.getElementById("nebulaSizeValue"),
    nebulaFrequency: document.getElementById("nebulaFrequencyValue"),

    ambientVolume: document.getElementById("ambientVolumeValue")
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

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

  function choose(array, rnd) {
    return array[Math.floor(rnd() * array.length)];
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  function hexToRgb(hex) {
    const n = hex.replace("#", "");
    const i = parseInt(n, 16);
    return {
      r: (i >> 16) & 255,
      g: (i >> 8) & 255,
      b: i & 255
    };
  }

  function adjustRgb(rgb, amount) {
    return [
      clamp(Math.round(rgb[0] * amount), 0, 255),
      clamp(Math.round(rgb[1] * amount), 0, 255),
      clamp(Math.round(rgb[2] * amount), 0, 255)
    ];
  }

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
    const halfW = W / (2 * scale);
    const halfH = H / (2 * scale);

    const cx = camera.x * parallax;
    const cy = camera.y * parallax;

    const minX = Math.floor((cx - halfW) / cellSize) - 1;
    const maxX = Math.ceil((cx + halfW) / cellSize) + 1;
    const minY = Math.floor((cy - halfH) / cellSize) - 1;
    const maxY = Math.ceil((cy + halfH) / cellSize) + 1;

    const cells = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        cells.push({ x, y });
      }
    }

    return cells;
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

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.sky.backgroundTop);
    bg.addColorStop(1, C.sky.backgroundBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const vignette = ctx.createRadialGradient(
      W * 0.5, H * 0.45, Math.min(W, H) * 0.1,
      W * 0.5, H * 0.5, Math.max(W, H) * 0.74
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, `rgba(0,0,0,${C.sky.vignetteStrength})`);

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  function buildNebulaSprite(cellX, cellY) {
    const cacheKey = `${cellX}:${cellY}:${scene.nebulaColorVariance.toFixed(2)}:${scene.nebulaBrightness.toFixed(2)}`;
    const cached = cacheGet(nebulaCache, cacheKey);
    if (cached) return cached;

    const rnd = rngFor(cellX, cellY, 9137);

    const probability = C.nebulae.density * scene.nebulaFrequency;
    if (rnd() > probability) return null;

    const size = 1024;
    const off = document.createElement("canvas");
    off.width = off.height = size;
    const g = off.getContext("2d");

    const palette = C.nebulae.palette;
    const baseA = choose(palette, rnd);
    const baseB = choose(palette, rnd);
    const baseC = choose(palette, rnd);

    const colorBoost = 0.9 + scene.nebulaColorVariance * 0.55;

    function drawCloud(x, y, rx, ry, color, alpha) {
      const maxR = Math.max(rx, ry);
      g.save();
      g.translate(x, y);
      g.scale(rx / maxR, ry / maxR);

      const grad = g.createRadialGradient(0, 0, 0, 0, 0, maxR);
      grad.addColorStop(0, rgba(color, alpha));
      grad.addColorStop(0.18, rgba(color, alpha * 0.82));
      grad.addColorStop(0.5, rgba(color, alpha * 0.24));
      grad.addColorStop(1, rgba(color, 0));

      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, maxR, 0, TAU);
      g.fill();
      g.restore();
    }

    g.clearRect(0, 0, size, size);
    g.globalCompositeOperation = "screen";

    const angle = rnd() * TAU;
    const centerX = 420 + rnd() * 180;
    const centerY = 390 + rnd() * 220;
    const length = 250 + rnd() * 250;
    const strands = 5 + Math.floor(rnd() * 4);

    for (let i = 0; i < 22; i++) {
      const t = rnd() * 2 - 1;
      const x = centerX + Math.cos(angle) * length * t + (rnd() - 0.5) * 180;
      const y = centerY + Math.sin(angle) * length * t + (rnd() - 0.5) * 160;

      const chosen = rnd() < 0.33 ? baseA : rnd() < 0.66 ? baseB : baseC;
      drawCloud(
        x,
        y,
        110 + rnd() * 190,
        38 + rnd() * 120,
        adjustRgb(chosen, colorBoost),
        (0.012 + rnd() * 0.026) * scene.nebulaBrightness
      );
    }

    for (let s = 0; s < strands; s++) {
      const strandAngle = angle + (rnd() - 0.5) * 1.1;
      const amplitude = 35 + rnd() * 90;
      const thickness = 18 + rnd() * 58;
      const localColor = adjustRgb(choose([baseA, baseB, baseC], rnd), colorBoost);
      const phase = rnd() * TAU;

      for (let i = 0; i < 64; i++) {
        const t = i / 63;
        const along = (t - 0.5) * length * 2;
        const wave = Math.sin(t * TAU * (1.2 + rnd() * 2.5) + phase) * amplitude;
        const x = centerX + Math.cos(strandAngle) * along - Math.sin(strandAngle) * wave;
        const y = centerY + Math.sin(strandAngle) * along + Math.cos(strandAngle) * wave;
        const taper = Math.pow(Math.sin(Math.PI * t), 0.74);

        drawCloud(
          x + (rnd() - 0.5) * 12,
          y + (rnd() - 0.5) * 12,
          thickness * (0.68 + rnd() * 0.62) * taper + 8,
          thickness * (0.28 + rnd() * 0.42) * taper + 7,
          localColor,
          (0.017 + rnd() * 0.044) * taper * scene.nebulaBrightness
        );
      }
    }

    for (let i = 0; i < 28; i++) {
      drawCloud(
        centerX + (rnd() - 0.5) * length * 1.7,
        centerY + (rnd() - 0.5) * length * 1.35,
        16 + rnd() * 60,
        12 + rnd() * 50,
        adjustRgb(choose([baseA, baseB, baseC], rnd), colorBoost * 1.05),
        (0.02 + rnd() * 0.05) * scene.nebulaBrightness
      );
    }

    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 14; i++) {
      drawCloud(
        centerX + (rnd() - 0.5) * length * 1.25,
        centerY + (rnd() - 0.5) * length * 1.25,
        34 + rnd() * 90,
        18 + rnd() * 74,
        [0, 0, 0],
        0.05 + rnd() * 0.06
      );
    }

    cacheSet(nebulaCache, cacheKey, off, C.rendering.nebulaCacheSize);
    return off;
  }

  function drawNebulae(time) {
    const parallax = 0.36;
    const scale = camera.zoom * 0.94;
    const drift = reducedMotion ? 0 : Math.sin(time * C.nebulae.driftSpeed) * 10;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = C.nebulae.opacity * Math.min(1.3, scene.nebulaBrightness);

    for (const cell of visibleCells(C.nebulae.cellSize, parallax, scale)) {
      const sprite = buildNebulaSprite(cell.x, cell.y);
      if (!sprite) continue;

      const rnd = rngFor(cell.x, cell.y, 5151);
      const worldX = cell.x * C.nebulae.cellSize + (rnd() - 0.5) * 620;
      const worldY = cell.y * C.nebulae.cellSize + (rnd() - 0.5) * 620;
      const pos = project(worldX, worldY, parallax, scale);
      const size = lerp(C.nebulae.sizeMin, C.nebulae.sizeMax, rnd()) * scene.nebulaSize * scale;

      ctx.save();
      ctx.translate(pos.x + drift, pos.y - drift * 0.25);
      ctx.rotate(rnd() * TAU);
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    ctx.restore();
  }

  function variedStarColor(baseHex, variance, rnd) {
    const rgb = hexToRgb(baseHex);

    const drift = variance * 45;
    return `rgb(${clamp(Math.round(rgb.r + (rnd() - 0.5) * drift), 0, 255)},
                ${clamp(Math.round(rgb.g + (rnd() - 0.5) * drift), 0, 255)},
                ${clamp(Math.round(rgb.b + (rnd() - 0.5) * drift), 0, 255)})`;
  }

  function drawStar(x, y, radius, color, alpha, glowStrength) {
    if (x < -24 || x > W + 24 || y < -24 || y > H + 24) return;

    if (glowStrength > 0) {
      const halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 10);
      halo.addColorStop(0, `rgba(255,255,255,${alpha * 0.22})`);
      halo.addColorStop(0.26, `rgba(165,205,255,${alpha * glowStrength})`);
      halo.addColorStop(1, "rgba(70,110,170,0)");
      ctx.fillStyle = halo;
      circle(x, y, radius * 10);
      ctx.fill();
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    circle(x, y, Math.max(0.22, radius));
    ctx.fill();

    if (radius > 1.3) {
      ctx.strokeStyle = `rgba(230,240,255,${alpha * 0.12})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - radius * 5.6, y);
      ctx.lineTo(x + radius * 5.6, y);
      ctx.moveTo(x, y - radius * 5.6);
      ctx.lineTo(x, y + radius * 5.6);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  function drawStarLayer(layer, time) {
    const layers = [
      { count: C.stars.distantCount, parallax: 0.18, scaleFactor: 0.58, radiusScale: 0.75 },
      { count: C.stars.middleCount, parallax: 0.48, scaleFactor: 0.82, radiusScale: 1 },
      { count: C.stars.nearCount, parallax: 1, scaleFactor: 1, radiusScale: 1.14 }
    ];

    const conf = layers[layer];
    const scale = camera.zoom * conf.scaleFactor;
    const count = Math.max(1, Math.round(conf.count * scene.starsAmount));

    for (const cell of visibleCells(C.stars.cellSize, conf.parallax, scale)) {
      const rnd = rngFor(cell.x, cell.y, 1300 + layer);

      for (let i = 0; i < count; i++) {
        const wx = cell.x * C.stars.cellSize + rnd() * C.stars.cellSize;
        const wy = cell.y * C.stars.cellSize + rnd() * C.stars.cellSize;

        const base = rnd();
        const phase = rnd() * TAU;
        const twinkle =
          reducedMotion
            ? 1
            : 1 + Math.sin(time * C.stars.twinkleSpeed * scene.starsTwinkle * (0.75 + rnd() * 1.25) + phase) * (0.13 * scene.starsTwinkle);

        const pos = project(wx, wy, conf.parallax, scale);

        const radius =
          layer === 0
            ? 0.18 + Math.pow(base, 4) * 0.76
            : layer === 1
              ? 0.28 + Math.pow(base, 4.5) * 1.55
              : 0.4 + Math.pow(base, 5.4) * 2.15;

        const brightness = (0.17 + Math.pow(rnd(), 0.42) * 0.82) * scene.starsBrightness * twinkle;
        const glow = base > 0.91 ? 0.08 + rnd() * 0.16 : 0;

        drawStar(
          pos.x,
          pos.y,
          clamp(radius * Math.sqrt(scale) * conf.radiusScale, 0.2, 4.3),
          variedStarColor(choose(C.stars.colors, rnd), scene.starsColorVariance, rnd),
          Math.min(1, brightness),
          glow
        );
      }
    }
  }

  function loadMoonImage() {
    moonImage.onload = () => {
      moonImageLoaded = true;
      moonImageFailed = false;
    };

    moonImage.onerror = () => {
      moonImageLoaded = false;
      moonImageFailed = true;
      console.warn("Moon image failed to load. Make sure IMG_8758.jpeg is in the same folder as index.html.");
    };

    moonImage.src = C.moon.imagePath;
  }

  function drawMoon(time) {
    if (!moonImageLoaded) return;

    const m = C.moon;
    const drift = reducedMotion ? 0 : Math.sin(time * 0.00004) * m.driftAmplitude;

    const pos = project(
      m.worldX + drift,
      m.worldY - drift * 0.18,
      m.parallax,
      camera.zoom * m.scaleFactor
    );

    const drawWidth = m.width * camera.zoom * m.scaleFactor;
    const drawHeight = m.height * camera.zoom * m.scaleFactor;

    const left = pos.x - drawWidth / 2;
    const top = pos.y - drawHeight / 2;

    if (
      left > W + 200 ||
      top > H + 200 ||
      left + drawWidth < -200 ||
      top + drawHeight < -200
    ) {
      return;
    }

    // soft distant halo
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const halo = ctx.createRadialGradient(
      pos.x, pos.y, drawWidth * 0.22,
      pos.x, pos.y, drawWidth * 0.64
    );
    halo.addColorStop(0, `rgba(255,255,255,${m.glowOpacity * 0.24})`);
    halo.addColorStop(0.55, `rgba(130,170,210,${m.glowOpacity})`);
    halo.addColorStop(1, "rgba(90,130,180,0)");
    ctx.fillStyle = halo;
    circle(pos.x, pos.y, drawWidth * 0.64);
    ctx.fill();
    ctx.restore();

    // main moon image
    ctx.save();
    ctx.globalAlpha = m.opacity;
    ctx.drawImage(moonImage, left, top, drawWidth, drawHeight);
    ctx.restore();
  }

  function scheduleShootingStar(time) {
    const frequency = scene.shootingFrequency;
    const minDelay = lerp(9000, 24000, 1 - Math.min(1, frequency / 2));
    const maxDelay = lerp(15000, 32000, 1 - Math.min(1, frequency / 2));

    nextShootingStar = time + lerp(minDelay, maxDelay, Math.random());
  }

  function drawShootingStars(time) {
    if (!C.shootingStars.enabled) return;

    if (!nextShootingStar) {
      scheduleShootingStar(time);
    }

    if (!shootingStar && time > nextShootingStar) {
      shootingStar = {
        born: time,
        x: Math.random() * W,
        y: Math.random() * H * 0.52,
        angle: Math.PI * (0.12 + Math.random() * 0.18),
        distance: 120 + Math.random() * 220,
        duration: C.shootingStars.duration
      };
    }

    if (!shootingStar) return;

    const s = shootingStar;
    const t = (time - s.born) / s.duration;

    if (t >= 1) {
      shootingStar = null;
      scheduleShootingStar(time);
      return;
    }

    const progress = smoothstep(t);
    const opacity = Math.sin(t * Math.PI) * 0.35;

    const hx = s.x + Math.cos(s.angle) * s.distance * progress;
    const hy = s.y + Math.sin(s.angle) * s.distance * progress;

    const tailLength = 55 + 75 * (1 - t);
    const tx = hx - Math.cos(s.angle) * tailLength;
    const ty = hy - Math.sin(s.angle) * tailLength;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const grad = ctx.createLinearGradient(tx, ty, hx, hy);
    grad.addColorStop(0, "rgba(70,110,180,0)");
    grad.addColorStop(0.7, `rgba(135,180,255,${opacity * 0.28})`);
    grad.addColorStop(1, `rgba(245,250,255,${opacity})`);

    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 8);
    glow.addColorStop(0, `rgba(255,255,255,${opacity * 0.45})`);
    glow.addColorStop(1, "rgba(130,180,255,0)");

    ctx.fillStyle = glow;
    circle(hx, hy, 8);
    ctx.fill();

    ctx.restore();
  }

  function startAmbientAudio() {
    if (!C.ambientAudio.enabled || audioStarted) return;
    audioStarted = true;

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

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = buffer;
      whiteNoise.loop = true;

      const lowpass = audioCtx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 1600;
      lowpass.Q.value = 0.7;

      const highpass = audioCtx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 60;
      highpass.Q.value = 0.4;

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0.9;

      const humGain = audioCtx.createGain();
      humGain.gain.value = 0.08;

      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 52;

      const osc2 = audioCtx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 81;

      const lfo = audioCtx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.05;

      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 12;

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      whiteNoise.connect(lowpass);
      lowpass.connect(highpass);
      highpass.connect(noiseGain);
      noiseGain.connect(masterGain);

      osc.connect(humGain);
      osc2.connect(humGain);
      humGain.connect(masterGain);

      whiteNoise.start();
      osc.start();
      osc2.start();
      lfo.start();

      if (audioCtx.state === "suspended") {
        audioCtx.resume();
      }
    } catch (err) {
      console.warn("Ambient audio failed:", err);
    }
  }

  function updateAmbientVolume() {
    if (masterGain) {
      masterGain.gain.value = scene.ambientVolume;
    }
  }

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

  function maybeStartAudio() {
    if (C.ambientAudio.startOnFirstGesture) {
      startAmbientAudio();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function resetToStart() {
    camera.x = startPoint.x;
    camera.y = startPoint.y;
    camera.zoom = startPoint.zoom;
  }

  function bindSettings() {
    for (const [key, input] of Object.entries(controls)) {
      input.value = scene[key];
      outputs[key].textContent = Number(scene[key]).toFixed(key === "ambientVolume" ? 3 : 2);

      input.addEventListener("input", () => {
        scene[key] = Number(input.value);
        outputs[key].textContent = Number(scene[key]).toFixed(key === "ambientVolume" ? 3 : 2);

        if (key === "ambientVolume") {
          maybeStartAudio();
          updateAmbientVolume();
        }

        if (
          key === "nebulaColorVariance" ||
          key === "nebulaBrightness" ||
          key === "nebulaFrequency"
        ) {
          nebulaCache.clear();
        }

        if (key === "shootingFrequency") {
          nextShootingStar = 0;
        }
      });
    }

    settingsBtn.addEventListener("click", () => {
      settingsPanel.classList.remove("hidden");
      maybeStartAudio();
    });

    closeSettingsBtn.addEventListener("click", () => {
      settingsPanel.classList.add("hidden");
    });

    homeBtn.addEventListener("click", () => {
      resetToStart();
      maybeStartAudio();
    });
  }

  canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    maybeStartAudio();

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

      const worldX = camera.x + (before.x - W / 2) / camera.zoom;
      const worldY = camera.y + (before.y - H / 2) / camera.zoom;

      const newZoom = clamp(
        camera.zoom * (after.distance / before.distance),
        C.camera.minZoom,
        C.camera.maxZoom
      );

      camera.zoom = newZoom;
      camera.x = worldX - (after.x - W / 2) / newZoom;
      camera.y = worldY - (after.y - H / 2) / newZoom;

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

  canvas.addEventListener("wheel", event => {
    event.preventDefault();

    if (event.ctrlKey || event.metaKey) return;

    maybeStartAudio();

    const multiplier =
      event.deltaMode === 1 ? 16 :
      event.deltaMode === 2 ? H : 1;

    camera.x += (event.deltaX * multiplier) / camera.zoom;
    camera.y += (event.deltaY * multiplier) / camera.zoom;
  }, { passive: false });

  function render(time) {
    const frameInterval = 1000 / C.rendering.targetFPS;

    if (time - lastFrame < frameInterval) {
      requestAnimationFrame(render);
      return;
    }

    const delta = previousTime ? Math.min(60, time - previousTime) : 16;
    previousTime = time;
    lastFrame = time;

    if (!reducedMotion) {
      sceneTime += delta;
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, W, H);

    drawBackground();
    drawStarLayer(0, sceneTime);
    drawNebulae(sceneTime);
    drawMoon(sceneTime);
    drawStarLayer(1, sceneTime);
    drawStarLayer(2, sceneTime);
    drawShootingStars(time);

    requestAnimationFrame(render);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    previousTime = 0;
  });

  resize();
  bindSettings();
  resetToStart();
  loadMoonImage();
  requestAnimationFrame(render);

  window.SpaceUniverse = {
    camera,
    scene,
    resetToStart,
    startAmbientAudio
  };
})();
