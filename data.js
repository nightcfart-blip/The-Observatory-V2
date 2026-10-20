"use strict";

window.SPACE_CONFIG = {
  seed: 1062417,

  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.45,
    maxZoom: 2.5
  },

  startPoint: {
    x: 0,
    y: 0,
    zoom: 1
  },

  rendering: {
    maxPixelRatio: 1.8,
    targetFPS: 40,
    nebulaCacheSize: 36
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
    baseAlpha: 0.85,
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
    cellSize: 1650,
    density: 0.56,
    opacity: 0.9,
    driftSpeed: 0.00012,
    sizeMin: 950,
    sizeMax: 1800,
    palette: [
      [35, 80, 170],
      [48, 108, 205],
      [74, 89, 210],
      [28, 155, 214],
      [99, 71, 205],
      [129, 102, 231],
      [59, 189, 221],
      [104, 140, 255]
    ]
  },

  shootingStars: {
    enabled: true,
    minDelay: 12000,
    maxDelay: 26000,
    duration: 1450
  },

  planet: {
    worldX: 860,
    worldY: -120,
    radius: 280,
    atmosphereColor: "rgba(116, 205, 255, 0.18)",
    baseColors: {
      deepOcean: "#11496a",
      shallowOcean: "#18aab7",
      brightShelf: "#7fe9d5",
      land: "#6ec36b",
      highland: "#6e6b8e",
      clouds: "#ffffff"
    }
  },

  ambientAudio: {
    enabled: true,
    startOnFirstGesture: true
  }
};
