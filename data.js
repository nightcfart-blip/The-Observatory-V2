"use strict";

window.SPACE_CONFIG = {
  seed: 962417,

  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.42,
    maxZoom: 2.4
  },

  rendering: {
    maxPixelRatio: 1.75,
    targetFPS: 40,
    nebulaCacheSize: 24,
    planetCacheSize: 12,
    asteroidCacheSize: 32
  },

  motion: {
    stars: true,
    nebulae: true,
    planets: true,
    asteroids: true,
    shootingStars: true
  },

  sky: {
    backgroundTop: "#00050c",
    backgroundBottom: "#000208",
    vignetteStrength: 0.42
  },

  nebulae: {
    cellSize: 1800,
    density: 0.48,
    opacity: 0.8,
    driftSpeed: 0.00018,
    sizeMin: 900,
    sizeMax: 1700,

    palette: [
      [36, 80, 170],
      [63, 101, 204],
      [58, 140, 216],
      [88, 110, 224],
      [68, 64, 166],
      [40, 165, 210]
    ]
  },

  stars: {
    cellSize: 560,
    distantCount: 70,
    middleCount: 36,
    nearCount: 13,
    twinkleSpeed: 0.00038,

    colors: [
      "#ffffff",
      "#edf4ff",
      "#d9e7ff",
      "#b6d0ff",
      "#a5bcff",
      "#bfe8ff",
      "#ffe7cb"
    ]
  },

  planets: {
    cellSize: 2800,
    probability: 0.13,
    minRadius: 90,
    maxRadius: 230,
    driftAmplitude: 5,

    palettes: [
      { base: "#1e4e73", dark: "#081522", light: "#73b7d4", cloud: "#86d6eb" },
      { base: "#58636f", dark: "#0f141b", light: "#d6dbe0", cloud: "#f2f5f7" },
      { base: "#4b5a7c", dark: "#12192a", light: "#aebfe7", cloud: "#dde8ff" },
      { base: "#384b63", dark: "#0a121c", light: "#c2ced8", cloud: "#e7eef4" }
    ]
  },

  asteroids: {
    cellSize: 980,
    density: 0.34,
    maxPerCell: 3,
    minRadius: 5,
    maxRadius: 28,
    driftSpeed: 0.00014
  },

  shootingStars: {
    enabled: true,
    minDelay: 12000,
    maxDelay: 28000,
    duration: 1100
  },

  ambientAudio: {
    enabled: true,
    volume: 0.017,
    startOnFirstGesture: true
  }
};
