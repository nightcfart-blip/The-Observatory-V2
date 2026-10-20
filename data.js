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
    zoom: 0.78
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

  moon: {
    imagePath: "IMG_8758.jpeg",

    // more centered, but still slightly elevated
    worldX: 1280,
    worldY: -380,

    // keep it present, but farther back and grander
    width: 920,
    height: 920,

    // farther in background
    parallax: 0.18,
    scaleFactor: 0.74,

    // fully solid moon
    opacity: 1,
    driftAmplitude: 0.9,

    // keep black background removed, but preserve solid moon body
    blackKey: {
      clipBelow: 8,
      featherTo: 20
    },

    // more shadow, less glow
    shadowStrength: 0.6,
    glowOpacity: 0.012,

    // much more subtle fog
    fog: {
      opacity: 0.055,
      size: 1.12,
      tint: [66, 106, 178]
    }
  },

  ambientAudio: {
    enabled: true,
    startOnFirstGesture: true
  }
};
