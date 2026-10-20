
"use strict";

window.SPACE_CONFIG = {
  seed: 1062417,

  camera: {
    x: 0, y: 0, zoom: 1,
    minZoom: 0.45,
    maxZoom: 2.5
  },

  startPoint: {
    x: 0, y: 0, zoom: 1
  },

  rendering: {
    maxPixelRatio: 1.8,
    targetFPS: 40,
    nebulaCacheSize: 32
  },

  sky: {
    backgroundTop: "#01050d",
    backgroundBottom: "#020713",
    vignetteStrength: 0.28
  },

  baseScene: {
    starsAmount: 1,
    starsBrightness: 1,
    starsColorVariance: 1,
    starsTwinkle: 1,

    shootingFrequency: 1,

    nebulaColorVariance: 1,
    nebulaBrightness: 1,
    nebulaSize: 1,
    nebulaFrequency: 1.15,

    ambientVolume: 0.045
  },

  stars: {
    cellSize: 560,
    distantCount: 72,
    middleCount: 38,
    nearCount: 13,
    twinkleSpeed: 0.00032,

    colors: [
      "#ffffff",
      "#f3f7ff",
      "#dbe8ff",
      "#bfd7ff",
      "#9bbcff",
      "#baf1ff",
      "#ffdca8",
      "#ffd2de",
      "#d9c6ff"
    ]
  },

  nebulae: {
    driftSpeed: 0.00012,

    palette: [
      [35,80,170],
      [48,108,205],
      [74,89,210],
      [28,155,214],
      [99,71,205],
      [129,102,231],
      [59,189,221],
      [104,140,255]
    ],

    layers: [
      {
        cellSize: 2300,
        density: 0.75,
        parallax: 0.12,
        zoomFactor: 0.66,
        sizeMin: 1600,
        sizeMax: 2900,
        opacity: 0.34,
        detail: 0.45,
        diffuse: 1.6,
        drift: 0.3
      },
      {
        cellSize: 1850,
        density: 0.68,
        parallax: 0.29,
        zoomFactor: 0.82,
        sizeMin: 1200,
        sizeMax: 2150,
        opacity: 0.70,
        detail: 0.75,
        diffuse: 1.25,
        drift: 0.55
      },
      {
        cellSize: 1650,
        density: 0.56,
        parallax: 0.58,
        zoomFactor: 0.96,
        sizeMin: 950,
        sizeMax: 1800,
        opacity: 0.91,
        detail: 1,
        diffuse: 1,
        drift: 1
      },
      {
        cellSize: 2000,
        density: 0.27,
        parallax: 1.12,
        zoomFactor: 1.08,
        sizeMin: 1050,
        sizeMax: 2100,
        opacity: 0.30,
        detail: 1.25,
        diffuse: 0.75,
        drift: 1.5
      }
    ]
  },

  shootingStars: {
    enabled: true,
    minDelay: 12000,
    maxDelay: 26000,
    duration: 1450
  },

  ambientAudio: {
    enabled: true,
    startOnFirstGesture: true
  }
};
