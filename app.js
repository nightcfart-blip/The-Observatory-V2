
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
  const startPoint = { ...C.startPoint };
  const scene = { ...C.baseScene };

  const pointers = new Map();
  const nebulaCache = new Map();

  const reducedMotion = matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let W = 0;
  let H = 0;
  let DPR = 1;

  let pinchState = null;
  let lastFrame = 0;
  let previousTime = 0;
  let sceneTime = 0;

  let shootingStar = null;
  let nextShootingStar = 0;

  let audioCtx = null;
  let masterGain = null;

  // ============================================
  // RANDOMNESS
  // ============================================

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
    return mulberry32(
      (hash(x, y, salt) * 4294967295) >>> 0
    );
  }

  function choose(array, rnd) {
    return array[Math.floor(rnd() * array.length)];
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function rgba(c, a) {
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ============================================
  // CAMERA
  // ============================================

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;

    DPR = Math.min(
      devicePixelRatio || 1,
      C.rendering.maxPixelRatio
    );

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
  }

  function project(x, y, parallax = 1, scale = camera.zoom) {
    return {
      x: W / 2 + (x - camera.x * parallax) * scale,
      y: H / 2 + (y - camera.y * parallax) * scale
    };
  }

  function visibleCells(size, parallax, scale, margin = 1) {
    const cx = camera.x * parallax;
    const cy = camera.y * parallax;
    const hw = W / (2 * scale);
    const hh = H / (2 * scale);

    const cells = [];

    const minX = Math.floor((cx - hw) / size) - margin;
    const maxX = Math.ceil((cx + hw) / size) + margin;
    const minY = Math.floor((cy - hh) / size) - margin;
    const maxY = Math.ceil((cy + hh) / size) + margin;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        cells.push({ x, y });
      }
    }

    return cells;
  }

  function resetToStart() {
    camera.x = startPoint.x;
    camera.y = startPoint.y;
    camera.zoom = startPoint.zoom;
  }

  // ============================================
  // BACKGROUND
  // ============================================

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
    vignette.addColorStop(
      1,
      `rgba(0,0,0,${C.sky.vignetteStrength})`
    );

    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  // ============================================
  // MULTI-DEPTH NEBULAE
  // ============================================

  function getNebulaSprite(layerIndex, cellX, cellY) {
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
    const rnd = rngFor(cellX, cellY, 9137 + layerIndex * 101);

    const size = 768;
    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;

    const g = off.getContext("2d");
    if (!g) return null;

    const palette = C.nebulae.palette;
    const colors = [
      choose(palette, rnd),
      choose(palette, rnd),
      choose(palette, rnd)
    ];

    function colored(color) {
      const variance = scene.nebulaColorVariance;
      const average = (color[0] + color[1] + color[2]) / 3;

      return color.map(v =>
        clamp(Math.round(
          average + (v - average) * variance
        ), 0, 255)
      );
    }

    function cloud(x, y, rx, ry, color, alpha) {
      const radius = Math.max(rx, ry);
      if (radius < 0.1) return;

      g.save();
      g.translate(x, y);
      g.scale(rx / radius, ry / radius);

      const gradient = g.createRadialGradient(
        0, 0, 0,
        0, 0, radius
      );

      gradient.addColorStop(0, rgba(color, alpha));
      gradient.addColorStop(0.2, rgba(color, alpha * 0.72));
      gradient.addColorStop(0.55, rgba(color, alpha * 0.17));
      gradient.addColorStop(1, rgba(color, 0));

      g.fillStyle = gradient;
      g.beginPath();
      g.arc(0, 0, radius, 0, TAU);
      g.fill();
      g.restore();
    }

    const cx = 330 + rnd() * 110;
    const cy = 310 + rnd() * 145;
    const angle = rnd() * TAU;
    const length = 180 + rnd() * 185;

    const shapeType = Math.floor(rnd() * 4);
    const detail = layer.detail;
    const diffuse = layer.diffuse;

    g.globalCompositeOperation = "screen";

    // Diffuse gas clouds.
    const broadCount = Math.round(18 * diffuse);

    for (let i = 0; i < broadCount; i++) {
      const t = rnd() * 2 - 1;

      const x =
        cx + Math.cos(angle) * length * t +
        (rnd() - 0.5) * 175 * diffuse;

      const y =
        cy + Math.sin(angle) * length * t +
        (rnd() - 0.5) * 150 * diffuse;

      cloud(
        x, y,
        (65 + rnd() * 125) * diffuse,
        (35 + rnd() * 95) * diffuse,
        colored(choose(colors, rnd)),
        0.025 + rnd() * 0.04
      );
    }

    // Irregular gas filaments.
    const strands = Math.round(
      (3 + rnd() * 4) * detail
    );

    for (let s = 0; s < strands; s++) {
      const phase = rnd() * TAU;
      const frequency = 1.2 + rnd() * 3;
      const amplitude = 25 + rnd() * 70;

      const tilt = angle + (rnd() - 0.5) * 1.2;
      const thickness = (17 + rnd() * 37) * diffuse;

      const offset = (rnd() - 0.5) * 130;

      const color = colored(choose(colors, rnd));

      const steps = Math.round(45 * detail);

      for (let i = 0; i < steps; i++) {
        const t = i / Math.max(1, steps - 1);
        const along = (t - 0.5) * 2 * length;

        const wave =
          Math.sin(t * frequency * TAU + phase) *
          amplitude;

        const across = offset + wave;

        let x =
          cx + Math.cos(tilt) * along -
          Math.sin(tilt) * across;

        let y =
          cy + Math.sin(tilt) * along +
          Math.cos(tilt) * across;

        if (shapeType === 1) {
          y += Math.sin(t * Math.PI) * 90;
        } else if (shapeType === 2) {
          x += Math.cos(t * TAU) * 65;
        } else if (shapeType === 3) {
          y += Math.sin(t * TAU * 2) * 40;
        }

        const taper = Math.pow(
          Math.max(0, Math.sin(t * Math.PI)), 0.8
        );

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

    // Uneven bright knots, strongest in the midground.
    const knots = Math.round(20 * detail);

    for (let i = 0; i < knots; i++) {
      const t = rnd() * 2 - 1;

      cloud(
        cx + Math.cos(angle) * length * t +
          (rnd() - 0.5) * 125,
        cy + Math.sin(angle) * length * t +
          (rnd() - 0.5) * 125,
        10 + rnd() * 35,
        8 + rnd() * 30,
        colored(choose(colors, rnd)),
        0.035 + rnd() * 0.09
      );
    }

    // Darker voids cut through some of the gas.
    g.globalCompositeOperation = "destination-out";

    for (let i = 0; i < 8 + detail * 7; i++) {
      cloud(
        cx + (rnd() - 0.5) * length * 1.6,
        cy + (rnd() - 0.5) * length * 1.6,
        20 + rnd() * 65,
        12 + rnd() * 48,
        [0, 0, 0],
        0.12 + rnd() * 0.2
      );
    }

    nebulaCache.set(key, off);

    while (nebulaCache.size > C.rendering.nebulaCacheSize) {
      nebulaCache.delete(
        nebulaCache.keys().next().value
      );
    }

    return off;
  }

  function drawNebulaLayer(index, time) {
    const layer = C.nebulae.layers[index];

    const parallax = layer.parallax;
    const scale = camera.zoom * layer.zoomFactor;

    const drift = reducedMotion
      ? 0
      : Math.sin(time * C.nebulae.driftSpeed +
          index * 1.7) * 12 * layer.drift;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const brightness = scene.nebulaBrightness;

    ctx.globalAlpha = clamp(
      layer.opacity * brightness, 0, 1
    );

    for (const cell of visibleCells(
      layer.cellSize, parallax, scale, 2
    )) {
      const rnd = rngFor(
        cell.x, cell.y, 5000 + index * 179
      );

      // Same random distribution regardless of slider value.
      const presence = rnd();
      const probability = clamp(
        layer.density * scene.nebulaFrequency,
        0, 1
      );

      if (presence > probability) continue;

      const worldX =
        cell.x * layer.cellSize +
        (rnd() - 0.5) * layer.cellSize * 0.55;

      const worldY =
        cell.y * layer.cellSize +
        (rnd() - 0.5) * layer.cellSize * 0.55;

      const size = lerp(
        layer.sizeMin, layer.sizeMax, rnd()
      ) * scene.nebulaSize * scale;

      const rotation = rnd() * TAU;
      const uniqueOpacity = 0.55 + rnd() * 0.45;

      const pos = project(
        worldX, worldY, parallax, scale
      );

      // Avoid generating sprites outside the screen.
      if (
        pos.x + size < 0 || pos.x - size > W ||
        pos.y + size < 0 || pos.y - size > H
      ) continue;

      const sprite = getNebulaSprite(
        index, cell.x, cell.y
      );

      if (!sprite) continue;

      ctx.save();
      ctx.globalAlpha = clamp(
        layer.opacity * brightness * uniqueOpacity,
        0, 1
      );

      ctx.translate(
        pos.x + drift,
        pos.y - drift * 0.35
      );

      ctx.rotate(rotation);

      ctx.drawImage(
        sprite,
        -size / 2, -size / 2,
        size, size
      );

      ctx.restore();
    }

    ctx.restore();
  }

  // ============================================
  // STARS
  // ============================================

  function variedStarColor(base, variance, rnd) {
    const rgb = hexToRgb(base);
    const avg = (rgb[0] + rgb[1] + rgb[2]) / 3;

    return "rgb(" + rgb.map(c => {
      const adjusted = avg + (c - avg) * variance;
      return clamp(Math.round(adjusted), 0, 255);
    }).join(",") + ")";
  }

  function drawStar(x, y, r, color, alpha, glow) {
    if (x < -30 || x > W + 30 ||
        y < -30 || y > H + 30) return;

    ctx.save();

    if (glow > 0) {
      const h = ctx.createRadialGradient(
        x, y, 0, x, y, r * 10
      );

      h.addColorStop(0, `rgba(255,255,255,${alpha * 0.3})`);
      h.addColorStop(0.25, `rgba(140,190,255,${alpha * glow})`);
      h.addColorStop(1, "rgba(60,100,170,0)");

      ctx.fillStyle = h;
      circle(x, y, r * 10);
      ctx.fill();
    }

    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.fillStyle = color;

    circle(x, y, Math.max(0.22, r));
    ctx.fill();

    if (r > 1.3) {
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = "rgba(225,240,255,0.13)";
      ctx.beginPath();
      ctx.moveTo(x - r * 5, y);
      ctx.lineTo(x + r * 5, y);
      ctx.moveTo(x, y - r * 5);
      ctx.lineTo(x, y + r * 5);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawStarLayer(index, time) {
    const layers = [
      { count: C.stars.distantCount, depth: 0.18, scale: 0.58, radius: 0.75 },
      { count: C.stars.middleCount, depth: 0.48, scale: 0.82, radius: 1 },
      { count: C.stars.nearCount, depth: 1, scale: 1, radius: 1.14 }
    ];

    const layer = layers[index];
    const scale = camera.zoom * layer.scale;

    const count = Math.max(
      0,
      Math.round(layer.count * scene.starsAmount)
    );

    for (const cell of visibleCells(
      C.stars.cellSize, layer.depth, scale
    )) {
      const rnd = rngFor(
        cell.x, cell.y, 1300 + index
      );

      for (let i = 0; i < count; i++) {
        const x = cell.x * C.stars.cellSize +
          rnd() * C.stars.cellSize;

        const y = cell.y * C.stars.cellSize +
          rnd() * C.stars.cellSize;

        const seed = rnd();
        const phase = rnd() * TAU;
        const speed = 0.7 + rnd() * 1.3;
        const brightnessSeed = rnd();
        const baseColor = choose(C.stars.colors, rnd);

        const radius =
          index === 0
            ? 0.18 + Math.pow(seed, 4) * 0.76
            : index === 1
              ? 0.28 + Math.pow(seed, 4.5) * 1.55
              : 0.4 + Math.pow(seed, 5.4) * 2.15;

        const twinkle = reducedMotion
          ? 1
          : 1 + Math.sin(
              time * C.stars.twinkleSpeed *
              speed + phase
            ) * 0.13 * scene.starsTwinkle;

        const brightness =
          (0.17 + Math.pow(brightnessSeed, 0.42) * 0.82) *
          scene.starsBrightness * twinkle;

        const pos = project(x, y, layer.depth, scale);

        drawStar(
          pos.x,
          pos.y,
          clamp(radius * Math.sqrt(scale) *
            layer.radius, 0.2, 4.3),
          variedStarColor(
            baseColor,
            scene.starsColorVariance,
            rnd
          ),
          brightness,
          seed > 0.91 ? 0.08 + rnd() * 0.16 : 0
        );
      }
    }
  }

  // ============================================
  // DISTANT SHOOTING STARS
  // ============================================

  function scheduleShootingStar(now) {
    if (scene.shootingFrequency <= 0) {
      nextShootingStar = Infinity;
      return;
    }

    const factor = scene.shootingFrequency;

    nextShootingStar = now +
      lerp(
        C.shootingStars.minDelay,
        C.shootingStars.maxDelay,
        Math.random()
      ) / factor;
  }

  function drawShootingStars(now) {
    if (
      reducedMotion ||
      !C.shootingStars.enabled ||
      scene.shootingFrequency <= 0
    ) return;

    if (!nextShootingStar) scheduleShootingStar(now);

    if (!shootingStar && now > nextShootingStar) {
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
      scheduleShootingStar(now);
      return;
    }

    const progress = t * t * (3 - 2 * t);
    const alpha = Math.sin(Math.PI * t) * 0.32;

    const hx = s.x + Math.cos(s.angle) *
      s.distance * progress;

    const hy = s.y + Math.sin(s.angle) *
      s.distance * progress;

    const length = 55 + 75 * (1 - t);

    const tx = hx - Math.cos(s.angle) * length;
    const ty = hy - Math.sin(s.angle) * length;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const grad = ctx.createLinearGradient(
      tx, ty, hx, hy
    );

    grad.addColorStop(0, "rgba(70,110,180,0)");
    grad.addColorStop(
      0.7, `rgba(135,180,255,${alpha * 0.28})`
    );
    grad.addColorStop(
      1, `rgba(245,250,255,${alpha})`
    );

    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.restore();
  }

  // ============================================
  // AMBIENT AUDIO
  // ============================================

  function startAmbientAudio() {
    if (!C.ambientAudio.enabled) return;

    if (audioCtx) {
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) return;

      audioCtx = new AudioContextClass();

      masterGain = audioCtx.createGain();
      masterGain.gain.value = scene.ambientVolume;
      masterGain.connect(audioCtx.destination);

      const buffer = audioCtx.createBuffer(
        1,
        audioCtx.sampleRate * 2,
        audioCtx.sampleRate
      );

      const samples = buffer.getChannelData(0);

      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.random() * 2 - 1;
      }

      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const lowpass = audioCtx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 1600;

      const highpass = audioCtx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 60;

      const noiseGain = audioCtx.createGain();
      noiseGain.gain.value = 0.95;

      noise.connect(lowpass);
      lowpass.connect(highpass);
      highpass.connect(noiseGain);
      noiseGain.connect(masterGain);

      const humGain = audioCtx.createGain();
      humGain.gain.value = 0.06;
      humGain.connect(masterGain);

      [52, 81].forEach(freq => {
        const oscillator = audioCtx.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.value = freq;
        oscillator.connect(humGain);
        oscillator.start();
      });

      noise.start();
      audioCtx.resume().catch(() => {});

    } catch (error) {
      console.warn("Ambient audio unavailable:", error);
    }
  }

  function maybeStartAudio() {
    if (C.ambientAudio.startOnFirstGesture) {
      startAmbientAudio();
    }
  }

  // ============================================
  // SETTINGS
  // ============================================

  function bindSettings() {
    const panel = document.getElementById("settingsPanel");
    const open = document.getElementById("settingsBtn");
    const close = document.getElementById("closeSettingsBtn");
    const home = document.getElementById("homeBtn");

    for (const key of Object.keys(scene)) {
      const input = document.getElementById(key);
      const output = document.getElementById(key + "Value");

      if (!input || !output) continue;

      input.value = scene[key];

      function updateOutput() {
        output.textContent = scene[key].toFixed(
          key === "ambientVolume" ? 3 : 2
        );
      }

      updateOutput();

      input.addEventListener("input", () => {
        scene[key] = Number(input.value);
        updateOutput();

        if (key === "ambientVolume") {
          maybeStartAudio();

          if (masterGain) {
            masterGain.gain.value = scene.ambientVolume;
          }
        }

        if (key === "nebulaColorVariance") {
          nebulaCache.clear();
        }

        if (key === "shootingFrequency") {
          shootingStar = null;
          nextShootingStar = 0;
        }
      });
    }

    open?.addEventListener("click", () => {
      panel?.classList.remove("hidden");
      maybeStartAudio();
    });

    close?.addEventListener("click", () => {
      panel?.classList.add("hidden");
    });

    home?.addEventListener("click", () => {
      resetToStart();
      maybeStartAudio();
    });
  }

  // ============================================
  // TOUCH NAVIGATION
  // ============================================

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
      distance: Math.max(
        1, Math.hypot(a.x - b.x, a.y - b.y)
      )
    };
  }

  canvas.addEventListener("pointerdown", event => {
    if (
      event.pointerType === "mouse" &&
      event.button !== 0
    ) return;

    event.preventDefault();
    maybeStartAudio();

    pointers.set(
      event.pointerId,
      pointerPosition(event)
    );

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_) {}

    pinchState = pointers.size === 2
      ? pinchMetrics() : null;
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
      return;
    }

    if (pointers.size === 2) {
      const before = pinchState || pinchMetrics();

      pointers.set(event.pointerId, current);
      const after = pinchMetrics();

      if (!before || !after) return;

      const worldX =
        camera.x + (before.x - W / 2) / camera.zoom;

      const worldY =
        camera.y + (before.y - H / 2) / camera.zoom;

      camera.zoom = clamp(
        camera.zoom * after.distance / before.distance,
        C.camera.minZoom,
        C.camera.maxZoom
      );

      camera.x =
        worldX - (after.x - W / 2) / camera.zoom;

      camera.y =
        worldY - (after.y - H / 2) / camera.zoom;

      pinchState = after;
      return;
    }

    pointers.set(event.pointerId, current);
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);

    try {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}

    pinchState = pointers.size === 2
      ? pinchMetrics() : null;
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);

  canvas.addEventListener("wheel", event => {
    event.preventDefault();

    // Only two-finger touch gestures control zoom.
    if (event.ctrlKey || event.metaKey) return;

    const multiplier =
      event.deltaMode === 1 ? 16 :
      event.deltaMode === 2 ? H : 1;

    camera.x += event.deltaX * multiplier / camera.zoom;
    camera.y += event.deltaY * multiplier / camera.zoom;
  }, { passive: false });

  // ============================================
  // ANIMATION
  // ============================================

  function render(now) {
    requestAnimationFrame(render);

    const interval = 1000 / C.rendering.targetFPS;

    if (now - lastFrame < interval) return;

    const delta = previousTime
      ? Math.min(60, now - previousTime)
      : 16;

    previousTime = now;
    lastFrame = now;

    if (!reducedMotion) sceneTime += delta;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    drawBackground();

    // Far distance, behind almost everything.
    drawNebulaLayer(0, sceneTime);
    drawStarLayer(0, sceneTime);

    // Background interspersed with distant stars.
    drawNebulaLayer(1, sceneTime);
    drawStarLayer(1, sceneTime);

    // Midground clouds and closer stars.
    drawNebulaLayer(2, sceneTime);
    drawStarLayer(2, sceneTime);

    // Rare, translucent foreground wisps.
    drawNebulaLayer(3, sceneTime);

    // Shooting stars are deliberately subdued.
    drawShootingStars(now);
  }

  window.addEventListener("resize", resize);

  document.addEventListener("visibilitychange", () => {
    previousTime = 0;
  });

  resize();
  bindSettings();
  resetToStart();
  requestAnimationFrame(render);

  window.SpaceUniverse = {
    camera,
    scene,
    resetToStart,
    startAmbientAudio
  };
})();
