"use strict";

(() => {
  const SPACE_CONFIG = {
    seed: 3245227,

    camera: {
      x: 0,
      y: 0,
      zoom: 1,
      minZoom: 0.45,
      maxZoom: 2.6
    },

    startPoint: {
      x: 0,
      y: 0,
      zoom: 0.45
    },

    rendering: {
      targetFPS: 60,
      maxPixelRatio: 2,
      nebulaCacheSize: 42
    },

    sky: {
      backgroundTop: "#02030d",
      backgroundBottom: "#010208",
      vignetteStrength: 0.36
    },

    stars: {
      enabled: true,
      cellSize: 280,
      distantCount: 1,
      middleCount: 2,
      nearCount: 3,
      twinkleSpeed: 0.0007,
      colors: [
        "#ffffff",
        "#e7f1ff",
        "#d8e8ff",
        "#cad9ff",
        "#d7c9ff",
        "#c9ffff"
      ]
    },

    nebulae: {
      layers: [
        { cellSize: 1550, parallax: 0.2, zoomFactor: 0.65, opacity: 0.36, density: 0.45, sizeMin: 520, sizeMax: 980, diffuse: 1.2, detail: 1.1, drift: 0.35 },
        { cellSize: 1300, parallax: 0.35, zoomFactor: 0.75, opacity: 0.34, density: 0.44, sizeMin: 420, sizeMax: 900, diffuse: 1.1, detail: 1.2, drift: 0.42 },
        { cellSize: 1150, parallax: 0.5, zoomFactor: 0.88, opacity: 0.28, density: 0.36, sizeMin: 340, sizeMax: 760, diffuse: 0.95, detail: 1.25, drift: 0.5 },
        { cellSize: 980, parallax: 0.72, zoomFactor: 1, opacity: 0.17, density: 0.28, sizeMin: 240, sizeMax: 560, diffuse: 0.85, detail: 1.15, drift: 0.55 }
      ],
      palette: [
        [75, 115, 255],
        [96, 143, 255],
        [133, 106, 255],
        [76, 198, 255],
        [125, 222, 255],
        [174, 143, 255]
      ],
      driftSpeed: 0.00004
    },

    shootingStars: {
      enabled: true,
      minDelay: 5000,
      maxDelay: 18000,
      duration: 1200
    },

    ambientAudio: {
      enabled: true
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
      nebulaFrequency: 1,
      ambientVolume: 0.03
    }
  };

  const ARCHIVE_CONFIG = {
    constellation: {
      groupMinZoom: 0.45,
      productionMinZoom: 0.45,
      seasonMinZoom: 1.55,

      groupStarSize: [14, 18],
      productionStarSize: [11, 14],
      seasonStarSize: [6, 9],

      colors: [
        [228, 238, 255],
        [206, 228, 255],
        [222, 214, 255],
        [198, 244, 255],
        [255, 234, 220]
      ]
    },

    sorting: [
      { id: "alphabetical", label: "Alphabetically" },
      { id: "ranking", label: "Ranking" },
      { id: "airing", label: "Time of Airing" },
      { id: "medium", label: "Medium" },
      { id: "createdOldest", label: "Eldest Added" },
      { id: "createdNewest", label: "Newest Added" }
    ],

    statistics: {
      palettes: [
        "#dfe9ff",
        "#a7c3ff",
        "#86a7ff",
        "#8ad7ff",
        "#c6b0ff",
        "#ffd7c3",
        "#b5ffd8",
        "#f0c7ff"
      ]
    }
  };

  const ArchiveUtil = {
    id(prefix = "id") {
      return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    },

    now() {
      return new Date().toISOString();
    },

    clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    },

    average(list) {
      const numeric = list.filter(value => typeof value === "number" && Number.isFinite(value));
      if (!numeric.length) return null;
      return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
    },

    hashString(input = "") {
      let h = 2166136261;
      for (let i = 0; i < input.length; i++) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    },

    seeded(seed) {
      let t = seed >>> 0;
      return () => {
        t += 0x6D2B79F5;
        let s = t;
        s = Math.imul(s ^ (s >>> 15), s | 1);
        s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
        return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
      };
    },

    parseCSV(text) {
      return String(text || "")
        .split(",")
        .map(x => x.trim())
        .filter(Boolean);
    }
  };

  const ARCHIVE_STATISTICS = {
    datasets: [
      { id: "watchTime", label: "Total Watch Time" },
      { id: "mediaBreakdown", label: "Time Breakdown by Media" },
      { id: "genreDistribution", label: "Genre Distribution" },
      { id: "genreOverlap", label: "Genre Overlap" },
      { id: "ratingDistribution", label: "Rating Distribution" },
      { id: "ratingRankings", label: "Highest / Lowest Rated" }
    ],

    charts: [
      { id: "line", label: "Line Graph" },
      { id: "donut", label: "Donut Chart" },
      { id: "stackedBar", label: "Stacked Bar Chart" },
      { id: "treemap", label: "Treemap" },
      { id: "radar", label: "Radar Chart" },
      { id: "venn", label: "Venn Diagram" },
      { id: "upset", label: "UpSet Plot" },
      { id: "chord", label: "Chord Diagram" },
      { id: "network", label: "Network Graph" },
      { id: "histogram", label: "Histogram" },
      { id: "boxPlot", label: "Box and Whisker Plot" },
      { id: "rankedBar", label: "Ranked Horizontal Bar Chart" },
      { id: "scatter", label: "Scatter Plot" }
    ],

    map: {
      watchTime: ["line", "stackedBar"],
      mediaBreakdown: ["donut", "stackedBar", "treemap", "rankedBar"],
      genreDistribution: ["donut", "treemap", "radar", "rankedBar", "network"],
      genreOverlap: ["venn", "upset", "chord", "network"],
      ratingDistribution: ["histogram", "boxPlot", "scatter"],
      ratingRankings: ["rankedBar", "scatter", "line"]
    },

    compatible(datasetId, chartId) {
      return (this.map[datasetId] || []).includes(chartId);
    },

    chartsFor(datasetId) {
      const ids = this.map[datasetId] || [];
      return this.charts.filter(chart => ids.includes(chart.id));
    },

    defaultChart(datasetId) {
      return (this.map[datasetId] || [])[0] || "line";
    }
  };

  class ArchiveStore {
    constructor() {
      this.key = "watchArchiveData_v5";
      this.subscribers = new Set();
      this.data = this.defaultData();
      this.load();
    }

    defaultData() {
      return {
        groups: [],
        productions: [],
        seasons: [],
        episodes: [],
        watchlist: [],
        preferences: {
          librarySort: "alphabetical",
          libraryVisibility: {
            group: true,
            production: true,
            season: false,
            episode: false
          },
          statisticsDataset: "watchTime",
          statisticsChart: "line"
        }
      };
    }

    subscribe(callback) {
      this.subscribers.add(callback);
      return () => this.subscribers.delete(callback);
    }

    notify() {
      this.subscribers.forEach(fn => fn(this.data));
    }

    save() {
      localStorage.setItem(this.key, JSON.stringify(this.data));
      this.notify();
      return true;
    }

    load() {
      try {
        const raw = localStorage.getItem(this.key);
        if (!raw) return;
        const fresh = JSON.parse(raw);
        if (!fresh || typeof fresh !== "object") return;

        const merged = {
          ...this.defaultData(),
          ...fresh,
          preferences: {
            ...this.defaultData().preferences,
            ...(fresh.preferences || {}),
            libraryVisibility: {
              ...this.defaultData().preferences.libraryVisibility,
              ...(fresh.preferences?.libraryVisibility || {})
            }
          }
        };

        for (const collection of [merged.groups, merged.productions, merged.seasons]) {
          for (const item of collection) {
            const constellation = item.constellation;
            if (!constellation) continue;
            const first = constellation.stars?.[0];
            if (!first) continue;
            if (constellation.stars.length === 1 && first.x === 0 && first.y === 0) continue;

            constellation.center.x += first.x || 0;
            constellation.center.y += first.y || 0;
            constellation.stars = [{ ...first, x: 0, y: 0 }];
            constellation.count = 1;
            constellation.links = [];
          }
        }

        this.data = merged;
      } catch (error) {
        console.warn("Archive load failed", error);
      }
    }

    exportJSON() {
      return JSON.stringify(this.data, null, 2);
    }

    importJSON(text, mode = "replace") {
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object") return false;
        if (mode === "replace") {
          this.data = {
            ...this.defaultData(),
            ...parsed,
            preferences: {
              ...this.defaultData().preferences,
              ...(parsed.preferences || {}),
              libraryVisibility: {
                ...this.defaultData().preferences.libraryVisibility,
                ...(parsed.preferences?.libraryVisibility || {})
              }
            }
          };
          this.save();
          return true;
        }
      } catch (error) {
        console.warn(error);
      }
      return false;
    }

    all(type) {
      return [...(this.data[this.keyFor(type)] || [])];
    }

    get(type, id) {
      return (this.data[this.keyFor(type)] || []).find(item => item.id === id) || null;
    }

    keyFor(type) {
      const map = {
        group: "groups",
        production: "productions",
        season: "seasons",
        episode: "episodes",
        watchlist: "watchlist"
      };
      return map[type] || type;
    }

    constellationCenter(parentCenter = null, seed = 0, type = "production") {
      const random = ArchiveUtil.seeded(seed);
      if (parentCenter) {
        const radius = type === "season"
          ? 110 + random() * 120
          : 170 + random() * 180;

        const angle = random() * Math.PI * 2;
        return {
          x: parentCenter.x + Math.cos(angle) * radius,
          y: parentCenter.y + Math.sin(angle) * radius
        };
      }

      const spread = 520 + random() * 520;
      const angle = random() * Math.PI * 2;
      const wobble = random() * 140;

      return {
        x: Math.cos(angle) * spread + Math.cos(angle * 2.1) * wobble,
        y: Math.sin(angle) * spread + Math.sin(angle * 1.7) * wobble
      };
    }

    generateConstellation({ type, id, center = null, parentCenter = null }) {
      const config = ARCHIVE_CONFIG.constellation;
      const seed = ArchiveUtil.hashString(id);
      const random = ArchiveUtil.seeded(seed);

      const location = center || this.constellationCenter(parentCenter, seed, type);

      const sizes =
        type === "group"
          ? config.groupStarSize
          : type === "season"
            ? config.seasonStarSize
            : config.productionStarSize;

      const star = {
        id: ArchiveUtil.id("star"),
        x: 0,
        y: 0,
        size: sizes[0] + random() * (sizes[1] - sizes[0]),
        tint: config.colors[Math.floor(random() * config.colors.length)],
        brightness: 0.7 + random() * 0.3,
        twinklePhase: random() * Math.PI * 2
      };

      return {
        center: location,
        count: 1,
        shape: 0,
        rotation: 0,
        stars: [star],
        links: [],
        seed
      };
    }

    normalizeShared(input = {}) {
      const copy = { ...input };
      if ("genres" in copy && typeof copy.genres === "string") {
        copy.genres = ArchiveUtil.parseCSV(copy.genres);
      }
      if ("tags" in copy && typeof copy.tags === "string") {
        copy.tags = ArchiveUtil.parseCSV(copy.tags);
      }
      if ("rating" in copy) {
        if (copy.rating === "" || copy.rating === null || copy.rating === undefined) {
          copy.rating = null;
        } else {
          const parsed = Number(copy.rating);
          copy.rating = Number.isFinite(parsed) ? parsed : null;
        }
      }
      if ("durationMinutes" in copy) {
        const parsed = Number(copy.durationMinutes || 0);
        copy.durationMinutes = Number.isFinite(parsed) ? parsed : 0;
      }
      return copy;
    }

    createGroup(input = {}) {
      const title = String(input.title || "").trim();
      if (!title) return null;

      const id = ArchiveUtil.id("group");
      const record = this.normalizeShared({
        id,
        title,
        bannerImage: input.bannerImage || "",
        genres: input.genres || [],
        tags: input.tags || [],
        notes: input.notes || "",
        createdAt: ArchiveUtil.now(),
        constellation: this.generateConstellation({ type: "group", id })
      });

      this.data.groups.push(record);
      this.save();
      return record;
    }

    createProduction(input = {}) {
      const title = String(input.title || "").trim();
      if (!title) return null;

      const id = ArchiveUtil.id("production");
      const parent = input.groupId ? this.get("group", input.groupId) : null;

      const record = this.normalizeShared({
        id,
        groupId: input.groupId || null,
        title,
        mediaType: input.mediaType || "",
        releaseDate: input.releaseDate || "",
        endDate: input.endDate || "",
        status: input.status || "",
        bannerImage: input.bannerImage || "",
        shelfImage: input.shelfImage || "",
        genres: input.genres || [],
        tags: input.tags || [],
        notes: input.notes || "",
        durationMinutes: input.durationMinutes || 0,
        rating: input.rating ?? null,
        watchedAt: input.watchedAt || "",
        createdAt: ArchiveUtil.now(),
        constellation: this.generateConstellation({
          type: "production",
          id,
          parentCenter: parent?.constellation?.center || null
        })
      });

      this.data.productions.push(record);
      this.save();
      return record;
    }

    createSeason(input = {}) {
      const production = this.get("production", input.productionId);
      if (!production) return null;

      const seasonNumber = input.number === null || input.number === undefined || input.number === ""
        ? null
        : Number(input.number);

      const title = String(input.title || "").trim() || `Season ${seasonNumber || ""}`.trim();
      const id = ArchiveUtil.id("season");

      const record = this.normalizeShared({
        id,
        productionId: production.id,
        title,
        number: seasonNumber,
        releaseDate: input.releaseDate || "",
        endDate: input.endDate || "",
        status: input.status || "",
        notes: input.notes || "",
        createdAt: ArchiveUtil.now(),
        constellation: this.generateConstellation({
          type: "season",
          id,
          parentCenter: production.constellation?.center || null
        })
      });

      this.data.seasons.push(record);
      this.save();
      return record;
    }

    createEpisode(input = {}) {
      const season = this.get("season", input.seasonId);
      if (!season) return null;

      const episodeNumber = input.number === null || input.number === undefined || input.number === ""
        ? null
        : Number(input.number);

      const title = String(input.title || "").trim() || `Episode ${episodeNumber || ""}`.trim();
      const id = ArchiveUtil.id("episode");

      const record = this.normalizeShared({
        id,
        seasonId: season.id,
        title,
        number: episodeNumber,
        durationMinutes: input.durationMinutes || 0,
        rating: input.rating ?? null,
        notes: input.notes || "",
        watchedAt: input.watchedAt || "",
        createdAt: ArchiveUtil.now()
      });

      this.data.episodes.push(record);
      this.save();
      return record;
    }

    addWatchlist(input = {}) {
      const title = String(input.title || "").trim();
      if (!title) return null;
      const record = {
        id: ArchiveUtil.id("watch"),
        title,
        mediaType: input.mediaType || "",
        releaseDate: input.releaseDate || "",
        createdAt: ArchiveUtil.now()
      };
      this.data.watchlist.push(record);
      this.save();
      return record;
    }

    removeWatchlist(id) {
      const before = this.data.watchlist.length;
      this.data.watchlist = this.data.watchlist.filter(item => item.id !== id);
      if (this.data.watchlist.length !== before) {
        this.save();
        return true;
      }
      return false;
    }

    completeWatchlist(id) {
      const item = this.get("watchlist", id);
      if (!item) return null;

      const production = this.createProduction({
        title: item.title,
        mediaType: item.mediaType,
        releaseDate: item.releaseDate
      });

      if (!production) return null;
      this.removeWatchlist(id);
      return production;
    }

    update(type, id, changes = {}) {
      const key = this.keyFor(type);
      const list = this.data[key];
      const index = list.findIndex(item => item.id === id);
      if (index === -1) return null;

      const merged = this.normalizeShared({
        ...list[index],
        ...changes,
        updatedAt: ArchiveUtil.now()
      });

      list[index] = merged;
      this.save();
      return merged;
    }

    delete(type, id) {
      if (type === "group") {
        this.data.productions = this.data.productions.map(production =>
          production.groupId === id ? { ...production, groupId: null } : production
        );
        this.data.groups = this.data.groups.filter(item => item.id !== id);
        this.save();
        return true;
      }

      if (type === "production") {
        const seasons = this.children("production", id);
        seasons.forEach(season => this.delete("season", season.id));
        this.data.productions = this.data.productions.filter(item => item.id !== id);
        this.save();
        return true;
      }

      if (type === "season") {
        this.data.episodes = this.data.episodes.filter(ep => ep.seasonId !== id);
        this.data.seasons = this.data.seasons.filter(item => item.id !== id);
        this.save();
        return true;
      }

      if (type === "episode") {
        this.data.episodes = this.data.episodes.filter(item => item.id !== id);
        this.save();
        return true;
      }

      if (type === "watchlist") {
        return this.removeWatchlist(id);
      }

      return false;
    }

    parent(type, item) {
      if (type === "production" && item.groupId) {
        return this.get("group", item.groupId);
      }
      if (type === "season" && item.productionId) {
        return this.get("production", item.productionId);
      }
      if (type === "episode" && item.seasonId) {
        return this.get("season", item.seasonId);
      }
      return null;
    }

    children(type, id) {
      if (type === "group") {
        return this.all("production").filter(item => item.groupId === id);
      }
      if (type === "production") {
        return this.all("season").filter(item => item.productionId === id);
      }
      if (type === "season") {
        return this.all("episode").filter(item => item.seasonId === id);
      }
      return [];
    }

    calculatedRating(type, item) {
      if (!item) return null;

      if (type === "episode") {
        return item.rating ?? null;
      }

      if (type === "season") {
        const episodes = this.children("season", item.id);
        return ArchiveUtil.average(episodes.map(ep => ep.rating).filter(v => typeof v === "number"));
      }

      if (type === "production") {
        const seasons = this.children("production", item.id);
        if (seasons.length) {
          return ArchiveUtil.average(
            seasons
              .map(season => this.calculatedRating("season", season))
              .filter(v => typeof v === "number")
          );
        }
        return item.rating ?? null;
      }

      if (type === "group") {
        const productions = this.children("group", item.id);
        return ArchiveUtil.average(
          productions
            .map(production => this.calculatedRating("production", production))
            .filter(v => typeof v === "number")
        );
      }

      return null;
    }

    libraryEntries() {
      const visible = this.data.preferences.libraryVisibility;
      let entries = [];

      if (visible.group) {
        entries.push(...this.data.groups.map(item => ({ type: "group", item, rating: this.calculatedRating("group", item) })));
      }
      if (visible.production) {
        entries.push(...this.data.productions.map(item => ({ type: "production", item, rating: this.calculatedRating("production", item) })));
      }
      if (visible.season) {
        entries.push(...this.data.seasons.map(item => ({ type: "season", item, rating: this.calculatedRating("season", item) })));
      }
      if (visible.episode) {
        entries.push(...this.data.episodes.map(item => ({ type: "episode", item, rating: this.calculatedRating("episode", item) })));
      }

      const sort = this.data.preferences.librarySort;

      entries.sort((a, b) => {
        if (sort === "alphabetical") {
          return a.item.title.localeCompare(b.item.title);
        }

        if (sort === "ranking") {
          return (b.rating ?? -Infinity) - (a.rating ?? -Infinity);
        }

        if (sort === "airing") {
          return String(a.item.releaseDate || "").localeCompare(String(b.item.releaseDate || ""));
        }

        if (sort === "medium") {
          return String(a.item.mediaType || a.type).localeCompare(String(b.item.mediaType || b.type));
        }

        if (sort === "createdOldest") {
          return String(a.item.createdAt || "").localeCompare(String(b.item.createdAt || ""));
        }

        if (sort === "createdNewest") {
          return String(b.item.createdAt || "").localeCompare(String(a.item.createdAt || ""));
        }

        return 0;
      });

      return entries;
    }

    setLibraryPreferences({ sort, visibility }) {
      if (sort) {
        this.data.preferences.librarySort = sort;
      }
      if (visibility) {
        this.data.preferences.libraryVisibility = {
          ...this.data.preferences.libraryVisibility,
          ...visibility
        };
      }
      this.save();
    }

    setStatisticsPreferences(datasetId, chartId) {
      this.data.preferences.statisticsDataset = datasetId;
      this.data.preferences.statisticsChart = chartId;
      this.save();
    }

    overview() {
      const watchedMinutes = [
        ...this.data.productions.filter(p => !this.children("production", p.id).length).map(p => Number(p.durationMinutes || 0)),
        ...this.data.episodes.map(ep => Number(ep.durationMinutes || 0))
      ].reduce((sum, value) => sum + value, 0);

      return {
        productions: this.data.productions.length,
        episodes: this.data.episodes.length,
        watchedMinutes,
        ratedProductions: this.data.productions.filter(p => this.calculatedRating("production", p) !== null).length
      };
    }

    mediaTimeBreakdown() {
      const map = new Map();

      for (const production of this.data.productions) {
        if (this.children("production", production.id).length) continue;
        const key = production.mediaType || "Unknown";
        map.set(key, (map.get(key) || 0) + Number(production.durationMinutes || 0));
      }

      for (const episode of this.data.episodes) {
        const season = this.get("season", episode.seasonId);
        const production = season ? this.get("production", season.productionId) : null;
        const key = production?.mediaType || "Series";
        map.set(key, (map.get(key) || 0) + Number(episode.durationMinutes || 0));
      }

      return [...map].map(([label, value]) => ({ label, value }));
    }

    genreDistribution() {
      const map = new Map();
      for (const production of this.data.productions) {
        for (const genre of production.genres || []) {
          map.set(genre, (map.get(genre) || 0) + 1);
        }
      }
      return [...map].map(([label, value]) => ({ label, value }));
    }

    genreIntersections() {
      const sets = new Map();
      for (const production of this.data.productions) {
        const genres = [...new Set(production.genres || [])].sort();
        if (genres.length < 2) continue;
        const key = genres.join("|");
        const current = sets.get(key) || { genres, count: 0 };
        current.count += 1;
        sets.set(key, current);
      }
      return [...sets.values()];
    }

    ratingDistribution() {
      return this.data.productions
        .map(production => ({
          title: production.title,
          rating: this.calculatedRating("production", production),
          releaseDate: production.releaseDate || ""
        }))
        .filter(item => item.rating !== null);
    }

    ranking() {
      return this.ratingDistribution().sort((a, b) => b.rating - a.rating);
    }
  }

  window.SPACE_CONFIG = SPACE_CONFIG;
  window.ARCHIVE_CONFIG = ARCHIVE_CONFIG;
  window.ARCHIVE_STATISTICS = ARCHIVE_STATISTICS;
  window.ArchiveUtil = ArchiveUtil;
  window.WatchArchive = new ArchiveStore();
})();
