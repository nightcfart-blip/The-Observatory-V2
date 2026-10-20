"use strict";

window.SPACE_CONFIG = {
  seed: 1062417,

  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.35,
    maxZoom: 2.0
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

  moon: {
    imagePath: "IMG_8758.jpeg",

    // farther back and more off to the side
    worldX: 1800,
    worldY: -470,

    // roughly half the previous size
    width: 860,
    height: 860,

    // lower parallax = farther in background
    parallax: 0.22,
    scaleFactor: 0.82,

    opacity: 0.78,
    driftAmplitude: 0.9,

    // removes the harsh black-square feel
    blackKey: {
      clipBelow: 10,
      featherTo: 42
    },

    // extra shadow and atmospheric blend
    shadowStrength: 0.42,
    glowOpacity: 0.035,

    fog: {
      opacity: 0.22,
      size: 1.34,
      tint: [66, 106, 178]
    }
  },

  ambientAudio: {
    enabled: true,
    startOnFirstGesture: true
  }
};
