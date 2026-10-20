
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

  const smoothstep = t => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

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
  let previousTime = 0;
  let lastFrame = 0;
  let sceneTime = 0;

  let shootingStar = null;
  let nextShootingStar = 0;

  let audioCtx = null;
  let masterGain = null;
  let audioStarted = false;

  // =====================================
  // 1. RANDOM GENERATION
  // =====================================

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

    return () => {
      t += 0x6D2B79F5;

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

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace("#", ""), 16);

    return [
      (n >> 16) & 255,
      (n >> 8) & 255,
      n & 255
    ];
  }

  function adjustRgb(rgb, amount) {
    return rgb.map(v =>
      clamp(Math.round(v * amount), 0, 255)
    );
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  // =====================================
  // 2. VIEWPORT AND CAMERA
  // =====================================

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

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function project(
    x,
    y,
    parallax = 1,
    scale = camera.zoom
  ) {
    return {
      x: W / 2 + (x - camera.x * parallax) * scale,
      y: H / 2 + (y - camera.y * parallax) * scale
    };
  }

  function visibleCells(
    size,
    parallax = 1,
    scale = camera.zoom
  ) {
    const halfW = W / (2 * scale);
    const halfH = H / (2 * scale);

    const cx = camera.x * parallax;
    const cy = camera.y * parallax;

    const minX = Math.floor((cx - halfW) / size) - 1;
    const maxX = Math.ceil((cx + halfW) / size) + 1;

    const minY = Math.floor((cy - halfH) / size) - 1;
    const maxY = Math.ceil((cy + halfH) / size) + 1;

    const cells = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        cells.push({ x, y });
      }
    }

    return cells;
  }

  // =====================================
  // 3. BACKGROUND
  // =====================================

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, 0, H);

    bg.addColorStop(0, C.sky.backgroundTop);
    bg.addColorStop(1, C.sky.backgroundBottom);

    ctx.fillStyle = bg;
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

  // =====================================
  // 4. NEBULAE
  // =====================================

  function buildNebulaSprite(cellX, cellY) {
    const key = [
      cellX,
      cellY,
      scene.nebulaColorVariance.toFixed(2),
      scene.nebulaBrightness.toFixed(2)
    ].join(":");

    if (nebulaCache.has(key)) {
      const sprite = nebulaCache.get(key);

      nebulaCache.delete(key);
      nebulaCache.set(key, sprite);

      return sprite;
    }

    const rnd = rngFor(cellX, cellY, 9137);

    const probability = Math.min(
      1,
      C.nebulae.density * scene.nebulaFrequency
    );

    if (rnd() > probability) return null;

    const size = 1024;

    const off = document.createElement("canvas");
    off.width = size;
    off.height = size;

    const g = off.getContext("2d");
    if (!g) return null;

    const palette = C.nebulae.palette;

    const baseA = choose(palette, rnd);
    const baseB = choose(palette, rnd);
    const baseC = choose(palette, rnd);

    const colorBoost =
      0.9 + scene.nebulaColorVariance * 0.55;

    function cloud(x, y, rx, ry, color, alpha) {
      const radius = Math.max(rx, ry);

      g.save();
      g.translate(x, y);
      g.scale(rx / radius, ry / radius);

      const grad = g.createRadialGradient(
        0, 0, 0,
        0, 0, radius
      );

      grad.addColorStop(0, rgba(color, alpha));
      grad.addColorStop(0.18, rgba(color, alpha * 0.82));
      grad.addColorStop(0.5, rgba(color, alpha * 0.24));
      grad.addColorStop(1, rgba(color, 0));

      g.fillStyle = grad;

      g.beginPath();
      g.arc(0, 0, radius, 0, TAU);
      g.fill();

      g.restore();
    }

    g.globalCompositeOperation = "screen";

    const angle = rnd() * TAU;
    const centerX = 420 + rnd() * 180;
    const centerY = 390 + rnd() * 220;

    const length = 250 + rnd() * 250;
    const strands = 5 + Math.floor(rnd() * 4);

    // Diffuse outer gas.
    for (let i = 0; i < 22; i++) {
      const t = rnd() * 2 - 1;

      const x =
        centerX +
        Math.cos(angle) * length * t +
        (rnd() - 0.5) * 180;

      const y =
        centerY +
        Math.sin(angle) * length * t +
        (rnd() - 0.5) * 160;

      const color = adjustRgb(
        choose([baseA, baseB, baseC], rnd),
        colorBoost
      );

      cloud(
        x, y,
        110 + rnd() * 190,
        38 + rnd() * 120,
        color,
        (0.012 + rnd() * 0.026) *
          scene.nebulaBrightness
      );
    }

    // Irregular gas filaments.
    for (let s = 0; s < strands; s++) {
      const angle2 = angle + (rnd() - 0.5) * 1.1;
      const amplitude = 35 + rnd() * 90;
      const thickness = 18 + rnd() * 58;
      const phase = rnd() * TAU;

      const color = adjustRgb(
        choose([baseA, baseB, baseC], rnd),
        colorBoost
      );

      const frequency = 1.2 + rnd() * 2.5;

      for (let i = 0; i < 64; i++) {
        const t = i / 63;
        const along = (t - 0.5) * length * 2;

        const wave =
          Math.sin(t * TAU * frequency + phase) *
          amplitude;

        const x =
          centerX +
          Math.cos(angle2) * along -
          Math.sin(angle2) * wave;

        const y =
          centerY +
          Math.sin(angle2) * along +
          Math.cos(angle2) * wave;

        const taper = Math.pow(
          Math.sin(Math.PI * t),
          0.74
        );

        cloud(
          x + (rnd() - 0.5) * 12,
          y + (rnd() - 0.5) * 12,
          thickness * (0.68 + rnd() * 0.62) *
            taper + 8,
          thickness * (0.28 + rnd() * 0.42) *
            taper + 7,
          color,
          (0.017 + rnd() * 0.044) *
            taper * scene.nebulaBrightness
        );
      }
    }

    // Luminous knots.
    for (let i = 0; i < 28; i++) {
      cloud(
        centerX + (rnd() - 0.5) * length * 1.7,
        centerY + (rnd() - 0.5) * length * 1.35,
        16 + rnd() * 60,
        12 + rnd() * 50,
        adjustRgb(
          choose([baseA, baseB, baseC], rnd),
          colorBoost * 1.05
        ),
        (0.02 + rnd() * 0.05) *
          scene.nebulaBrightness
      );
    }

    // Dark interruptions in the cloud structure.
    g.globalCompositeOperation = "destination-out";

    for (let i = 0; i < 14; i++) {
      cloud(
        centerX + (rnd() - 0.5) * length * 1.25,
        centerY + (rnd() - 0.5) * length * 1.25,
        34 + rnd() * 90,
        18 + rnd() * 74,
        [0, 0, 0],
        0.05 + rnd() * 0.06
      );
    }

    nebulaCache.set(key, off);

    while (
      nebulaCache.size > C.rendering.nebulaCacheSize
    ) {
      const oldest = nebulaCache.keys().next().value;
      nebulaCache.delete(oldest);
    }

    return off;
  }

  function drawNebulae(time) {
    const parallax = 0.36;
    const scale = camera.zoom * 0.94;

    const drift = reducedMotion
      ? 0
      : Math.sin(
          time * C.nebulae.driftSpeed
        ) * 10;

    ctx.save();

    ctx.globalCompositeOperation = "screen";

    ctx.globalAlpha =
      C.nebulae.opacity *
      Math.min(1.3, scene.nebulaBrightness);

    for (
      const cell of visibleCells(
        C.nebulae.cellSize,
        parallax,
        scale
      )
    ) {
      const sprite = buildNebulaSprite(
        cell.x,
        cell.y
      );

      if (!sprite) continue;

      const rnd = rngFor(cell.x, cell.y, 5151);

      const worldX =
        cell.x * C.nebulae.cellSize +
        (rnd() - 0.5) * 620;

      const worldY =
        cell.y * C.nebulae.cellSize +
        (rnd() - 0.5) * 620;

      const pos = project(
        worldX,
        worldY,
        parallax,
        scale
      );

      const size = lerp(
        C.nebulae.sizeMin,
        C.nebulae.sizeMax,
        rnd()
      ) * scene.nebulaSize * scale;

      ctx.save();

      ctx.translate(
        pos.x + drift,
        pos.y - drift * 0.25
      );

      ctx.rotate(rnd() * TAU);

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

  // =====================================
  // 5. STARS
  // =====================================

  function variedStarColor(baseHex, variance, rnd) {
    const rgb = hexToRgb(baseHex);
    const drift = variance * 45;

    return `rgb(
      ${clamp(Math.round(rgb[0] + (rnd() - 0.5) * drift), 0, 255)},
      ${clamp(Math.round(rgb[1] + (rnd() - 0.5) * drift), 0, 255)},
      ${clamp(Math.round(rgb[2] + (rnd() - 0.5) * drift), 0, 255)}
    )`;
  }

  function drawStar(
    x,
    y,
    radius,
    color,
    alpha,
    glowStrength
  ) {
    if (
      x < -30 || x > W + 30 ||
      y < -30 || y > H + 30
    ) return;

    ctx.save();

    if (glowStrength > 0) {
      const halo = ctx.createRadialGradient(
        x, y, 0,
        x, y, radius * 10
      );

      halo.addColorStop(
        0,
        `rgba(255,255,255,${alpha * 0.22})`
      );

      halo.addColorStop(
        0.26,
        `rgba(165,205,255,${alpha * glowStrength})`
      );

      halo.addColorStop(
        1,
        "rgba(70,110,170,0)"
      );

      ctx.fillStyle = halo;
      circle(x, y, radius * 10);
      ctx.fill();
    }

    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    circle(x, y, Math.max(0.22, radius));
    ctx.fill();

    if (radius > 1.3) {
      ctx.strokeStyle =
        `rgba(230,240,255,${alpha * 0.12})`;

      ctx.lineWidth = 0.5;
      ctx.beginPath();

      ctx.moveTo(x - radius * 5.6, y);
      ctx.lineTo(x + radius * 5.6, y);

      ctx.moveTo(x, y - radius * 5.6);
      ctx.lineTo(x, y + radius * 5.6);

      ctx.stroke();
    }

    ctx.restore();
  }

  function drawStarLayer(layer, time) {
    const layers = [
      {
        count: C.stars.distantCount,
        parallax: 0.18,
        scaleFactor: 0.58,
        radiusScale: 0.75
      },
      {
        count: C.stars.middleCount,
        parallax: 0.48,
        scaleFactor: 0.82,
        radiusScale: 1
      },
      {
        count: C.stars.nearCount,
        parallax: 1,
        scaleFactor: 1,
        radiusScale: 1.14
      }
    ];

    const conf = layers[layer];

    const scale =
      camera.zoom * conf.scaleFactor;

    const count = Math.max(
      0,
      Math.round(
        conf.count * scene.starsAmount
      )
    );

    for (
      const cell of visibleCells(
        C.stars.cellSize,
        conf.parallax,
        scale
      )
    ) {
      const rnd = rngFor(
        cell.x,
        cell.y,
        1300 + layer
      );

      for (let i = 0; i < count; i++) {
        const wx =
          cell.x * C.stars.cellSize +
          rnd() * C.stars.cellSize;

        const wy =
          cell.y * C.stars.cellSize +
          rnd() * C.stars.cellSize;

        const base = rnd();
        const phase = rnd() * TAU;

        const twinkle = reducedMotion
          ? 1
          : 1 + Math.sin(
              time *
              C.stars.twinkleSpeed *
              scene.starsTwinkle *
              (0.75 + rnd() * 1.25) +
              phase
            ) * (0.13 * scene.starsTwinkle);

        const pos = project(
          wx,
          wy,
          conf.parallax,
          scale
        );

        const radius = layer === 0
          ? 0.18 + Math.pow(base, 4) * 0.76
          : layer === 1
            ? 0.28 + Math.pow(base, 4.5) * 1.55
            : 0.4 + Math.pow(base, 5.4) * 2.15;

        const brightness =
          (0.17 + Math.pow(rnd(), 0.42) * 0.82) *
          scene.starsBrightness *
          twinkle;

        const glow = base > 0.91
          ? 0.08 + rnd() * 0.16
          : 0;

        drawStar(
          pos.x,
          pos.y,
          clamp(
            radius * Math.sqrt(scale) *
              conf.radiusScale,
            0.2,
            4.3
          ),
          variedStarColor(
            choose(C.stars.colors, rnd),
            scene.starsColorVariance,
            rnd
          ),
          clamp(brightness, 0, 1),
          glow
        );
      }
    }
  }

  // =====================================
  // 6. PHOTOGRAPHIC MOON
  // =====================================

  /*
    FIXED MOON RENDERING

    Previously:
    - dark pixels were made transparent
    - stars could show through the moon
    - a huge circular shadow darkened the sky
    - artificial fog created a blue/black ring

    Now:
    - the moon has a real opaque circular mask
    - its shadowed half is solid dark
    - the photo is rendered inside that circle
    - the illuminated region is 40% darker
    - no external shadow or fog is drawn
    - all stars are drawn BEFORE the moon
  */

  const moonImage = new Image();

  let moonReady = false;
  let moonTexture = null;

  // Original photograph dimensions: 236 x 236.
  // The actual moon occupies a smaller disk within it.
  //
  // These coordinates describe the moon in the
  // supplied IMG_8758.jpeg photograph.

  const SOURCE_MOON = {
    centerX: 112,
    centerY: 106,
    radius: 80
  };

  const MOON_LIGHT = 0.60;
  // 0.60 = 40% darker illuminated surface.

  const MOON_DARK_COLOR = "#010308";
  // Fully opaque nighttime hemisphere.

  function buildMoonTexture() {
    const size = 512;

    const off = document.createElement("canvas");

    off.width = size;
    off.height = size;

    const g = off.getContext("2d");

    if (!g) return;

    const cx = size / 2;
    const cy = size / 2;

    const radius = size / 2 - 1;

    // First establish an opaque, circular moon.
    // The dark half will never be transparent.

    g.beginPath();
    g.arc(cx, cy, radius, 0, TAU);
    g.closePath();

    g.fillStyle = MOON_DARK_COLOR;
    g.fill();

    // The clipping mask applies to the image only.
    // Nothing outside the moon can affect the sky.

    g.save();

    g.beginPath();
    g.arc(cx, cy, radius, 0, TAU);
    g.clip();

    // Fit the exact visible photographic moon
    // into our circular texture.

    const sourceDiameter = SOURCE_MOON.radius * 2;

    const sx =
      SOURCE_MOON.centerX -
      SOURCE_MOON.radius;

    const sy =
      SOURCE_MOON.centerY -
      SOURCE_MOON.radius;

    // The photograph contains black space.
    // "screen" blends black as zero light,
    // without turning the moon transparent.

    g.globalCompositeOperation = "screen";
    g.globalAlpha = MOON_LIGHT;

    g.drawImage(
      moonImage,
      sx,
      sy,
      sourceDiameter,
      sourceDiameter,
      0,
      0,
      size,
      size
    );

    g.restore();

    // Reinforce the darkest regions without
    // using any external shadow or halo.

    g.save();

    g.beginPath();
    g.arc(cx, cy, radius, 0, TAU);
    g.clip();

    const darkness = g.createLinearGradient(
      0, 0,
      size, 0
    );

    darkness.addColorStop(
      0,
      "rgba(0,0,0,0.16)"
    );

    darkness.addColorStop(
      0.44,
      "rgba(0,0,0,0.05)"
    );

    darkness.addColorStop(
      1,
      "rgba(0,0,0,0.10)"
    );

    g.fillStyle = darkness;
    g.fillRect(0, 0, size, size);

    g.restore();

    moonTexture = off;
  }

  function loadMoonImage() {
    moonImage.onload = () => {
      buildMoonTexture();
      moonReady = !!moonTexture;
    };

    moonImage.onerror = () => {
      console.warn(
        "Could not load IMG_8758.jpeg. " +
        "Check the file path and capitalization."
      );
    };

    moonImage.src = C.moon.imagePath;
  }

  function drawMoon(time) {
    if (!moonReady || !moonTexture) return;

    const m = C.moon;

    const drift = reducedMotion
      ? 0
      : Math.sin(time * 0.00004) *
        m.driftAmplitude;

    const scale =
      camera.zoom * m.scaleFactor;

    const pos = project(
      m.worldX + drift,
      m.worldY - drift * 0.18,
      m.parallax,
      scale
    );

    /*
      Preserve the apparent moon size from the
      previous versions.

      Previously, m.width represented the entire
      236-pixel source image, whereas the visible
      moon occupied approximately 160 pixels.
    */

    const imageFraction =
      (SOURCE_MOON.radius * 2) / 236;

    const diameter =
      m.width * imageFraction * scale;

    // Preserve the photographic disk's offset
    // relative to the old full-image position.

    const xOffset =
      (SOURCE_MOON.centerX - 118) / 236 *
      m.width * scale;

    const yOffset =
      (SOURCE_MOON.centerY - 118) / 236 *
      m.height * scale;

    const x = pos.x + xOffset;
    const y = pos.y + yOffset;

    const radius = diameter / 2;

    if (
      x + radius < 0 ||
      x - radius > W ||
      y + radius < 0 ||
      y - radius > H
    ) return;

    // IMPORTANT:
    // No globalAlpha reduction.
    // No fog.
    // No atmospheric ring.
    // No circle covering the surrounding stars.

    ctx.save();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    ctx.drawImage(
      moonTexture,
      x - radius,
      y - radius,
      diameter,
      diameter
    );

    ctx.restore();
  }

  // =====================================
  // 7. DISTANT SHOOTING STARS
  // =====================================

  function scheduleShootingStar(time) {
    if (scene.shootingFrequency <= 0) {
      nextShootingStar = Infinity;
      return;
    }

    const frequency = scene.shootingFrequency;

    const minDelay =
      C.shootingStars.minDelay /
      Math.max(0.1, frequency);

    const maxDelay =
      C.shootingStars.maxDelay /
      Math.max(0.1, frequency);

    nextShootingStar =
      time + lerp(
        minDelay,
        maxDelay,
        Math.random()
      );
  }

  function drawShootingStars(time) {
    if (
      reducedMotion ||
      !C.shootingStars.enabled ||
      scene.shootingFrequency <= 0
    ) {
      return;
    }

    if (!nextShootingStar) {
      scheduleShootingStar(time);
    }

    if (
      !shootingStar &&
      time > nextShootingStar
    ) {
      shootingStar = {
        born: time,
        x: Math.random() * W,
        y: Math.random() * H * 0.65,
        angle:
          Math.PI *
          (0.12 + Math.random() * 0.18),
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

    const hx =
      s.x +
      Math.cos(s.angle) *
      s.distance * progress;

    const hy =
      s.y +
      Math.sin(s.angle) *
      s.distance * progress;

    const length = 55 + 75 * (1 - t);

    const tx =
      hx - Math.cos(s.angle) * length;

    const ty =
      hy - Math.sin(s.angle) * length;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const grad = ctx.createLinearGradient(
      tx, ty, hx, hy
    );

    grad.addColorStop(
      0,
      "rgba(70,110,180,0)"
    );

    grad.addColorStop(
      0.7,
      `rgba(135,180,255,${opacity * 0.28})`
    );

    grad.addColorStop(
      1,
      `rgba(245,250,255,${opacity})`
    );

    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.9;

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.restore();
  }

  // =====================================
  // 8. AMBIENT AUDIO
  // =====================================

  function startAmbientAudio() {
    if (!C.ambientAudio.enabled) return;

    if (audioStarted) {
      if (audioCtx?.state === "suspended") {
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
      masterGain.gain.value = 0;

      masterGain.connect(audioCtx.destination);

      const buffer = audioCtx.createBuffer(
        1,
        audioCtx.sampleRate * 2,
        audioCtx.sampleRate
      );

      const data = buffer.getChannelData(0);

      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
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
      noiseGain.gain.value = 0.9;

      noise.connect(lowpass);
      lowpass.connect(highpass);
      highpass.connect(noiseGain);
      noiseGain.connect(masterGain);

      const humGain = audioCtx.createGain();
      humGain.gain.value = 0.08;

      const osc1 = audioCtx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 52;

      const osc2 = audioCtx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 81;

      osc1.connect(humGain);
      osc2.connect(humGain);
      humGain.connect(masterGain);

      noise.start();
      osc1.start();
      osc2.start();

      audioStarted = true;

      audioCtx.resume().catch(() => {});

      masterGain.gain.setTargetAtTime(
        scene.ambientVolume,
        audioCtx.currentTime,
        0.4
      );

    } catch (error) {
      console.warn("Ambient audio error:", error);
    }
  }

  function updateAmbientVolume() {
    if (!masterGain || !audioCtx) return;

    masterGain.gain.setTargetAtTime(
      scene.ambientVolume,
      audioCtx.currentTime,
      0.08
    );
  }

  function maybeStartAudio() {
    if (C.ambientAudio.startOnFirstGesture) {
      startAmbientAudio();
    }
  }

  // =====================================
  // 9. SETTINGS
  // =====================================

  const keys = [
    "starsAmount",
    "starsBrightness",
    "starsColorVariance",
    "starsTwinkle",
    "shootingFrequency",
    "nebulaColorVariance",
    "nebulaBrightness",
    "nebulaSize",
    "nebulaFrequency",
    "ambientVolume"
  ];

  function bindSettings() {
    const panel =
      document.getElementById("settingsPanel");

    const settingsBtn =
      document.getElementById("settingsBtn");

    const closeBtn =
      document.getElementById("closeSettingsBtn");

    const homeBtn =
      document.getElementById("homeBtn");

    for (const key of keys) {
      const input = document.getElementById(key);
      const output = document.getElementById(
        key + "Value"
      );

      if (!input) continue;

      input.value = scene[key];

      if (output) {
        output.textContent = Number(
          scene[key]
        ).toFixed(key === "ambientVolume" ? 3 : 2);
      }

      input.addEventListener("input", () => {
        scene[key] = Number(input.value);

        if (output) {
          output.textContent = scene[key].toFixed(
            key === "ambientVolume" ? 3 : 2
          );
        }

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
          shootingStar = null;
        }
      });
    }

    settingsBtn?.addEventListener("click", () => {
      panel?.classList.remove("hidden");
      maybeStartAudio();
    });

    closeBtn?.addEventListener("click", () => {
      panel?.classList.add("hidden");
    });

    homeBtn?.addEventListener("click", () => {
      resetToStart();
      maybeStartAudio();
    });
  }

  // =====================================
  // 10. TOUCH CONTROLS
  // =====================================

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function pinchMetrics() {
    const values = [...pointers.values()];

    if (values.length !== 2) return null;

    const a = values[0];
    const b = values[1];

    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      distance: Math.max(
        1,
        Math.hypot(
          b.x - a.x,
          b.y - a.y
        )
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
      ? pinchMetrics()
      : null;
  });

  canvas.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;

    event.preventDefault();

    const previous = pointers.get(event.pointerId);
    const current = pointerPosition(event);

    if (pointers.size === 1) {
      camera.x -=
        (current.x - previous.x) / camera.zoom;

      camera.y -=
        (current.y - previous.y) / camera.zoom;

      pointers.set(event.pointerId, current);
      return;
    }

    if (pointers.size === 2) {
      const before = pinchState || pinchMetrics();

      pointers.set(event.pointerId, current);

      const after = pinchMetrics();

      if (!before || !after) return;

      const worldX =
        camera.x +
        (before.x - W / 2) / camera.zoom;

      const worldY =
        camera.y +
        (before.y - H / 2) / camera.zoom;

      const zoom = clamp(
        camera.zoom *
          after.distance / before.distance,
        C.camera.minZoom,
        C.camera.maxZoom
      );

      camera.zoom = zoom;

      camera.x =
        worldX - (after.x - W / 2) / zoom;

      camera.y =
        worldY - (after.y - H / 2) / zoom;

      pinchState = after;
      return;
    }

    pointers.set(event.pointerId, current);
  });

  function releasePointer(event) {
    pointers.delete(event.pointerId);

    try {
      if (
        canvas.hasPointerCapture(event.pointerId)
      ) {
        canvas.releasePointerCapture(
          event.pointerId
        );
      }
    } catch (_) {}

    pinchState = pointers.size === 2
      ? pinchMetrics()
      : null;
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

  // Mouse wheel = pan only.
  // Two-finger touch = pinch zoom.

  canvas.addEventListener(
    "wheel",
    event => {
      event.preventDefault();

      if (event.ctrlKey || event.metaKey) return;

      maybeStartAudio();

      const multiplier =
        event.deltaMode === 1 ? 16 :
        event.deltaMode === 2 ? H : 1;

      camera.x +=
        event.deltaX * multiplier / camera.zoom;

      camera.y +=
        event.deltaY * multiplier / camera.zoom;
    },
    { passive: false }
  );

  // =====================================
  // 11. STARTING POSITION
  // =====================================

  function resetToStart() {
    camera.x = startPoint.x;
    camera.y = startPoint.y;
    camera.zoom = startPoint.zoom;
  }

  // =====================================
  // 12. RENDERING
  // =====================================

  function render(time) {
    requestAnimationFrame(render);

    const interval =
      1000 / C.rendering.targetFPS;

    if (time - lastFrame < interval) return;

    const delta = previousTime
      ? Math.min(60, time - previousTime)
      : 16;

    previousTime = time;
    lastFrame = time;

    if (!reducedMotion) {
      sceneTime += delta;
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    drawBackground();

    // All background objects are drawn first.
    drawStarLayer(0, sceneTime);
    drawNebulae(sceneTime);
    drawStarLayer(1, sceneTime);
    drawStarLayer(2, sceneTime);

    // Distant shooting stars remain behind the moon.
    drawShootingStars(time);

    // Finally, the completely opaque moon.
    // It blocks everything behind its silhouette.
    drawMoon(sceneTime);
  }

  // =====================================
  // 13. INITIALIZATION
  // =====================================

  window.addEventListener("resize", resize);

  document.addEventListener(
    "visibilitychange",
    () => {
      previousTime = 0;
      lastFrame = 0;
    }
  );

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
