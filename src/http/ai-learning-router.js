import { z } from "zod";
import express from "express";

function filters(query) {
  return {
    from: query.from, to: query.to, mode: query.mode, provider: query.provider, model: query.model,
    taskType: query.taskType, candidateStatus: query.candidateStatus,
    minQuality: query.minQuality === undefined || query.minQuality === "" ? undefined : query.minQuality,
    maxQuality: query.maxQuality === undefined || query.maxQuality === "" ? undefined : query.maxQuality,
    status: query.status,
  };
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const UUID_REGEX = /^[0-9a-f-]{36}$/i;

export function createAiLearningAdminRouter(service) {
  const router = express.Router();
  router.get("/overview", asyncRoute(async (req, res) => res.json(await service.overview(filters(req.query)))));
  router.get("/growth", asyncRoute(async (req, res) => res.json({ points: await service.growth(filters(req.query)) })));
  router.get("/models", asyncRoute(async (req, res) => res.json({ models: await service.modelPerformance(filters(req.query)) })));
  router.get("/tasks", asyncRoute(async (req, res) => res.json({ tasks: await service.taskIntelligence(filters(req.query)) })));
  router.get("/interactions", asyncRoute(async (req, res) => res.json(await service.listInteractions(filters(req.query), req.query.page, req.query.pageSize))));
  router.get("/interactions/:id", asyncRoute(async (req, res) => {
    if (!UUID_REGEX.test(req.params.id)) {
      return res.status(400).json({ error: "İnteraksiya ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
    }
    const item = await service.getInteraction(req.params.id);
    if (!item) return res.status(404).json({ error: "Interaction tapılmadı.", code: "NOT_FOUND" });
    return res.json({ interaction: item });
  }));
  router.get("/candidates", asyncRoute(async (req, res) => res.json(await service.listCandidates(filters(req.query), req.query.page, req.query.pageSize))));
  router.get("/candidates/:id", asyncRoute(async (req, res) => {
    if (!UUID_REGEX.test(req.params.id)) {
      return res.status(400).json({ error: "Namizəd ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
    }
    const item = await service.getCandidate(req.params.id);
    if (!item) return res.status(404).json({ error: "Candidate tapılmadı.", code: "NOT_FOUND" });
    return res.json({ candidate: item });
  }));
  router.post("/candidates/:id/review", asyncRoute(async (req, res) => {
    if (!UUID_REGEX.test(req.params.id)) {
      return res.status(400).json({ error: "Namizəd ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
    }
    if (!z.object({ status: z.enum(["pending", "approved", "rejected"]) }).strict().safeParse(req.body).success) return res.status(400).json({ error: "Yanlış review statusu.", code: "VALIDATION_ERROR" });
    const item = await service.reviewCandidate(req.params.id, req.body.status, req.user.id);
    if (!item) return res.status(404).json({ error: "Candidate tapılmadı.", code: "NOT_FOUND" });
    return res.json({ candidate: item });
  }));
  router.get("/export", asyncRoute(async (req, res) => {
    const content = await service.exportApproved(req.query.format || "openai-chat-jsonl");
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="helmer-training-${new Date().toISOString().slice(0, 10)}.jsonl"`);
    return res.send(content);
  }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("AI learning admin API error:", error.message);
    return res.status(500).json({ error: "AI Learning məlumatı emal edilə bilmədi.", code: "AI_LEARNING_ERROR" });
  });
  return router;
}

const signalRateWindows = new Map();

function createSignalRateLimiter(limit = 60, windowMs = 60 * 1000) {
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "127.0.0.1";
    const key = `signal:${ip}`;
    const now = Date.now();
    const timestamps = (signalRateWindows.get(key) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0] || now;
      const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.set("Retry-After", String(retryAfter));
      res.set("X-RateLimit-Remaining", "0");
      return res.status(429).json({
        error: "Hazırda çox sayda siqnal sorğusu göndərilib. Bir qədər sonra yenidən cəhd edin.",
        code: "RATE_LIMITED",
        retryAfter,
      });
    }

    timestamps.push(now);
    signalRateWindows.set(key, timestamps);
    res.set("X-RateLimit-Remaining", String(limit - timestamps.length));
    return next();
  };
}

setInterval(() => {
  const now = Date.now();
  const windowMs = 60 * 1000;
  for (const [key, timestamps] of signalRateWindows.entries()) {
    const active = timestamps.filter((t) => now - t < windowMs);
    if (active.length === 0) signalRateWindows.delete(key);
    else signalRateWindows.set(key, active);
  }
}, 60 * 1000).unref();

export function createAiLearningSignalRouter(service, options = {}) {
  const router = express.Router();
  const rateLimitMiddleware = options.rateLimit || createSignalRateLimiter();

  router.post("/:interactionId", rateLimitMiddleware, asyncRoute(async (req, res) => {
    if (!UUID_REGEX.test(req.params.interactionId)) {
      return res.status(400).json({ error: "İnteraksiya ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
    }
    const parsed = z.object({ accepted: z.boolean().optional(), regenerated: z.boolean().optional(), edited: z.boolean().optional(), copied: z.boolean().optional(), continuedConversation: z.boolean().optional(), explicitRating: z.enum(['positive','negative']).optional(), timeToNextAction: z.number().finite().min(0).max(86400000).optional() }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: 'VALIDATION_ERROR' });
    const signal = await service.recordSignal(req.params.interactionId, req.ownerId, parsed.data);
    if (!signal) return res.status(404).json({ error: "Interaction tapılmadı.", code: "NOT_FOUND" });
    return res.status(201).json({ signal });
  }));
  return router;
}
