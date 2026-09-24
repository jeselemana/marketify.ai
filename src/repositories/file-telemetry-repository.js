import fs from "node:fs/promises";
import path from "node:path";
import { loadJSONFromR2, saveJSONToR2 } from "../http/r2-storage.js";

export const EMPTY_TELEMETRY_STORE = Object.freeze({
  schemaVersion: 1,
  events: [],
});

const MAX_STORED_EVENTS = 10000;

function normalizeStore(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    schemaVersion: 1,
    events: Array.isArray(source.events) ? source.events : [],
  };
}

export class FileTelemetryRepository {
  constructor(filePath, redis = null, { mirrorToR2 = true } = {}) {
    this.filePath = filePath;
    this.redis = redis;
    this.redisKey = "helmer:store:telemetry:v1";
    this.r2FileName = "telemetry-v1.json";
    this.mirrorToR2 = mirrorToR2;
    this.writeQueue = Promise.resolve();
  }

  async ensure() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, `${JSON.stringify(EMPTY_TELEMETRY_STORE, null, 2)}\n`, "utf8");
    }
  }

  async readStore() {
    if (this.redis?.isReady) {
      try {
        const cached = await this.redis.get(this.redisKey);
        if (cached) return normalizeStore(JSON.parse(cached));
      } catch (error) {
        console.error("Telemetry Redis read error:", error.message);
      }
    }
    if (this.mirrorToR2) {
      try {
        const remote = await loadJSONFromR2(this.r2FileName, null);
        if (remote?.schemaVersion) return normalizeStore(remote);
      } catch (error) {
        console.error("Telemetry R2 read error:", error.message);
      }
    }
    await this.ensure();
    try {
      return normalizeStore(JSON.parse(await fs.readFile(this.filePath, "utf8")));
    } catch (error) {
      if (error instanceof SyntaxError) return normalizeStore(null);
      throw error;
    }
  }

  async update(updater) {
    this.writeQueue = this.writeQueue.then(async () => {
      const store = await this.readStore();
      const result = await updater(store);
      if (store.events.length > MAX_STORED_EVENTS) {
        store.events = store.events.slice(0, MAX_STORED_EVENTS);
      }
      const serialized = `${JSON.stringify(store, null, 2)}\n`;
      await this.ensure();
      await fs.writeFile(this.filePath, serialized, "utf8");
      if (this.redis?.isReady) {
        try {
          await this.redis.set(this.redisKey, JSON.stringify(store));
        } catch (error) {
          console.error("Telemetry Redis write error:", error.message);
        }
      }
      if (this.mirrorToR2) {
        try {
          await saveJSONToR2(this.r2FileName, store);
        } catch (error) {
          console.error("Telemetry R2 write error:", error.message);
        }
      }
      return result;
    });
    return this.writeQueue;
  }

  async recordEvent(event) {
    return this.update((store) => {
      store.events.unshift(event);
      return event;
    });
  }

  async recordEventsBatch(events) {
    if (!Array.isArray(events) || events.length === 0) return [];
    return this.update((store) => {
      store.events.unshift(...events);
      return events;
    });
  }

  async getEventById(id) {
    const store = await this.readStore();
    return store.events.find((e) => e.id === id) || null;
  }

  async listEvents({
    page = 1,
    pageSize = 25,
    mode = "all",
    status = "all",
    model = "all",
    marketMode = "all",
    search = "",
    dateRange = "all",
  } = {}) {
    const store = await this.readStore();
    const now = Date.now();

    let filtered = store.events;

    // Date range filter
    if (dateRange && dateRange !== "all") {
      let cutoff = 0;
      if (dateRange === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        cutoff = start.getTime();
      } else if (dateRange === "24h") {
        cutoff = now - 24 * 60 * 60 * 1000;
      } else if (dateRange === "7d") {
        cutoff = now - 7 * 24 * 60 * 60 * 1000;
      } else if (dateRange === "30d") {
        cutoff = now - 30 * 24 * 60 * 60 * 1000;
      }
      if (cutoff > 0) {
        filtered = filtered.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
      }
    }

    // Mode filter
    if (mode && mode !== "all") {
      filtered = filtered.filter((e) => e.mode === mode);
    }

    // Status filter
    if (status && status !== "all") {
      filtered = filtered.filter((e) => e.status === status);
    }

    // Model filter
    if (model && model !== "all") {
      filtered = filtered.filter((e) => e.model && e.model.toLowerCase().includes(model.toLowerCase()));
    }

    // Market mode filter
    if (marketMode && marketMode !== "all") {
      filtered = filtered.filter((e) => e.marketMode === marketMode);
    }

    // Search query filter
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((e) => {
        const text = [
          e.maskedUserId,
          e.eventType,
          e.mode,
          e.model,
          e.marketMode,
          e.category,
          e.status,
          e.summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      });
    }

    const total = filtered.length;
    const p = Math.max(1, Number(page) || 1);
    const size = Math.max(1, Math.min(100, Number(pageSize) || 25));
    const totalPages = Math.ceil(total / size) || 1;
    const startIdx = (p - 1) * size;
    const items = filtered.slice(startIdx, startIdx + size);

    return {
      items,
      total,
      page: p,
      pageSize: size,
      totalPages,
    };
  }

  async getOverview({ dateRange = "today" } = {}) {
    const store = await this.readStore();
    const now = Date.now();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCutoff = todayStart.getTime();

    const todayEvents = store.events.filter((e) => new Date(e.timestamp).getTime() >= todayCutoff);

    // 1. DAU: Unique masked user IDs with activity today
    const dauUsers = new Set(
      todayEvents
        .map((e) => e.maskedUserId)
        .filter((id) => id && id !== "usr_anon...00")
    );
    const dau = dauUsers.size || (todayEvents.length > 0 ? 1 : 0);

    // 2. Total Strategies Generated
    const totalStrategies = store.events.filter((e) => e.mode === "build" && e.status === "success").length;
    const todayStrategies = todayEvents.filter((e) => e.mode === "build" && e.status === "success").length;

    // 3. Average Model Latency
    const latencyEvents = store.events.filter((e) => Number.isFinite(e.latencyMs) && e.latencyMs > 0);
    const avgLatencyMs = latencyEvents.length
      ? Math.round(latencyEvents.reduce((acc, e) => acc + e.latencyMs, 0) / latencyEvents.length)
      : 0;

    // 4. Daily Estimated API Cost (AZN / USD)
    const todayCostUsd = Number(
      todayEvents.reduce((acc, e) => acc + (Number(e.costUsd) || 0), 0).toFixed(4)
    );
    const todayCostAzn = Number(
      todayEvents.reduce((acc, e) => acc + (Number(e.costAzn) || 0), 0).toFixed(4)
    );
    const allTimeCostUsd = Number(
      store.events.reduce((acc, e) => acc + (Number(e.costUsd) || 0), 0).toFixed(4)
    );
    const allTimeCostAzn = Number(
      store.events.reduce((acc, e) => acc + (Number(e.costAzn) || 0), 0).toFixed(4)
    );

    // 5. Market Mode Ratio (LOCAL_AZ_MODE vs GLOBAL_MODE)
    const marketEvents = store.events.filter(
      (e) => e.marketMode === "LOCAL_AZ_MODE" || e.marketMode === "GLOBAL_MODE"
    );
    const localCount = marketEvents.filter((e) => e.marketMode === "LOCAL_AZ_MODE").length;
    const globalCount = marketEvents.filter((e) => e.marketMode === "GLOBAL_MODE").length;
    const totalMarket = marketEvents.length;
    const localPercent = totalMarket ? Math.round((localCount / totalMarket) * 100) : 50;
    const globalPercent = totalMarket ? 100 - localPercent : 50;

    // 6. Model Load Balance
    const modelStatsMap = new Map();
    for (const event of store.events) {
      if (!event.model) continue;
      const m = event.model;
      const current = modelStatsMap.get(m) || { count: 0, latencies: [], costUsd: 0, costAzn: 0 };
      current.count += 1;
      if (Number.isFinite(event.latencyMs) && event.latencyMs > 0) {
        current.latencies.push(event.latencyMs);
      }
      current.costUsd += Number(event.costUsd) || 0;
      current.costAzn += Number(event.costAzn) || 0;
      modelStatsMap.set(m, current);
    }

    const totalModelRequests = Array.from(modelStatsMap.values()).reduce((sum, item) => sum + item.count, 0) || 1;
    const modelDistribution = Array.from(modelStatsMap.entries())
      .map(([model, stats]) => ({
        model,
        count: stats.count,
        percentage: Number(((stats.count / totalModelRequests) * 100).toFixed(1)),
        avgLatencyMs: stats.latencies.length
          ? Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length)
          : null,
        totalCostUsd: Number(stats.costUsd.toFixed(4)),
        totalCostAzn: Number(stats.costAzn.toFixed(4)),
      }))
      .sort((a, b) => b.count - a.count);

    // 7. Mode Distribution
    const modeCounts = {};
    for (const event of store.events) {
      const modeKey = event.mode || "other";
      modeCounts[modeKey] = (modeCounts[modeKey] || 0) + 1;
    }
    const totalEventsCount = store.events.length || 1;
    const modeDistribution = Object.entries(modeCounts)
      .map(([mode, count]) => ({
        mode,
        count,
        percentage: Number(((count / totalEventsCount) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.count - a.count);

    // 8. 7-Day Trend
    const dailyTrend = [];
    const DAY_MS = 24 * 60 * 60 * 1000;
    for (let i = 6; i >= 0; i--) {
      const dayStart = todayCutoff - i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const dayDate = new Date(dayStart);
      const isoDate = dayDate.toISOString().slice(0, 10);
      const dayEvents = store.events.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return t >= dayStart && t < dayEnd;
      });
      const costUsd = Number(dayEvents.reduce((acc, e) => acc + (Number(e.costUsd) || 0), 0).toFixed(4));
      const costAzn = Number(dayEvents.reduce((acc, e) => acc + (Number(e.costAzn) || 0), 0).toFixed(4));
      dailyTrend.push({
        date: isoDate,
        label: i === 0 ? "Bugün" : `${dayDate.getDate()}/${dayDate.getMonth() + 1}`,
        count: dayEvents.length,
        strategies: dayEvents.filter((e) => e.mode === "build").length,
        askQueries: dayEvents.filter((e) => e.mode === "ask").length,
        costUsd,
        costAzn,
      });
    }

    return {
      dau,
      totalStrategies,
      todayStrategies,
      avgLatencyMs,
      todayCostUsd,
      todayCostAzn,
      allTimeCostUsd,
      allTimeCostAzn,
      totalEvents: store.events.length,
      marketDistribution: {
        localCount,
        globalCount,
        localPercent,
        globalPercent,
      },
      modelDistribution,
      modeDistribution,
      dailyTrend,
      timestamp: new Date().toISOString(),
    };
  }
}
