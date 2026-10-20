
"use strict";

(() => {
  const C = window.SPACE_CONFIG;
  const canvas = document.getElementById("spaceCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  if (!C || !ctx) return;

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

  let sceneTime = 0;
  let previousTime = 0;
  let lastFrame = 0;
  let pinchState = null;

  let shootingStar = null;
  let nextShootingStar = 0;

  let audioCtx = null;
  let masterGain = null;

  const moonImage = new Image();
  let moonTexture = null;

  // ==========================================
  // MOON APPEARANCE
  // ==========================================

  const MOON_STYLE = {

    // Completely opaque night hemisphere.
    // Dark enough to blend with space,
    // but never transparent.
    shadowColor: [2, 5, 12],

    // Illuminated surface brightness.
    // 0.60 = approximately 40% darker.
    lightBrightness: 0.60,

    // Cooler gray-blue tones.
    lightTint: [0.85, 0.94, 1.08],

    // Very thin, restrained edge light.
    rimOpacity: 0.035,

    // Extremely subtle atmospheric softening.
    hazeOpacity: 0.012,

    // Original moon photograph geometry.
    // Coordinates relative to IMG_8758.jpeg.
    imageCenterX: 0.515,
    imageCenterY: 0.402,
    imageRadius: 0.285,

    // Feather the physical outer edge,
    // not the entire dark hemisphere.
    edgeFeather: 0.012
  };

  // ==========================================
  // UI
  // ==========================================

  const settingsPanel =
    document.getElementById("settingsPanel");

  const settingsBtn =
    document.getElementById("settingsBtn");

  const closeSettingsBtn =
    document.getElementById("closeSettingsBtn");

  const homeBtn =
    document.getElementById("homeBtn");

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

  // ==========================================
  // RANDOM GENERATION
  // ==========================================

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
      t += 0x6d2b79f5;

      let s = t;

      s = Math.imul(s ^ (s >>> 15), s | 1);

      s ^= s +
        Math.imul(s ^ (s >>> 7), s | 61);

      return ((s ^ (s >>> 14)) >>> 0) /
        4294967296;
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

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
  }

  function smoothstep(t) {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  }

  // ==========================================
  // CANVAS AND CAMERA
  // ==========================================

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;

    DPR = Math.min(
      devicePixelRatio || 1,
      C.rendering.maxPixelRatio
    );

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);

    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;

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
    cellSize,
    parallax = 1,
    scale = camera.zoom
  ) {
    const hw = W / (2 * scale);
    const hh = H / (2 * scale);

    const cx = camera.x * parallax;
    const cy = camera.y * parallax;

    const minX = Math.floor((cx - hw) / cellSize) - 1;
    const maxX = Math.ceil((cx + hw) / cellSize) + 1;

    const minY = Math.floor((cy - hh) / cellSize) - 1;
    const maxY = Math.ceil((cy + hh) / cellSize) + 1;

    const result = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        result.push({ x, y });
      }
    }

    return result;
  }

  // ==========================================
  // BACKGROUND
  // ==========================================

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

  // ==========================================
  // NEBULAE
  // ==========================================

  function buildNebulaSprite(cellX, cellY) {
    const key = [
      cellX,
      cellY,
      scene.nebulaColorVariance.toFixed(2),
      scene.nebulaBrightness.toFixed(2)
    ].join(":");

    if (nebulaCache.has(key)) {
      const saved = nebulaCache.get(key);
      nebulaCache.delete(key);
      nebulaCache.set(key, saved);
      return saved;
    }

    const rnd = rngFor(cellX, cellY, 9137);

    if (
      rnd() >
      C.nebulae.density * scene.nebulaFrequency
    ) {
      return null;
    }

    const size = 1024;
    const off = document.createElement("canvas");

    off.width = size;
    off.height = size;

    const g = off.getContext("2d");

    const palette = C.nebulae.palette;

    const baseA = choose(palette, rnd);
    const baseB = choose(palette, rnd);
    const baseC = choose(palette, rnd);

    const boost =
      0.9 + scene.nebulaColorVariance * 0.55;

    function boosted(rgb) {
      return rgb.map(n =>
        clamp(Math.round(n * boost), 0, 255)
      );
    }

    function cloud(x, y, rx, ry, color, alpha) {
      const r = Math.max(rx, ry);

      g.save();
      g.translate(x, y);
      g.scale(rx / r, ry / r);

      const grad = g.createRadialGradient(
        0, 0, 0, 0, 0, r
      );

      grad.addColorStop(0, rgba(color, alpha));
      grad.addColorStop(
        0.18,
        rgba(color, alpha * 0.82)
      );
      grad.addColorStop(
        0.5,
        rgba(color, alpha * 0.24)
      );
      grad.addColorStop(1, rgba(color, 0));

      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();

      g.restore();
    }

    g.globalCompositeOperation = "screen";

    const angle = rnd() * TAU;
    const centerX = 420 + rnd() * 180;
    const centerY = 390 + rnd() * 220;
    const length = 250 + rnd() * 250;

    const strands = 5 + Math.floor(rnd() * 4);

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

      cloud(
        x,
        y,
        110 + rnd() * 190,
        38 + rnd() * 120,
        boosted(choose([baseA, baseB, baseC], rnd)),
        (0.012 + rnd() * 0.026) *
          scene.nebulaBrightness
      );
    }

    for (let s = 0; s < strands; s++) {
      const strandAngle =
        angle + (rnd() - 0.5) * 1.1;

      const amplitude = 35 + rnd() * 90;
      const thickness = 18 + rnd() * 58;

      const color = boosted(
        choose([baseA, baseB, baseC], rnd)
      );

      const phase = rnd() * TAU;
      const frequency = 1.2 + rnd() * 2.5;

      for (let i = 0; i < 64; i++) {
        const t = i / 63;

        const along = (t - 0.5) * length * 2;

        const wave =
          Math.sin(t * TAU * frequency + phase) *
          amplitude;

        const x =
          centerX +
          Math.cos(strandAngle) * along -
          Math.sin(strandAngle) * wave;

        const y =
          centerY +
          Math.sin(strandAngle) * along +
          Math.cos(strandAngle) * wave;

        const taper =
          Math.pow(Math.sin(Math.PI * t), 0.74);

        cloud(
          x + (rnd() - 0.5) * 12,
          y + (rnd() - 0.5) * 12,
          thickness * (0.68 + rnd() * 0.62) *
            taper + 8,
          thickness * (0.28 + rnd() * 0.42) *
            taper + 7,
          color,
          (0.017 + rnd() * 0.044) *
            taper *
            scene.nebulaBrightness
        );
      }
    }

    for (let i = 0; i < 28; i++) {
      cloud(
        centerX + (rnd() - 0.5) * length * 1.7,
        centerY + (rnd() - 0.5) * length * 1.35,
        16 + rnd() * 60,
        12 + rnd() * 50,
        boosted(choose(palette, rnd)),
        (0.02 + rnd() * 0.05) *
          scene.nebulaBrightness
      );
    }

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
      nebulaCache.size >
      C.rendering.nebulaCacheSize
    ) {
      nebulaCache.delete(
        nebulaCache.keys().next().value
      );
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

      const wx =
        cell.x * C.nebulae.cellSize +
        (rnd() - 0.5) * 620;

      const wy =
        cell.y * C.nebulae.cellSize +
        (rnd() - 0.5) * 620;

      const pos = project(
        wx,
        wy,
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

  // ==========================================
  // STARS
  // ==========================================

  function variedStarColor(hex, variance, rnd) {
    const rgb = hexToRgb(hex);
    const drift = variance * 45;

    return `rgb(${
      rgb.map(v =>
        clamp(
          Math.round(v + (rnd() - 0.5) * drift),
          0,
          255
        )
      ).join(",")
    })`;
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
      x < -30 || x > W + 30 ||
      y < -30 || y > H + 30
    ) return;

    ctx.save();

    if (glow > 0) {
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
        `rgba(165,205,255,${alpha * glow})`
      );

      halo.addColorStop(
        1,
        "rgba(70,110,170,0)"
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
          : 1 +
            Math.sin(
              time *
              C.stars.twinkleSpeed *
              scene.starsTwinkle *
              (0.75 + rnd() * 1.25) +
              phase
            ) *
            (0.13 * scene.starsTwinkle);

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
            radius *
            Math.sqrt(scale) *
            conf.radiusScale,
            0.2,
            4.3
          ),
          variedStarColor(
            choose(C.stars.colors, rnd),
            scene.starsColorVariance,
            rnd
          ),
          brightness,
          glow
        );
      }
    }
  }

  // ==========================================
  // MOON IMAGE PREPARATION
  // ==========================================

  function prepareMoonTexture() {
    const width = moonImage.naturalWidth;
    const height = moonImage.naturalHeight;

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;

    const g = off.getContext("2d", {
      willReadFrequently: true
    });

    g.drawImage(moonImage, 0, 0);

    const pixels = g.getImageData(
      0, 0, width, height
    );

    const data = pixels.data;

    // Remove the original photograph's black
    // background from the crescent texture.
    //
    // The shadowed hemisphere is NOT provided
    // by this image: it is drawn as an opaque
    // disc independently.

    const clipBelow = 8;
    const featherTo = 26;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const green = data[i + 1];
      const b = data[i + 2];

      const lum =
        0.2126 * r +
        0.7152 * green +
        0.0722 * b;

      const alpha = smoothstep(
        (lum - clipBelow) /
        (featherTo - clipBelow)
      );

      // Approximately 40% less brightness,
      // with cooler blue-gray coloration.
      data[i] = Math.round(
        r *
        MOON_STYLE.lightBrightness *
        MOON_STYLE.lightTint[0]
      );

      data[i + 1] = Math.round(
        green *
        MOON_STYLE.lightBrightness *
        MOON_STYLE.lightTint[1]
      );

      data[i + 2] = Math.round(
        b *
        MOON_STYLE.lightBrightness *
        MOON_STYLE.lightTint[2]
      );

      data[i + 3] = Math.round(
        data[i + 3] * alpha
      );
    }

    g.putImageData(pixels, 0, 0);

    moonTexture = off;
  }

  function loadMoon() {
    moonImage.onload = () => {
      try {
        prepareMoonTexture();
      } catch (error) {
        console.error(
          "Moon texture processing failed:",
          error
        );
      }
    };

    moonImage.onerror = () => {
      console.warn(
        "Could not load IMG_8758.jpeg."
      );
    };

    moonImage.src = C.moon.imagePath;
  }

  // ==========================================
  // REALISTIC OPAQUE MOON
  // ==========================================

  function drawMoon(time) {
    if (!moonTexture) return;

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

    const width = m.width * scale;
    const height = m.height * scale;

    // Position of the actual lunar disc within
    // the source photograph.
    const moonX =
      pos.x +
      (MOON_STYLE.imageCenterX - 0.5) * width;

    const moonY =
      pos.y +
      (MOON_STYLE.imageCenterY - 0.5) * height;

    const radius =
      MOON_STYLE.imageRadius *
      Math.min(width, height);

    if (
      moonX + radius < -100 ||
      moonX - radius > W + 100 ||
      moonY + radius < -100 ||
      moonY - radius > H + 100
    ) return;

    ctx.save();

    // --------------------------------------
    // 1. Solid, opaque moon hemisphere
    // --------------------------------------

    // This disc hides all background stars,
    // nebulae and colors behind the moon.
    //
    // No transparency in the main body.

    const shadow = ctx.createRadialGradient(
      moonX - radius * 0.22,
      moonY - radius * 0.18,
      radius * 0.08,
      moonX,
      moonY,
      radius
    );

    const dark = MOON_STYLE.shadowColor;

    shadow.addColorStop(
      0,
      `rgb(${dark[0] + 2},${dark[1] + 3},${dark[2] + 4})`
    );

    shadow.addColorStop(
      0.72,
      `rgb(${dark[0]},${dark[1]},${dark[2]})`
    );

    shadow.addColorStop(
      1,
      `rgb(${dark[0]},${dark[1]},${dark[2]})`
    );

    circle(moonX, moonY, radius);

    ctx.fillStyle = shadow;
    ctx.fill();

    // --------------------------------------
    // 2. Original photographic crescent
    // --------------------------------------

    // Keep the crescent INSIDE the disc.
    // No image rectangle can show outside it.

    ctx.save();

    circle(moonX, moonY, radius);
    ctx.clip();

    ctx.globalAlpha = 1;

    ctx.drawImage(
      moonTexture,
      pos.x - width / 2,
      pos.y - height / 2,
      width,
      height
    );

    ctx.restore();

    // --------------------------------------
    // 3. Soft outer silhouette
    // --------------------------------------

    // A very narrow anti-aliasing treatment,
    // not a large fog circle.

    const feather =
      Math.max(
        0.8,
        radius * MOON_STYLE.edgeFeather
      );

    ctx.save();

    ctx.lineWidth = feather * 1.2;

    ctx.strokeStyle =
      `rgba(3,7,15,${0.4})`;

    circle(
      moonX,
      moonY,
      radius - feather * 0.35
    );

    ctx.stroke();

    ctx.restore();

    // --------------------------------------
    // 4. Very faint lunar rim
    // --------------------------------------

    // Only a little light along the
    // illuminated right edge.

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      moonX,
      moonY,
      radius - 0.5,
      -Math.PI * 0.43,
      Math.PI * 0.47
    );

    ctx.strokeStyle =
      `rgba(142,170,196,${MOON_STYLE.rimOpacity})`;

    ctx.lineWidth = Math.max(
      0.6,
      radius * 0.003
    );

    ctx.stroke();

    ctx.restore();

    // --------------------------------------
    // 5. Extremely restrained atmosphere
    // --------------------------------------

    // Only around the illuminated edge.
    // No full-circle blue fog or black halo.

    if (MOON_STYLE.hazeOpacity > 0) {
      ctx.save();

      const haze = ctx.createRadialGradient(
        moonX + radius * 0.62,
        moonY,
        radius * 0.14,
        moonX + radius * 0.62,
        moonY,
        radius * 0.62
      );

      haze.addColorStop(
        0,
        `rgba(65,100,145,${MOON_STYLE.hazeOpacity})`
      );

      haze.addColorStop(
        1,
        "rgba(65,100,145,0)"
      );

      // Limit the haze to a narrow area
      // around the light-facing side.
      ctx.beginPath();
      ctx.rect(
        moonX + radius * 0.82,
        moonY - radius * 1.2,
        radius * 0.45,
        radius * 2.4
      );

      ctx.clip();

      ctx.fillStyle = haze;

      circle(
        moonX + radius * 0.62,
        moonY,
        radius * 0.62
      );

      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  // ==========================================
  // SHOOTING STARS
  // ==========================================

  function scheduleShootingStar(time) {
    const frequency = scene.shootingFrequency;

    if (frequency <= 0) {
      nextShootingStar = Infinity;
      return;
    }

    const speed = clamp(frequency, 0.1, 2);

    nextShootingStar =
      time +
      lerp(
        C.shootingStars.minDelay,
        C.shootingStars.maxDelay,
        Math.random()
      ) / speed;
  }

  function drawShootingStars(time) {
    if (
      reducedMotion ||
      !C.shootingStars.enabled ||
      scene.shootingFrequency <= 0
    ) return;

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
        y: Math.random() * H * 0.55,
        angle: Math.PI *
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

    const p = smoothstep(t);
    const alpha = Math.sin(t * Math.PI) * 0.35;

    const hx =
      s.x + Math.cos(s.angle) * s.distance * p;

    const hy =
      s.y + Math.sin(s.angle) * s.distance * p;

    const length = 55 + 75 * (1 - t);

    const tx =
      hx - Math.cos(s.angle) * length;

    const ty =
      hy - Math.sin(s.angle) * length;

    ctx.save();

    const grad = ctx.createLinearGradient(
      tx, ty, hx, hy
    );

    grad.addColorStop(
      0,
      "rgba(70,110,180,0)"
    );

    grad.addColorStop(
      0.7,
      `rgba(135,180,255,${alpha * 0.28})`
    );

    grad.addColorStop(
      1,
      `rgba(245,250,255,${alpha})`
    );

    ctx.strokeStyle = grad;
    ctx.lineWidth = 0.9;

    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    ctx.restore();
  }

  // ==========================================
  // AMBIENT WHITE NOISE
  // ==========================================

  async function startAmbientAudio() {
    if (!C.ambientAudio.enabled) return;

    try {
      if (audioCtx) {
        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }
        return;
      }

      const AC =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AC) return;

      audioCtx = new AC();

      masterGain = audioCtx.createGain();
      masterGain.gain.value = scene.ambientVolume;
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

      noise.connect(lowpass);
      lowpass.connect(highpass);
      highpass.connect(masterGain);

      noise.start();

      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
    } catch (error) {
      console.warn(
        "Ambient audio unavailable:",
        error
      );
    }
  }

  function maybeStartAudio() {
    if (C.ambientAudio.startOnFirstGesture) {
      startAmbientAudio();
    }
  }

  // ==========================================
  // SETTINGS
  // ==========================================

  function bindSettings() {
    for (const key of keys) {
      const input = document.getElementById(key);
      const output =
        document.getElementById(key + "Value");

      if (!input || !output) continue;

      input.value = scene[key];

      function refresh() {
        output.textContent =
          Number(scene[key]).toFixed(
            key === "ambientVolume" ? 3 : 2
          );
      }

      refresh();

      input.addEventListener("input", () => {
        scene[key] = Number(input.value);
        refresh();

        if (key === "ambientVolume") {
          maybeStartAudio();

          if (masterGain) {
            masterGain.gain.setTargetAtTime(
              scene.ambientVolume,
              audioCtx.currentTime,
              0.05
            );
          }
        }

        if (
          key === "nebulaBrightness" ||
          key === "nebulaColorVariance" ||
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
      settingsPanel?.classList.remove("hidden");
    });

    closeSettingsBtn?.addEventListener(
      "click",
      () => {
        settingsPanel?.classList.add("hidden");
      }
    );

    homeBtn?.addEventListener("click", () => {
      resetToStart();
    });
  }

  function resetToStart() {
    camera.x = startPoint.x;
    camera.y = startPoint.y;
    camera.zoom = startPoint.zoom;
  }

  // ==========================================
  // TOUCH NAVIGATION
  // ==========================================

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

    const [a, b] = values;

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

  canvas.addEventListener(
    "pointerdown",
    event => {
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
        canvas.setPointerCapture(
          event.pointerId
        );
      } catch (_) {}

      pinchState =
        pointers.size === 2
          ? pinchMetrics()
          : null;
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

      const current = pointerPosition(event);

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

        if (!before || !after) return;

        const worldX =
          camera.x +
          (before.x - W / 2) / camera.zoom;

        const worldY =
          camera.y +
          (before.y - H / 2) / camera.zoom;

        camera.zoom = clamp(
          camera.zoom *
          after.distance /
          before.distance,
          C.camera.minZoom,
          C.camera.maxZoom
        );

        camera.x =
          worldX -
          (after.x - W / 2) / camera.zoom;

        camera.y =
          worldY -
          (after.y - H / 2) / camera.zoom;

        pinchState = after;
      }
    }
  );

  function releasePointer(event) {
    pointers.delete(event.pointerId);

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

    pinchState =
      pointers.size === 2
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

  // Wheel pans; it does not zoom.
  canvas.addEventListener(
    "wheel",
    event => {
      event.preventDefault();

      if (event.ctrlKey || event.metaKey) {
        return;
      }

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
    },
    { passive: false }
  );

  // ==========================================
  // MAIN RENDERING LOOP
  // ==========================================

  function render(time) {
    const interval =
      1000 / C.rendering.targetFPS;

    if (time - lastFrame < interval) {
      requestAnimationFrame(render);
      return;
    }

    const delta = previousTime
      ? Math.min(60, time - previousTime)
      : 16;

    previousTime = time;
    lastFrame = time;

    if (!reducedMotion) {
      sceneTime += delta;
    }

    ctx.setTransform(
      DPR, 0, 0, DPR, 0, 0
    );

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    drawBackground();

    // Stars and clouds belong behind the moon.
    drawStarLayer(0, sceneTime);
    drawNebulae(sceneTime);
    drawStarLayer(1, sceneTime);
    drawStarLayer(2, sceneTime);

    // Distant shooting stars also appear
    // behind the moon.
    drawShootingStars(time);

    // Draw the opaque moon LAST.
    // Nothing behind it can shine through.
    drawMoon(sceneTime);

    requestAnimationFrame(render);
  }

  // ==========================================
  // INITIALIZATION
  // ==========================================

  window.addEventListener("resize", resize);

  document.addEventListener(
    "visibilitychange",
    () => {
      previousTime = 0;

      if (
        document.hidden &&
        audioCtx &&
        audioCtx.state === "running"
      ) {
        audioCtx.suspend();
      }
    }
  );

  resize();
  bindSettings();
  resetToStart();
  loadMoon();

  requestAnimationFrame(render);

  window.SpaceUniverse = {
    camera,
    scene,
    resetToStart,
    startAmbientAudio
  };

})();
