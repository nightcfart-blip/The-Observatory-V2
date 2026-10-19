
"use strict";

(() => {
  const C = window.SPACE_CONFIG;
  const canvas = document.getElementById("spaceCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  if (!ctx || !C) return;

  const TAU = Math.PI * 2;
  const camera = { ...C.camera };
  const pointers = new Map();
  const nebulaCache = new Map();

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let W = 0;
  let H = 0;
  let DPR = 1;
  let pinch = null;
  let previousTime = 0;
  let lastFrame = 0;
  let spaceTime = 0;
  let shootingStar = null;
  let nextShootingStar = 0;

  // ---------------------------------------
  // MATHEMATICAL UTILITIES
  // ---------------------------------------

  const clamp = (v, min, max) =>
    Math.max(min, Math.min(max, v));

  const lerp = (a, b, t) => a + (b - a) * t;

  const smoothstep = t => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  function hash(a, b, salt = 0) {
    let n =
      Math.imul(a, 374761393) ^
      Math.imul(b, 668265263) ^
      Math.imul(salt + C.seed, 1442695041);

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
    return randomGenerator(
      Math.floor(hash(x, y, salt) * 4294967295)
    );
  }

  function choose(array, random) {
    return array[Math.floor(random() * array.length)];
  }

  function rgba(rgb, alpha) {
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  }

  // ---------------------------------------
  // VIEWPORT
  // ---------------------------------------

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

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function project(x, y, parallax = 1, scale = camera.zoom) {
    return {
      x: W / 2 + (x - camera.x * parallax) * scale,
      y: H / 2 + (y - camera.y * parallax) * scale
    };
  }

  function visibleCells(size, parallax = 1, scale = camera.zoom) {
    const halfW = W / (2 * scale);
    const halfH = H / (2 * scale);

    const cx = camera.x * parallax;
    const cy = camera.y * parallax;

    const cells = [];

    const minX = Math.floor((cx - halfW) / size) - 1;
    const maxX = Math.ceil((cx + halfW) / size) + 1;
    const minY = Math.floor((cy - halfH) / size) - 1;
    const maxY = Math.ceil((cy + halfH) / size) + 1;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        cells.push({ x, y });
      }
    }

    return cells;
  }

  function circle(x, y, radius) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
  }

  // ---------------------------------------
  // DEEP SPACE BACKGROUND
  // ---------------------------------------

  function drawBackground() {
    const bg = ctx.createLinearGradient(0, 0, W, H);

    bg.addColorStop(0, C.atmosphere.backgroundTop);
    bg.addColorStop(0.52, C.atmosphere.backgroundMiddle);
    bg.addColorStop(1, C.atmosphere.backgroundBottom);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(
      W * 0.48, H * 0.46, 0,
      W * 0.48, H * 0.46, Math.max(W, H) * 0.8
    );

    glow.addColorStop(0, "rgba(15,43,91,0.15)");
    glow.addColorStop(0.6, "rgba(5,17,43,0.035)");
    glow.addColorStop(1, "rgba(0,0,0,0.16)");

    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------------------------------------
  // PROCEDURAL NEBULAE
  // ---------------------------------------

  function makeNebula(cx, cy) {
    const key = cx + ":" + cy;

    if (nebulaCache.has(key)) {
      const saved = nebulaCache.get(key);
      nebulaCache.delete(key);
      nebulaCache.set(key, saved);
      return saved;
    }

    const rnd = rngFor(cx, cy, 12577);

    if (rnd() > C.nebulae.density) {
      return null;
    }

    const size = 700;
    const surface = document.createElement("canvas");
    surface.width = surface.height = size;

    const g = surface.getContext("2d");
    const palette = C.nebulae.colors;

    const base = choose(palette, rnd);
    const second = choose(palette, rnd);

    const angle = rnd() * TAU;
    const bend = rnd() * 1.7 - 0.85;
    const length = 260 + rnd() * 220;
    const width = 48 + rnd() * 115;
    const centerX = 350 + (rnd() - 0.5) * 150;
    const centerY = 350 + (rnd() - 0.5) * 150;

    function cloud(x, y, radiusX, radiusY, color, alpha) {
      const radius = Math.max(radiusX, radiusY);

      g.save();
      g.translate(x, y);
      g.scale(radiusX / radius, radiusY / radius);

      const gradient = g.createRadialGradient(
        0, 0, 0, 0, 0, radius
      );

      gradient.addColorStop(0, rgba(color, alpha));
      gradient.addColorStop(0.22, rgba(color, alpha * 0.68));
      gradient.addColorStop(0.55, rgba(color, alpha * 0.21));
      gradient.addColorStop(1, rgba(color, 0));

      g.fillStyle = gradient;
      g.beginPath();
      g.arc(0, 0, radius, 0, TAU);
      g.fill();
      g.restore();
    }

    // Large, scattered atmospheric regions.
    for (let i = 0; i < 30; i++) {
      const t = rnd() * 2 - 1;

      const x =
        centerX + Math.cos(angle) * t * length +
        (rnd() - 0.5) * 190;

      const y =
        centerY + Math.sin(angle) * t * length +
        Math.sin(t * Math.PI) * bend * 130 +
        (rnd() - 0.5) * 190;

      cloud(
        x, y,
        100 + rnd() * 150,
        45 + rnd() * 105,
        rnd() < 0.7 ? base : second,
        0.016 + rnd() * 0.035
      );
    }

    // Irregular, overlapping strands of luminous gas.
    const strands = 2 + Math.floor(rnd() * 4);

    for (let strand = 0; strand < strands; strand++) {
      const offset = (rnd() - 0.5) * width * 2;
      const frequency = 1.3 + rnd() * 3.4;
      const phase = rnd() * TAU;
      const thickness = 25 + rnd() * 65;
      const chosen = choose([base, second, ...palette], rnd);

      for (let i = 0; i < 56; i++) {
        const t = i / 55;
        const along = (t - 0.5) * 2 * length;

        const wave =
          Math.sin(t * frequency * TAU + phase) *
          (20 + rnd() * 35);

        const across = offset + wave;

        const x =
          centerX +
          Math.cos(angle) * along -
          Math.sin(angle) * across;

        const y =
          centerY +
          Math.sin(angle) * along +
          Math.cos(angle) * across +
          Math.sin(t * Math.PI) * bend * 110;

        const taper = Math.pow(Math.sin(t * Math.PI), 0.65);

        cloud(
          x + (rnd() - 0.5) * 16,
          y + (rnd() - 0.5) * 16,
          thickness * (0.7 + rnd()) * taper + 8,
          thickness * (0.4 + rnd()) * taper + 8,
          chosen,
          (0.018 + rnd() * 0.046) * taper
        );
      }
    }

    // Small knots of brighter gas.
    for (let i = 0; i < 22; i++) {
      const t = rnd() * 2 - 1;
      const x = centerX + Math.cos(angle) * t * length;
      const y = centerY + Math.sin(angle) * t * length;

      cloud(
        x + (rnd() - 0.5) * width * 3,
        y + (rnd() - 0.5) * width * 3,
        15 + rnd() * 45,
        12 + rnd() * 42,
        rnd() < 0.5 ? [70, 165, 235] : second,
        0.02 + rnd() * 0.065
      );
    }

    nebulaCache.set(key, surface);

    while (nebulaCache.size > C.rendering.nebulaCacheSize) {
      const oldest = nebulaCache.keys().next().value;
      nebulaCache.delete(oldest);
    }

    return surface;
  }

  function drawNebulae(time) {
    const size = C.nebulae.cellSize;
    const parallax = 0.43;
    const scale = camera.zoom * 0.79;

    const drift = reducedMotion || !C.motion.nebulae
      ? 0
      : Math.sin(time * C.atmosphere.nebulaDrift) * 13;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = C.atmosphere.nebulaOpacity;

    for (const cell of visibleCells(size, parallax, scale)) {
      const sprite = makeNebula(cell.x, cell.y);
      if (!sprite) continue;

      const random = rngFor(cell.x, cell.y, 456);

      const pos = project(
        cell.x * size + (random() - 0.5) * size * 0.65,
        cell.y * size + (random() - 0.5) * size * 0.65,
        parallax,
        scale
      );

      const diameter = size * (0.95 + random() * 0.65) * scale;

      ctx.save();
      ctx.translate(pos.x + drift, pos.y - drift * 0.3);
      ctx.rotate(random() * TAU);
      ctx.drawImage(
        sprite,
        -diameter / 2,
        -diameter / 2,
        diameter,
        diameter
      );
      ctx.restore();
    }

    ctx.restore();
  }

  // ---------------------------------------
  // UNIQUE STAR FIELDS
  // ---------------------------------------

  function drawStar(x, y, radius, color, brightness, glow) {
    if (x < -20 || x > W + 20 ||
        y < -20 || y > H + 20) return;

    ctx.globalAlpha = brightness;

    if (glow) {
      const halo = ctx.createRadialGradient(
        x, y, 0, x, y, radius * 7
      );

      halo.addColorStop(0, "rgba(210,233,255,0.42)");
      halo.addColorStop(0.22, "rgba(115,166,255,0.12)");
      halo.addColorStop(1, "rgba(70,120,255,0)");

      ctx.fillStyle = halo;
      circle(x, y, radius * 7);
      ctx.fill();
    }

    ctx.fillStyle = color;
    circle(x, y, Math.max(0.25, radius));
    ctx.fill();

    if (glow && radius > 1.4) {
      ctx.strokeStyle = "rgba(190,220,255,0.18)";
      ctx.lineWidth = 0.6;

      ctx.beginPath();
      ctx.moveTo(x - radius * 6, y);
      ctx.lineTo(x + radius * 6, y);
      ctx.moveTo(x, y - radius * 5);
      ctx.lineTo(x, y + radius * 5);
      ctx.stroke();
    }
  }

  function drawStarLayer(layer, time) {
    const size = C.stars.cellSize;

    const settings = [
      { count: C.stars.distantCount, depth: 0.24, factor: 0.53 },
      { count: C.stars.middleCount, depth: 0.58, factor: 0.8 },
      { count: C.stars.nearCount, depth: 1, factor: 1 }
    ][layer];

    const scale = camera.zoom * settings.factor;
    const parallax = settings.depth;

    const movement = reducedMotion || !C.motion.stars
      ? 0
      : time * C.stars.driftSpeed;

    ctx.save();

    for (const cell of visibleCells(size, parallax, scale)) {
      const rnd = rngFor(cell.x, cell.y, 600 + layer);

      for (let i = 0; i < settings.count; i++) {
        const wx = cell.x * size + rnd() * size;
        const wy = cell.y * size + rnd() * size;

        const seed = rnd();
        const phase = rnd() * TAU;
        const speed = 0.45 + rnd() * 1.2;

        const radius =
          layer === 0
            ? 0.25 + Math.pow(seed, 4) * 0.8
            : layer === 1
              ? 0.35 + Math.pow(seed, 5) * 1.6
              : 0.45 + Math.pow(seed, 6) * 2.3;

        const glow = seed > 0.94 && layer > 0;

        const brightnessBase =
          0.22 + Math.pow(rnd(), 0.55) * 0.7;

        const twinkle =
          reducedMotion
            ? 1
            : 0.82 + 0.18 *
              Math.sin(
                time * C.stars.twinkleSpeed * speed +
                phase
              );

        const pos = project(
          wx + Math.sin(phase + movement * 0.05) * layer,
          wy + Math.cos(phase + movement * 0.05) * layer,
          parallax,
          scale
        );

        drawStar(
          pos.x,
          pos.y,
          clamp(radius * Math.sqrt(scale), 0.25, 4),
          choose(C.stars.colors, rnd),
          brightnessBase * twinkle,
          glow
        );
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------------------------------------
  // PLANETS
  // ---------------------------------------

  function planetAt(x, y, radius, palette, seed, time) {
    const pos = project(x, y);

    const r = radius * camera.zoom;

    if (r < 3 || pos.x + r < -50 ||
        pos.x - r > W + 50 ||
        pos.y + r < -50 ||
        pos.y - r > H + 50) return;

    ctx.save();

    // Distant atmospheric halo.
    const halo = ctx.createRadialGradient(
      pos.x, pos.y, r * 0.6,
      pos.x, pos.y, r * 1.45
    );

    halo.addColorStop(0, "rgba(30,132,212,0.025)");
    halo.addColorStop(0.7, "rgba(27,125,222,0.075)");
    halo.addColorStop(1, "rgba(27,110,200,0)");

    ctx.fillStyle = halo;
    circle(pos.x, pos.y, r * 1.45);
    ctx.fill();

    circle(pos.x, pos.y, r);
    ctx.clip();

    // Base color with directional lighting.
    const surface = ctx.createLinearGradient(
      pos.x - r, pos.y - r,
      pos.x + r, pos.y + r
    );

    surface.addColorStop(0, palette[2]);
    surface.addColorStop(0.45, palette[1]);
    surface.addColorStop(1, palette[0]);

    ctx.fillStyle = surface;
    ctx.fillRect(
      pos.x - r, pos.y - r,
      r * 2, r * 2
    );

    // Slowly shifting bands and cloud layers.
    const rnd = randomGenerator(seed);

    const rotation =
      reducedMotion || !C.motion.planets
        ? 0
        : time * 0.0017;

    for (let i = 0; i < 30; i++) {
      const bandY = (rnd() * 2 - 1) * r;
      const bandH = (0.015 + rnd() * 0.18) * r;
      const intensity = 0.015 + rnd() * 0.085;
      const phase = rnd() * TAU;

      ctx.fillStyle = i % 2
        ? `rgba(115,205,255,${intensity})`
        : `rgba(0,8,27,${intensity * 1.65})`;

      const wave = Math.sin(rotation + phase) * r * 0.16;

      ctx.beginPath();
      ctx.ellipse(
        pos.x + wave,
        pos.y + bandY,
        r * (0.7 + rnd() * 0.45),
        Math.max(1, bandH),
        (rnd() - 0.5) * 0.13,
        0,
        TAU
      );

      ctx.fill();
    }

    // Dark crater-like formations.
    for (let i = 0; i < 9; i++) {
      const px = (rnd() * 2 - 1) * r * 0.83;
      const py = (rnd() * 2 - 1) * r * 0.83;
      const craterR = (0.025 + rnd() * 0.11) * r;

      ctx.fillStyle = "rgba(0,9,27,0.12)";
      ctx.beginPath();
      ctx.ellipse(
        pos.x + px,
        pos.y + py,
        craterR,
        craterR * (0.5 + rnd() * 0.4),
        rnd() * TAU,
        0,
        TAU
      );
      ctx.fill();
    }

    // Spherical shading creates the day/night terminator.
    const shadow = ctx.createRadialGradient(
      pos.x - r * 0.38,
      pos.y - r * 0.42,
      r * 0.08,
      pos.x + r * 0.15,
      pos.y + r * 0.05,
      r * 1.25
    );

    shadow.addColorStop(0, "rgba(180,225,255,0.08)");
    shadow.addColorStop(0.45, "rgba(0,0,0,0.06)");
    shadow.addColorStop(0.73, "rgba(0,5,20,0.48)");
    shadow.addColorStop(1, "rgba(0,2,12,0.94)");

    ctx.fillStyle = shadow;
    ctx.fillRect(
      pos.x - r, pos.y - r,
      r * 2, r * 2
    );

    ctx.restore();

    // Thin illuminated outer atmosphere.
    ctx.save();
    circle(pos.x, pos.y, r);

    ctx.lineWidth = Math.max(0.5, r * 0.009);
    ctx.strokeStyle = "rgba(90,181,244,0.28)";
    ctx.stroke();
    ctx.restore();
  }

  function drawPlanets(time) {
    // Deliberately positioned landmark near the starting area.
    planetAt(
      520, -155, 205,
      C.planets.colors[0],
      34671,
      time
    );

    const size = C.planets.cellSize;

    for (const cell of visibleCells(size)) {
      const rnd = rngFor(cell.x, cell.y, 940);

      if (rnd() > C.planets.probability) continue;

      const x = cell.x * size + rnd() * size;
      const y = cell.y * size + rnd() * size;

      // Prevent another planet overlapping the landmark.
      if (Math.hypot(x - 520, y + 155) < 650) continue;

      const radius = lerp(
        C.planets.minRadius,
        C.planets.maxRadius,
        rnd()
      );

      const palette = choose(C.planets.colors, rnd);
      const seed = Math.floor(rnd() * 4294967295);

      planetAt(x, y, radius, palette, seed, time);
    }
  }

  // ---------------------------------------
  // ASTEROIDS
  // ---------------------------------------

  function drawAsteroid(x, y, radius, seed, time) {
    const rnd = randomGenerator(seed);

    const drift = reducedMotion || !C.motion.asteroids
      ? 0
      : time * 0.00012;

    const px = x + Math.sin(drift + seed) * 7;
    const py = y + Math.cos(drift * 0.7 + seed) * 5;

    const pos = project(px, py);
    const r = radius * camera.zoom;

    if (r < 0.7 ||
        pos.x < -r || pos.x > W + r ||
        pos.y < -r || pos.y > H + r) return;

    const count = 7 + Math.floor(rnd() * 6);
    const rotation = rnd() * TAU + drift * 0.12;

    const points = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * TAU + rotation;
      const distance = r * (0.68 + rnd() * 0.43);

      points.push({
        x: pos.x + Math.cos(angle) * distance,
        y: pos.y + Math.sin(angle) * distance
      });
    }

    ctx.save();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.closePath();

    const shading = ctx.createLinearGradient(
      pos.x - r, pos.y - r,
      pos.x + r, pos.y + r
    );

    shading.addColorStop(0, "#49657a");
    shading.addColorStop(0.35, "#253b53");
    shading.addColorStop(1, "#050d1c");

    ctx.fillStyle = shading;
    ctx.fill();

    ctx.strokeStyle = "rgba(112,164,205,0.21)";
    ctx.lineWidth = 0.65;
    ctx.stroke();

    // Individual facets.
    for (let i = 0; i < Math.min(count - 2, 5); i++) {
      const a = points[i];
      const b = points[(i + 1) % count];

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(
        pos.x + (rnd() - 0.5) * r * 0.45,
        pos.y + (rnd() - 0.5) * r * 0.45
      );
      ctx.closePath();

      ctx.fillStyle = i % 2
        ? "rgba(2,10,24,0.21)"
        : "rgba(139,184,213,0.075)";
      ctx.fill();
    }

    ctx.restore();
  }

  function drawAsteroids(time) {
    const size = C.asteroids.cellSize;

    // Starting-area asteroid cluster.
    const cluster = rngFor(9, 8, 404);

    for (let i = 0; i < 52; i++) {
      const angle = cluster() * TAU;
      const distance = 240 + Math.pow(cluster(), 0.7) * 620;

      const x = 520 + Math.cos(angle) * distance;
      const y = -155 + Math.sin(angle) * distance;

      const radius =
        3 + Math.pow(cluster(), 4) * 52;

      drawAsteroid(
        x, y, radius,
        Math.floor(cluster() * 4294967295),
        time
      );
    }

    // Additional asteroid fields generated across the universe.
    for (const cell of visibleCells(size)) {
      const rnd = rngFor(cell.x, cell.y, 771);

      if (rnd() > C.asteroids.density) continue;

      const count =
        1 + Math.floor(rnd() * C.asteroids.maxPerCell);

      for (let i = 0; i < count; i++) {
        const x = cell.x * size + rnd() * size;
        const y = cell.y * size + rnd() * size;

        const radius = lerp(
          C.asteroids.minRadius,
          C.asteroids.maxRadius,
          Math.pow(rnd(), 1.8)
        );

        drawAsteroid(
          x, y, radius,
          Math.floor(rnd() * 4294967295),
          time
        );
      }
    }
  }

  // ---------------------------------------
  // SHOOTING STARS
  // ---------------------------------------

  function scheduleShootingStar(time) {
    nextShootingStar = time + lerp(
      C.shootingStars.minDelay,
      C.shootingStars.maxDelay,
      Math.random()
    );
  }

  function drawShootingStars(time) {
    if (
      reducedMotion ||
      !C.motion.shootingStars ||
      !C.shootingStars.enabled
    ) return;

    if (!nextShootingStar) {
      scheduleShootingStar(time);
    }

    if (!shootingStar && time > nextShootingStar) {
      shootingStar = {
        born: time,
        x: Math.random() * W,
        y: Math.random() * H * 0.68,
        angle: Math.PI * (0.12 + Math.random() * 0.2),
        distance: 180 + Math.random() * 300,
        duration: C.shootingStars.duration
      };
    }

    if (!shootingStar) return;

    const s = shootingStar;
    const progress = (time - s.born) / s.duration;

    if (progress >= 1) {
      shootingStar = null;
      scheduleShootingStar(time);
      return;
    }

    const eased = smoothstep(progress);
    const opacity = Math.sin(progress * Math.PI) * 0.8;

    const headX =
      s.x + Math.cos(s.angle) * s.distance * eased;

    const headY =
      s.y + Math.sin(s.angle) * s.distance * eased;

    const tailLength = 90 + 110 * (1 - progress);

    const tailX = headX - Math.cos(s.angle) * tailLength;
    const tailY = headY - Math.sin(s.angle) * tailLength;

    ctx.save();

    const gradient = ctx.createLinearGradient(
      tailX, tailY, headX, headY
    );

    gradient.addColorStop(0, "rgba(70,155,255,0)");
    gradient.addColorStop(
      0.75,
      `rgba(117,196,255,${opacity * 0.45})`
    );
    gradient.addColorStop(
      1,
      `rgba(240,250,255,${opacity})`
    );

    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    const glow = ctx.createRadialGradient(
      headX, headY, 0,
      headX, headY, 15
    );

    glow.addColorStop(
      0, `rgba(220,245,255,${opacity * 0.6})`
    );
    glow.addColorStop(1, "rgba(70,150,255,0)");

    ctx.fillStyle = glow;
    circle(headX, headY, 15);
    ctx.fill();

    ctx.restore();
  }

  // ---------------------------------------
  // TOUCH AND MOUSE NAVIGATION
  // ---------------------------------------

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
        Math.hypot(b.x - a.x, b.y - a.y)
      )
    };
  }

  canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();

    const pos = pointerPosition(event);
    pointers.set(event.pointerId, pos);

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (_) {}

    if (pointers.size === 2) {
      pinch = pinchMetrics();
    } else if (pointers.size !== 1) {
      pinch = null;
    }
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
      const before = pinch || pinchMetrics();

      pointers.set(event.pointerId, current);

      const after = pinchMetrics();
      if (!before || !after) return;

      // Two-finger zoom, centered on the gesture.
      const worldX =
        camera.x + (before.x - W / 2) / camera.zoom;

      const worldY =
        camera.y + (before.y - H / 2) / camera.zoom;

      const newZoom = clamp(
        camera.zoom * after.distance / before.distance,
        C.camera.minZoom,
        C.camera.maxZoom
      );

      camera.zoom = newZoom;

      camera.x =
        worldX - (after.x - W / 2) / newZoom;

      camera.y =
        worldY - (after.y - H / 2) / newZoom;

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

    pinch = pointers.size === 2
      ? pinchMetrics()
      : null;
  }

  canvas.addEventListener("pointerup", releasePointer);
  canvas.addEventListener("pointercancel", releasePointer);
  canvas.addEventListener("lostpointercapture", releasePointer);

  // Scroll wheels and trackpads PAN.
  // They never control zoom.
  canvas.addEventListener("wheel", event => {
    event.preventDefault();

    // Ignore browser pinch-zoom wheel events.
    if (event.ctrlKey || event.metaKey) return;

    const multiplier =
      event.deltaMode === 1 ? 16 :
      event.deltaMode === 2 ? H : 1;

    camera.x += event.deltaX * multiplier / camera.zoom;
    camera.y += event.deltaY * multiplier / camera.zoom;
  }, { passive: false });

  // ---------------------------------------
  // ANIMATION LOOP
  // ---------------------------------------

  function render(time) {
    const frameInterval = 1000 / C.rendering.targetFPS;

    if (time - lastFrame < frameInterval) {
      requestAnimationFrame(render);
      return;
    }

    const delta = previousTime
      ? Math.min(60, time - previousTime)
      : 16;

    previousTime = time;
    lastFrame = time;

    if (!reducedMotion) {
      spaceTime += delta;
    }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    drawBackground();

    drawStarLayer(0, spaceTime);
    drawNebulae(spaceTime);
    drawStarLayer(1, spaceTime);
    drawPlanets(spaceTime);
    drawStarLayer(2, spaceTime);
    drawAsteroids(spaceTime);
    drawShootingStars(time);

    requestAnimationFrame(render);
  }

  window.addEventListener("resize", resize);

  document.addEventListener("visibilitychange", () => {
    previousTime = 0;
  });

  resize();
  requestAnimationFrame(render);

  // Expose the camera for future watch-tracker integration.
  window.SpaceUniverse = {
    camera,

    moveTo(x, y) {
      camera.x = x;
      camera.y = y;
    },

    setZoom(value) {
      camera.zoom = clamp(
        value,
        C.camera.minZoom,
        C.camera.maxZoom
      );
    }
  };

})();
