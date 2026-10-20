
"use strict";

/* ===========================================
   WATCH ARCHIVE — SPACE CONFIGURATION
=========================================== */

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

/* ===========================================
   LIBRARY CONFIGURATION
=========================================== */

window.ARCHIVE_CONFIG = {
  version: 1,
  storageKey: "watchArchiveLibrary_v1",

  constellation: {
    minStars: 2,
    maxStars: 30,
    defaultStars: 7,

    // World coordinates; not screen pixels.
    firstRegionX: 1250,
    firstRegionY: 150,

    regionSpacing: 1550,
    minimumRegionDistance: 1050,

    groupRadius: 380,
    productionRadius: 190,
    seasonRadius: 90,

    groupStarSize: [10, 18],
    productionStarSize: [6, 12],
    seasonStarSize: [2, 5],

    groupMinZoom: 0.45,
    productionMinZoom: 0.55,
    seasonMinZoom: 1.25,

    colors: [
      [215,232,255],
      [171,202,255],
      [197,183,255],
      [164,227,250],
      [237,228,255],
      [172,184,245],
      [255,224,196]
    ]
  },

  initialLibraryVisibility: {
    group: false,
    production: true,
    season: false,
    episode: false
  },

  sorting: [
    { id: "alphabetical", label: "Alphabetical" },
    { id: "rating-high", label: "Highest Rated" },
    { id: "rating-low", label: "Lowest Rated" },
    { id: "media", label: "Form of Media" },
    { id: "release-new", label: "Newest Release / Airing" },
    { id: "release-old", label: "Oldest Release / Airing" },
    { id: "added-new", label: "Recently Added" },
    { id: "added-old", label: "Eldest Added" },
    { id: "last-seen", label: "Last Seen" }
  ],

  statistics: {
    palettes: [
      "#92bbff",
      "#bba9ff",
      "#72cadb",
      "#d8b8e8",
      "#91dbc1",
      "#e1c69e",
      "#759ee1",
      "#c7dfff"
    ]
  }
};

/* ===========================================
   STATISTICS CATALOGUE
=========================================== */

window.ARCHIVE_STATISTICS = {

  datasets: [
    {
      id: "watchTime",
      label: "Total Watch Time",
      charts: ["line", "stackedBar", "rankedBar"]
    },
    {
      id: "mediaBreakdown",
      label: "Time by Form of Media",
      charts: ["donut", "stackedBar", "treemap", "rankedBar"]
    },
    {
      id: "genreDistribution",
      label: "Genre Distribution",
      charts: ["donut", "treemap", "radar", "rankedBar"]
    },
    {
      id: "genreOverlap",
      label: "Genre Overlapping",
      charts: ["venn", "upset", "chord", "network"]
    },
    {
      id: "ratingDistribution",
      label: "Rating Distribution",
      charts: ["histogram", "boxPlot", "donut", "scatter"]
    },
    {
      id: "ratingRankings",
      label: "Highest / Lowest Rated",
      charts: ["rankedBar", "treemap", "scatter"]
    }
  ],

  charts: [
    { id: "line", label: "Line Graph" },
    { id: "donut", label: "Donut Chart" },
    { id: "stackedBar", label: "Stacked Bar Chart" },
    { id: "treemap", label: "Treemap" },
    { id: "radar", label: "Radar / Spider Chart" },
    { id: "venn", label: "Venn Diagram" },
    { id: "upset", label: "UpSet Plot" },
    { id: "chord", label: "Chord Diagram" },
    { id: "network", label: "Network Graph" },
    { id: "histogram", label: "Histogram" },
    { id: "boxPlot", label: "Box and Whisker" },
    { id: "rankedBar", label: "Ranked Horizontal Bar" },
    { id: "scatter", label: "Scatter Plot" }
  ],

  compatible(datasetId, chartId) {
    const dataset = this.datasets.find(x => x.id === datasetId);
    return !!dataset && dataset.charts.includes(chartId);
  },

  chartsFor(datasetId) {
    const dataset = this.datasets.find(x => x.id === datasetId);
    if (!dataset) return [];

    return this.charts.filter(chart =>
      dataset.charts.includes(chart.id)
    );
  },

  defaultChart(datasetId) {
    return this.chartsFor(datasetId)[0]?.id || null;
  }
};

/* ===========================================
   HELPERS
=========================================== */

const ArchiveUtil = {

  id(prefix = "entry") {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return prefix + "_" + crypto.randomUUID();
    }

    return prefix + "_" + Date.now().toString(36) +
      "_" + Math.random().toString(36).slice(2);
  },

  now() {
    return new Date().toISOString();
  },

  number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  },

  text(value) {
    return String(value ?? "").trim();
  },

  strings(value) {
    if (Array.isArray(value)) {
      return value.map(x => this.text(x)).filter(Boolean);
    }

    return String(value ?? "")
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
  },

  rating(value) {
    if (value === "" || value === null || value === undefined) {
      return null;
    }

    const n = Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 10) {
      return null;
    }

    return Math.round(n * 2) / 2;
  },

  average(values) {
    const numbers = values.filter(
      v => typeof v === "number" && Number.isFinite(v)
    );

    if (!numbers.length) return null;

    return numbers.reduce((a, b) => a + b, 0) /
      numbers.length;
  },

  dateValue(value) {
    if (!value) return null;

    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  },

  hashString(value) {
    let h = 2166136261;

    for (const char of String(value)) {
      h ^= char.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }

    return h >>> 0;
  },

  seeded(seed) {
    let s = seed >>> 0;

    return () => {
      s += 0x6d2b79f5;

      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
};

/* ===========================================
   PERSISTENT DATA STORE
=========================================== */

class WatchArchiveStore {

  constructor() {
    this.key = window.ARCHIVE_CONFIG.storageKey;
    this.data = this.emptyData();
    this.listeners = new Set();
    this.load();
  }

  emptyData() {
    return {
      version: 1,

      groups: [],
      productions: [],
      seasons: [],
      episodes: [],
      watchlist: [],

      preferences: {
        librarySort: "alphabetical",

        libraryVisibility: {
          ...ARCHIVE_CONFIG.initialLibraryVisibility
        },

        statisticsDataset: "watchTime",
        statisticsChart: "line"
      }
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return;

      const saved = JSON.parse(raw);

      if (!saved || saved.version !== 1) {
        console.warn("Unsupported archive version.");
        return;
      }

      const fresh = this.emptyData();

      for (const name of [
        "groups",
        "productions",
        "seasons",
        "episodes",
        "watchlist"
      ]) {
        fresh[name] = Array.isArray(saved[name])
          ? saved[name]
          : [];
      }

      fresh.preferences = {
        ...fresh.preferences,
        ...(saved.preferences || {}),

        libraryVisibility: {
          ...fresh.preferences.libraryVisibility,
          ...(saved.preferences?.libraryVisibility || {})
        }
      };

      this.data = fresh;

    } catch (error) {
      console.warn("Archive could not be loaded:", error);
    }
  }

  save() {
    try {
      localStorage.setItem(
        this.key,
        JSON.stringify(this.data)
      );

      for (const callback of this.listeners) {
        try {
          callback(this.data);
        } catch (error) {
          console.warn("Archive listener error:", error);
        }
      }

      return true;

    } catch (error) {
      console.error("Archive could not be saved:", error);
      return false;
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);

    return () => this.listeners.delete(callback);
  }

  // Commit changes only after successful storage.
  transaction(mutator) {
    const before = this.data;

    try {
      const draft = structuredClone(before);
      const result = mutator(draft);

      localStorage.setItem(this.key, JSON.stringify(draft));
      this.data = draft;

      for (const callback of this.listeners) {
        try {
          callback(this.data);
        } catch (error) {
          console.warn("Archive listener error:", error);
        }
      }

      return result;

    } catch (error) {
      console.error("Archive transaction failed:", error);
      return null;
    }
  }

  collection(type) {
    const names = {
      group: "groups",
      production: "productions",
      season: "seasons",
      episode: "episodes",
      watchlist: "watchlist"
    };

    return names[type] || null;
  }

  all(type) {
    const key = this.collection(type);
    return key ? this.data[key].slice() : [];
  }

  get(type, id) {
    const key = this.collection(type);
    if (!key) return null;

    return this.data[key].find(item => item.id === id) || null;
  }

  // ------------------------------------------
  // RELATIONSHIPS
  // ------------------------------------------

  children(type, id) {
    if (type === "group") {
      return this.data.productions.filter(
        p => p.groupId === id
      );
    }

    if (type === "production") {
      return this.data.seasons.filter(
        s => s.productionId === id
      );
    }

    if (type === "season") {
      return this.data.episodes.filter(
        e => e.seasonId === id
      );
    }

    return [];
  }

  parent(type, item) {
    if (!item) return null;

    if (type === "production" && item.groupId) {
      return this.get("group", item.groupId);
    }

    if (type === "season") {
      return this.get("production", item.productionId);
    }

    if (type === "episode") {
      return this.get("season", item.seasonId);
    }

    return null;
  }

  // ------------------------------------------
  // CONSTELLATION CREATION
  // ------------------------------------------

  constellationCenter(parentCenter = null, parentSeed = 0) {
    const config = ARCHIVE_CONFIG.constellation;

    if (parentCenter) {
      const random = ArchiveUtil.seeded(parentSeed);

      const angle = random() * Math.PI * 2;
      const distance = 100 + random() * 175;

      return {
        x: parentCenter.x + Math.cos(angle) * distance,
        y: parentCenter.y + Math.sin(angle) * distance
      };
    }

    const roots = [
      ...this.data.groups,
      ...this.data.productions.filter(p => !p.groupId)
    ].filter(item => item.constellation?.center);

    // Expand outward rather than placing entries
    // repeatedly on top of each other.
    for (let attempt = 0; attempt < 150; attempt++) {
      const angle = attempt * 2.399963229728653;
      const distance = config.regionSpacing *
        Math.sqrt(attempt + 1);

      const candidate = {
        x: config.firstRegionX +
          Math.cos(angle) * distance,
        y: config.firstRegionY +
          Math.sin(angle) * distance
      };

      const tooClose = roots.some(item => {
        const center = item.constellation.center;

        return Math.hypot(
          candidate.x - center.x,
          candidate.y - center.y
        ) < config.minimumRegionDistance;
      });

      if (!tooClose) return candidate;
    }

    return {
      x: config.firstRegionX +
        roots.length * config.regionSpacing,
      y: config.firstRegionY
    };
  }

  generateConstellation({
    type,
    id,
    starCount = ARCHIVE_CONFIG.constellation.defaultStars,
    center = null,
    parentCenter = null
  }) {
    const config = ARCHIVE_CONFIG.constellation;
    const count = Math.round(
      Math.max(
        config.minStars,
        Math.min(config.maxStars, Number(starCount) || 7)
      )
    );

    const seed = ArchiveUtil.hashString(id);
    const random = ArchiveUtil.seeded(seed);

    const location = center ||
      this.constellationCenter(parentCenter, seed);

    const radius = type === "group"
      ? config.groupRadius
      : type === "season"
        ? config.seasonRadius
        : config.productionRadius;

    const shape = Math.floor(random() * 5);
    const rotation = random() * Math.PI * 2;
    const stretchX = .55 + random() * .85;
    const stretchY = .45 + random() * .95;

    const stars = [];

    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1);

      let x = 0;
      let y = 0;

      if (shape === 0) {
        const angle = t * Math.PI * 2;
        const r = radius * (.35 + random() * .55);
        x = Math.cos(angle) * r;
        y = Math.sin(angle) * r;
      }

      else if (shape === 1) {
        x = (t - .5) * radius * 1.7;
        y = Math.sin(t * Math.PI * 2.2) *
          radius * (.24 + random() * .25);
      }

      else if (shape === 2) {
        const angle = t * Math.PI * (2.2 + random());
        const r = radius * (.15 + t * .82);
        x = Math.cos(angle) * r;
        y = Math.sin(angle) * r;
      }

      else if (shape === 3) {
        const angle = random() * Math.PI * 2;
        const r = Math.sqrt(random()) * radius;
        x = Math.cos(angle) * r;
        y = Math.sin(angle) * r;
      }

      else {
        const branch = i % 3;
        x = (t - .5) * radius * 1.45;
        y = (branch - 1) * radius * .47 +
          (random() - .5) * radius * .25;
      }

      // Perturb positions so the pattern isn't geometric.
      x += (random() - .5) * radius * .24;
      y += (random() - .5) * radius * .24;

      x *= stretchX;
      y *= stretchY;

      const rx = x * Math.cos(rotation) -
        y * Math.sin(rotation);

      const ry = x * Math.sin(rotation) +
        y * Math.cos(rotation);

      const sizes = type === "group"
        ? config.groupStarSize
        : type === "season"
          ? config.seasonStarSize
          : config.productionStarSize;

      stars.push({
        id: ArchiveUtil.id("star"),
        x: rx,
        y: ry,

        size: sizes[0] +
          random() * (sizes[1] - sizes[0]),

        tint: config.colors[
          Math.floor(random() * config.colors.length)
        ],

        brightness: .55 + random() * .45,
        twinklePhase: random() * Math.PI * 2
      });
    }

    // Connect each star to its nearest existing point,
    // building a varied tree rather than one fixed shape.
    const links = [];

    for (let i = 1; i < stars.length; i++) {
      let nearest = 0;
      let smallest = Infinity;

      for (let j = 0; j < i; j++) {
        const distance = Math.hypot(
          stars[i].x - stars[j].x,
          stars[i].y - stars[j].y
        );

        if (distance < smallest) {
          nearest = j;
          smallest = distance;
        }
      }

      links.push([nearest, i]);
    }

    // A few extra connections create more varied geometry.
    if (count >= 5 && random() > .35) {
      const a = Math.floor(random() * count);
      const b = (a + 2 + Math.floor(random() * (count - 2))) % count;

      if (a !== b) links.push([a, b]);
    }

    return {
      center: location,
      count,
      shape,
      rotation,
      stars,
      links,
      seed
    };
  }

  // ------------------------------------------
  // CREATE ENTRIES
  // ------------------------------------------

  createGroup(input = {}) {
    const title = ArchiveUtil.text(input.title);
    if (!title) return null;

    const id = ArchiveUtil.id("group");

    const group = {
      id,
      title,
      banner: ArchiveUtil.text(input.banner),
      genres: ArchiveUtil.strings(input.genres),
      tags: ArchiveUtil.strings(input.tags),
      notes: ArchiveUtil.text(input.notes),

      createdAt: ArchiveUtil.now(),
      updatedAt: ArchiveUtil.now(),

      constellation: this.generateConstellation({
        type: "group",
        id,
        starCount: input.starCount
      })
    };

    return this.transaction(draft => {
      draft.groups.push(group);
      return group;
    });
  }

  createProduction(input = {}) {
    const title = ArchiveUtil.text(input.title);
    if (!title) return null;

    const groupId = input.groupId || null;
    const group = groupId ? this.get("group", groupId) : null;

    if (groupId && !group) return null;

    const id = ArchiveUtil.id("production");

    const production = {
      id,
      groupId,

      title,
      banner: ArchiveUtil.text(input.banner),
      mediaType: ArchiveUtil.text(input.mediaType),

      releaseDate: ArchiveUtil.text(input.releaseDate),
      endDate: ArchiveUtil.text(input.endDate),

      status: ArchiveUtil.text(input.status),

      genres: ArchiveUtil.strings(input.genres),
      tags: ArchiveUtil.strings(input.tags),
      notes: ArchiveUtil.text(input.notes),

      // For a standalone film.
      rating: ArchiveUtil.rating(input.rating),
      durationMinutes: Math.max(
        0, ArchiveUtil.number(input.durationMinutes)
      ),

      watchedAt: ArchiveUtil.text(input.watchedAt),
      viewings: [],

      createdAt: ArchiveUtil.now(),
      updatedAt: ArchiveUtil.now(),

      constellation: this.generateConstellation({
        type: "production",
        id,
        starCount: input.starCount,
        parentCenter: group?.constellation?.center || null
      })
    };

    return this.transaction(draft => {
      draft.productions.push(production);
      return production;
    });
  }

  createSeason(input = {}) {
    const production = this.get(
      "production", input.productionId
    );

    if (!production) return null;

    const id = ArchiveUtil.id("season");

    const season = {
      id,
      productionId: production.id,

      title: ArchiveUtil.text(input.title) ||
        "Untitled Season",

      number: input.number ?? null,
      releaseDate: ArchiveUtil.text(input.releaseDate),
      endDate: ArchiveUtil.text(input.endDate),
      status: ArchiveUtil.text(input.status),
      notes: ArchiveUtil.text(input.notes),

      createdAt: ArchiveUtil.now(),
      updatedAt: ArchiveUtil.now(),

      constellation: this.generateConstellation({
        type: "season",
        id,
        starCount: input.starCount || 2,
        parentCenter:
          production.constellation?.center || null
      })
    };

    return this.transaction(draft => {
      draft.seasons.push(season);
      return season;
    });
  }

  createEpisode(input = {}) {
    const season = this.get("season", input.seasonId);

    if (!season) return null;

    const episode = {
      id: ArchiveUtil.id("episode"),
      seasonId: season.id,

      title: ArchiveUtil.text(input.title) ||
        "Untitled Episode",

      number: input.number ?? null,

      releaseDate: ArchiveUtil.text(input.releaseDate),
      durationMinutes: Math.max(
        0, ArchiveUtil.number(input.durationMinutes)
      ),

      notes: ArchiveUtil.text(input.notes),
      rating: ArchiveUtil.rating(input.rating),

      watchedAt: ArchiveUtil.text(input.watchedAt),
      viewings: [],

      createdAt: ArchiveUtil.now(),
      updatedAt: ArchiveUtil.now()
    };

    return this.transaction(draft => {
      draft.episodes.push(episode);
      return episode;
    });
  }

  // ------------------------------------------
  // WATCHLIST
  // ------------------------------------------

  addWatchlist(input = {}) {
    const title = ArchiveUtil.text(input.title);
    if (!title) return null;

    const item = {
      id: ArchiveUtil.id("watch"),
      title,
      mediaType: ArchiveUtil.text(input.mediaType),
      releaseDate: ArchiveUtil.text(input.releaseDate),
      createdAt: ArchiveUtil.now()
    };

    return this.transaction(draft => {
      draft.watchlist.push(item);
      return item;
    });
  }

  completeWatchlist(id) {
    const item = this.get("watchlist", id);
    if (!item) return null;

    const productionId = ArchiveUtil.id("production");

    const production = {
      id: productionId,
      groupId: null,

      title: item.title,
      banner: "",
      mediaType: item.mediaType,
      releaseDate: item.releaseDate,
      endDate: "",
      status: "",
      genres: [],
      tags: [],
      notes: "",

      rating: null,
      durationMinutes: 0,
      watchedAt: "",
      viewings: [],

      createdAt: ArchiveUtil.now(),
      updatedAt: ArchiveUtil.now(),

      constellation: this.generateConstellation({
        type: "production",
        id: productionId,
        starCount: ARCHIVE_CONFIG.constellation.defaultStars
      })
    };

    // Transfer and removal happen in the same transaction.
    return this.transaction(draft => {
      const index = draft.watchlist.findIndex(
        w => w.id === id
      );

      if (index < 0) {
        throw new Error("Watchlist item no longer exists.");
      }

      draft.productions.push(production);
      draft.watchlist.splice(index, 1);

      return production;
    });
  }

  removeWatchlist(id) {
    if (!this.get("watchlist", id)) return false;

    return this.transaction(draft => {
      draft.watchlist = draft.watchlist.filter(
        w => w.id !== id
      );
      return true;
    });
  }

  // ------------------------------------------
  // EDIT / DELETE
  // ------------------------------------------

  update(type, id, changes = {}) {
    const key = this.collection(type);
    const existing = this.get(type, id);

    if (!key || !existing) return null;

    const allowed = {
      group: ["title", "banner", "genres", "tags", "notes"],
      production: [
        "title", "groupId", "banner", "mediaType",
        "releaseDate", "endDate", "status",
        "genres", "tags", "notes", "rating",
        "durationMinutes", "watchedAt", "viewings"
      ],
      season: [
        "title", "number", "releaseDate",
        "endDate", "status", "notes"
      ],
      episode: [
        "title", "number", "releaseDate",
        "durationMinutes", "notes", "rating",
        "watchedAt", "viewings"
      ],
      watchlist: ["title", "mediaType", "releaseDate"]
    }[type] || [];

    const patch = {};

    for (const name of allowed) {
      if (!(name in changes)) continue;

      let value = changes[name];

      if (["genres", "tags"].includes(name)) {
        value = ArchiveUtil.strings(value);
      }

      if (name === "rating") {
        value = ArchiveUtil.rating(value);
      }

      if (name === "durationMinutes") {
        value = Math.max(0, ArchiveUtil.number(value));
      }

      if (name === "groupId") {
        value = value || null;

        if (value && !this.get("group", value)) {
          return null;
        }
      }

      patch[name] = value;
    }

    if ("title" in patch &&
        !ArchiveUtil.text(patch.title)) return null;

    return this.transaction(draft => {
      const target = draft[key].find(x => x.id === id);

      if (!target) {
        throw new Error("Entry not found.");
      }

      Object.assign(target, patch, {
        updatedAt: ArchiveUtil.now()
      });

      return target;
    });
  }

  delete(type, id) {
    if (!this.get(type, id)) return false;

    const key = this.collection(type);
    if (!key) return false;

    return this.transaction(draft => {
      const removeIds = {
        production: new Set(),
        season: new Set()
      };

      // Deleting a group preserves its productions,
      // making them standalone instead.
      if (type === "group") {
        for (const production of draft.productions) {
          if (production.groupId === id) {
            production.groupId = null;
          }
        }
      }

      // Deleting a production removes its children.
      if (type === "production") {
        removeIds.production.add(id);
      }

      if (type === "season") {
        removeIds.season.add(id);
      }

      for (const season of draft.seasons) {
        if (removeIds.production.has(season.productionId)) {
          removeIds.season.add(season.id);
        }
      }

      draft.episodes = draft.episodes.filter(
        episode => !removeIds.season.has(episode.seasonId)
      );

      draft.seasons = draft.seasons.filter(
        season => !removeIds.season.has(season.id)
      );

      draft[key] = draft[key].filter(
        item => item.id !== id
      );

      return true;
    });
  }

  // ------------------------------------------
  // RATINGS
  // ------------------------------------------

  calculatedRating(type, itemOrId) {
    const item = typeof itemOrId === "string"
      ? this.get(type, itemOrId)
      : itemOrId;

    if (!item) return null;

    if (type === "episode") {
      return ArchiveUtil.rating(item.rating);
    }

    if (type === "season") {
      return ArchiveUtil.average(
        this.children("season", item.id).map(
          episode => this.calculatedRating("episode", episode)
        )
      );
    }

    if (type === "production") {
      const seasons = this.children("production", item.id);

      if (!seasons.length) {
        return ArchiveUtil.rating(item.rating);
      }

      return ArchiveUtil.average(
        seasons.map(
          season => this.calculatedRating("season", season)
        )
      );
    }

    if (type === "group") {
      return ArchiveUtil.average(
        this.children("group", item.id).map(
          production => this.calculatedRating(
            "production", production
          )
        )
      );
    }

    return null;
  }

  // ------------------------------------------
  // LIBRARY SORTING
  // ------------------------------------------

  libraryEntries(options = {}) {
    const visibility = {
      ...this.data.preferences.libraryVisibility,
      ...(options.visibility || {})
    };

    const sort = options.sort ||
      this.data.preferences.librarySort;

    const result = [];

    for (const type of [
      "group", "production", "season", "episode"
    ]) {
      if (!visibility[type]) continue;

      for (const item of this.all(type)) {
        result.push({
          type,
          item,
          rating: this.calculatedRating(type, item)
        });
      }
    }

    const stringCompare = (a, b) =>
      (a || "").localeCompare(b || "", undefined, {
        sensitivity: "base"
      });

    const date = (item, key) =>
      ArchiveUtil.dateValue(item[key]);

    const cmpNullable = (a, b, direction = 1) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return (a - b) * direction;
    };

    result.sort((a, b) => {
      let compared = 0;

      switch (sort) {
        case "rating-high":
          compared = cmpNullable(a.rating, b.rating, -1);
          break;

        case "rating-low":
          compared = cmpNullable(a.rating, b.rating, 1);
          break;

        case "media":
          compared = stringCompare(
            a.item.mediaType,
            b.item.mediaType
          );
          break;

        case "release-new":
          compared = cmpNullable(
            date(a.item, "releaseDate"),
            date(b.item, "releaseDate"),
            -1
          );
          break;

        case "release-old":
          compared = cmpNullable(
            date(a.item, "releaseDate"),
            date(b.item, "releaseDate"),
            1
          );
          break;

        case "added-new":
          compared = cmpNullable(
            date(a.item, "createdAt"),
            date(b.item, "createdAt"),
            -1
          );
          break;

        case "added-old":
          compared = cmpNullable(
            date(a.item, "createdAt"),
            date(b.item, "createdAt"),
            1
          );
          break;

        case "last-seen":
          compared = cmpNullable(
            this.lastSeen(a.type, a.item),
            this.lastSeen(b.type, b.item),
            -1
          );
          break;

        default:
          break;
      }

      return compared ||
        stringCompare(a.item.title, b.item.title);
    });

    return result;
  }

  lastSeen(type, item) {
    if (!item) return null;

    const dates = [];

    const collect = entry => {
      if (entry.watchedAt) dates.push(
        ArchiveUtil.dateValue(entry.watchedAt)
      );

      for (const v of entry.viewings || []) {
        dates.push(ArchiveUtil.dateValue(
          typeof v === "string" ? v : v.date
        ));
      }
    };

    if (type === "episode") {
      collect(item);
    }

    if (type === "production") {
      collect(item);

      for (const season of this.children("production", item.id)) {
        for (const episode of this.children("season", season.id)) {
          collect(episode);
        }
      }
    }

    if (type === "season") {
      for (const episode of this.children("season", item.id)) {
        collect(episode);
      }
    }

    if (type === "group") {
      for (const production of this.children("group", item.id)) {
        const d = this.lastSeen("production", production);
        if (d !== null) dates.push(d);
      }
    }

    const valid = dates.filter(v => v !== null);
    return valid.length ? Math.max(...valid) : null;
  }

  setLibraryPreferences(changes = {}) {
    return this.transaction(draft => {
      if (changes.sort) {
        draft.preferences.librarySort = changes.sort;
      }

      if (changes.visibility) {
        Object.assign(
          draft.preferences.libraryVisibility,
          changes.visibility
        );
      }

      return draft.preferences;
    });
  }

  setStatisticsPreferences(dataset, chart) {
    if (!ARCHIVE_STATISTICS.compatible(dataset, chart)) {
      return false;
    }

    return this.transaction(draft => {
      draft.preferences.statisticsDataset = dataset;
      draft.preferences.statisticsChart = chart;
      return true;
    });
  }

  // ------------------------------------------
  // STATISTICS RAW DATA
  // ------------------------------------------

  allProductions() {
    return this.data.productions.slice();
  }

  allEpisodes() {
    return this.data.episodes.slice();
  }

  watchedMinutes() {
    let minutes = 0;

    // Only logged viewings count as watched time.
    // An airing date is not a viewing date.
    const countViews = entry => {
      if (Array.isArray(entry.viewings) && entry.viewings.length) {
        return entry.viewings.length;
      }

      return entry.watchedAt ? 1 : 0;
    };

    for (const production of this.data.productions) {
      const seasons = this.children("production", production.id);

      if (!seasons.length) {
        minutes +=
          (production.durationMinutes || 0) *
          countViews(production);
      }
    }

    for (const episode of this.data.episodes) {
      minutes +=
        (episode.durationMinutes || 0) *
        countViews(episode);
    }

    return minutes;
  }

  mediaTimeBreakdown() {
    const result = {};

    const add = (media, minutes) => {
      const key = media || "Unspecified";
      result[key] = (result[key] || 0) + minutes;
    };

    for (const production of this.data.productions) {
      const seasons = this.children("production", production.id);

      if (!seasons.length) {
        const views = production.viewings?.length ||
          (production.watchedAt ? 1 : 0);

        add(
          production.mediaType,
          (production.durationMinutes || 0) * views
        );

      } else {
        for (const season of seasons) {
          for (const episode of this.children("season", season.id)) {
            const views = episode.viewings?.length ||
              (episode.watchedAt ? 1 : 0);

            add(
              production.mediaType,
              (episode.durationMinutes || 0) * views
            );
          }
        }
      }
    }

    return Object.entries(result).map(([label, value]) => ({
      label,
      value
    }));
  }

  genreDistribution() {
    const counts = new Map();

    for (const production of this.data.productions) {
      for (const genre of new Set(production.genres || [])) {
        const key = genre.trim();
        if (!key) continue;

        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }

    return [...counts].map(([label, value]) => ({
      label,
      value
    })).sort((a, b) => b.value - a.value);
  }

  genreIntersections() {
    const sets = new Map();

    for (const production of this.data.productions) {
      const genres = [...new Set(
        (production.genres || [])
          .map(x => x.trim())
          .filter(Boolean)
      )].sort();

      if (!genres.length) continue;

      const key = JSON.stringify(genres);

      if (!sets.has(key)) {
        sets.set(key, {
          genres,
          productions: [],
          count: 0
        });
      }

      const entry = sets.get(key);
      entry.productions.push(production.id);
      entry.count++;
    }

    return [...sets.values()];
  }

  ratingDistribution() {
    // Production ratings only, to avoid counting
    // the same episode both directly and indirectly.
    return this.data.productions.map(p => ({
      id: p.id,
      title: p.title,
      rating: this.calculatedRating("production", p),
      mediaType: p.mediaType,
      releaseDate: p.releaseDate
    })).filter(x => x.rating !== null);
  }

  ranking(order = "highest") {
    const ranked = this.ratingDistribution();

    ranked.sort((a, b) =>
      order === "highest"
        ? b.rating - a.rating
        : a.rating - b.rating
    );

    return ranked;
  }

  overview() {
    return {
      groups: this.data.groups.length,
      productions: this.data.productions.length,
      seasons: this.data.seasons.length,
      episodes: this.data.episodes.length,
      watchlist: this.data.watchlist.length,

      ratedProductions: this.ratingDistribution().length,
      watchedMinutes: this.watchedMinutes()
    };
  }

  // ------------------------------------------
  // EXPORT / IMPORT FOUNDATION
  // ------------------------------------------

  exportJSON() {
    return JSON.stringify({
      ...this.data,
      exportedAt: ArchiveUtil.now()
    }, null, 2);
  }

  importJSON(json, mode = "replace") {
    if (mode !== "replace") return false;

    try {
      const incoming = typeof json === "string"
        ? JSON.parse(json)
        : json;

      if (!incoming || incoming.version !== 1) {
        return false;
      }

      for (const name of [
        "groups", "productions", "seasons",
        "episodes", "watchlist"
      ]) {
        if (!Array.isArray(incoming[name])) {
          return false;
        }
      }

      const fresh = this.emptyData();

      for (const name of [
        "groups", "productions", "seasons",
        "episodes", "watchlist"
      ]) {
        fresh[name] = incoming[name];
      }

      fresh.preferences = {
        ...fresh.preferences,
        ...(incoming.preferences || {}),
        libraryVisibility: {
          ...fresh.preferences.libraryVisibility,
          ...(incoming.preferences?.libraryVisibility || {})
        }
      };

      return this.transaction(draft => {
        for (const key of Object.keys(fresh)) {
          draft[key] = fresh[key];
        }
        return true;
      });

    } catch (error) {
      console.warn("Import failed:", error);
      return false;
    }
  }
}

/* ===========================================
   INITIALIZE
=========================================== */

window.ArchiveUtil = ArchiveUtil;
window.WatchArchiveStore = WatchArchiveStore;
window.WatchArchive = new WatchArchiveStore();
