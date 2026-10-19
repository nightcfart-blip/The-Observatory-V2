
"use strict";

window.SPACE_CONFIG = {

  seed: 873621,

  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    minZoom: 0.48,
    maxZoom: 2.8
  },

  rendering: {
    maxPixelRatio: 1.5,
    targetFPS: 40,
    nebulaCacheSize: 35
  },

  atmosphere: {
    backgroundTop: "#020713",
    backgroundMiddle: "#06152c",
    backgroundBottom: "#020611",
    nebulaOpacity: 0.84,
    nebulaDrift: 0.0007
  },

  nebulae: {
    cellSize: 1500,
    density: 0.72,

    // RGB colors for procedural gas clouds.
    colors: [
      [24, 76, 164],
      [30, 110, 194],
      [46, 90, 207],
      [12, 129, 177],
      [73, 58, 158],
      [94, 70, 194],
      [21, 159, 193],
      [15, 47, 113],
      [115, 91, 200]
    ]
  },

  stars: {
    cellSize: 520,

    // Stars per generated sector.
    distantCount: 85,
    middleCount: 50,
    nearCount: 18,

    colors: [
      "#e8f4ff",
      "#a8d5ff",
      "#dae5ff",
      "#ffffff",
      "#9eb4ff",
      "#b8fff5",
      "#ffe9ce"
    ],

    twinkleSpeed: 0.00045,
    driftSpeed: 0.001
  },

  planets: {
    cellSize: 2500,
    probability: 0.34,
    minRadius: 75,
    maxRadius: 225,

    colors: [
      ["#081b32", "#17496d", "#3795b8"],
      ["#0b1636", "#203f83", "#7598d8"],
      ["#15142f", "#4c437b", "#9c8cbe"],
      ["#071f31", "#176778", "#71b6c5"],
      ["#222637", "#566679", "#bdcedb"]
    ]
  },

  asteroids: {
    cellSize: 720,
    density: 0.72,
    maxPerCell: 6,
    minRadius: 4,
    maxRadius: 35
  },

  shootingStars: {
    enabled: true,
    minDelay: 10000,
    maxDelay: 28000,
    duration: 950
  },

  motion: {
    stars: true,
    nebulae: true,
    planets: true,
    asteroids: true,
    shootingStars: true
  }
};

