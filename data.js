"use strict";

window.SPACE_CONFIG = {
  seed: 615204,

  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.58,
    maxZoom: 2.35
  },

  rendering: {
    maxPixelRatio: 1.75,
    targetFPS: 40,
    nebulaCacheSize: 40
  },

  scene: {
    lightDirection: {
      x: -1,
      y: -0.08
    },
    ambientDrift: 0.00024
  },

  nebulae: {
    cellSize: 1700,
    density: 0.66,
    opacity: 0.82,
    colors: [
      [16, 55, 118],
      [24, 80, 155],
      [18, 109, 173],
      [66, 90, 188],
      [45, 135, 206],
      [93, 110, 220],
      [10, 35, 84]
    ]
  },

  stars: {
    cellSize: 560,
    farCount: 90,
    midCount: 42,
    nearCount: 12,
    colors: [
      "#ffffff",
      "#d7e8ff",
      "#b6d6ff",
      "#f4fbff",
      "#bfe9ff",
      "#d8ddff",
      "#ffe9d4"
    ],
    twinkleSpeed: 0.00034
  },

  planets: {
    cellSize: 2800,
    probability: 0.25,
    minRadius: 95,
    maxRadius: 240,
    palettes: [
      ["#081526", "#10334e", "#2d89b2"],
      ["#0b1535", "#20497c", "#89a7dc"],
      ["#0a1b2c", "#12546a", "#63aabf"],
      ["#17172f", "#4f4a75", "#9d96c7"],
      ["#0c111d", "#39475b", "#b9cfda"]
    ]
  },

  asteroids: {
    cellSize: 900,
    density: 0.38,
    maxPerCell: 3,
    minRadius: 8,
    maxRadius: 34
  },

  shootingStars: {
    enabled: true,
    minDelay: 14000,
    maxDelay: 32000,
    duration: 950
  }
};
