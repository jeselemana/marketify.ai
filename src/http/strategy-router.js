import express from "express";
import {
  AssessRequestSchema,
  GenerateRequestSchema,
  RefineRequestSchema,
  SaveStrategyRequestSchema,
  formatValidationError,
} from "../domain/strategy.js";
import { assessBrief, generateStrategy, refineStrategy } from "../services/ai/strategy-service.js";

const activeGenerations = new Map();
const requestWindows = new Map();

function rateLimit(limit, windowMs = 10 * 60 * 1000) {
  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ownerId}:${req.baseUrl}`;
    const history = (requestWindows.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (history.length >= limit) {
      return res.status(429).json({
        error: "Hazırda çox sayda sorğu göndərilib. Bir neçə dəqiqə sonra yenidən yoxla.",
        code: "RATE_LIMITED",
      });
    }
    history.push(now);
    requestWindows.set(key, history);
    return next();
  };
}

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const error = new Error("Invalid request");
    error.code = "VALIDATION_ERROR";
    error.details = formatValidationError(result.error);
    throw error;
  }
  return result.data;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function publicRecord(record) {
  const { ownerId: _ownerId, clientSaveId: _clientSaveId, ...safe } = record;
  return safe;
}

export function createStrategyRouter(repository) {
  const router = express.Router();

  router.use(rateLimit(30));

  router.post(
    "/assess",
    asyncRoute(async (req, res) => {
      const payload = parse(AssessRequestSchema, req.body);
      const assessment = await assessBrief({ ...payload, ownerId: req.ownerId });
      res.json({ assessment });
    }),
  );

  router.post(
    "/generate",
    asyncRoute(async (req, res) => {
      const payload = parse(GenerateRequestSchema, req.body);
      const requestKey = `${req.ownerId}:${payload.idempotencyKey}`;
      let generation = activeGenerations.get(requestKey);
      if (!generation) {
        generation = generateStrategy({ ...payload, ownerId: req.ownerId });
        activeGenerations.set(requestKey, generation);
        generation.then(
          () => setTimeout(() => activeGenerations.delete(requestKey), 60_000).unref(),
          () => activeGenerations.delete(requestKey),
        );
      }
      const strategy = await generation;
      res.json({ strategy });
    }),
  );

  router.post(
    "/refine",
    asyncRoute(async (req, res) => {
      const payload = parse(RefineRequestSchema, req.body);
      const strategy = await refineStrategy(payload, req.ownerId);
      res.json({ strategy });
    }),
  );

  router.post(
    "/save",
    asyncRoute(async (req, res) => {
      const payload = parse(SaveStrategyRequestSchema, req.body);
      const record = await repository.create(payload, req.ownerId);
      res.status(201).json({ strategy: publicRecord(record) });
    }),
  );

  router.post(
    "/:id/refine",
    asyncRoute(async (req, res) => {
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
        const error = new Error("Invalid strategy id");
        error.code = "VALIDATION_ERROR";
        error.details = [{ field: "id", message: "Strategiya ID-si düzgün deyil." }];
        throw error;
      }

      const existing = await repository.getById(req.params.id, req.ownerId);
      if (!existing) return res.status(404).json({ error: "Strategiya tapılmadı.", code: "NOT_FOUND" });

      const payload = parse(RefineRequestSchema, {
        ...req.body,
        brief: existing.brief,
        answers: existing.clarification.answers,
        strategy: existing.strategy,
      });
      const strategy = await refineStrategy(payload, req.ownerId);
      const changeRequest = payload.action === "custom" ? payload.request : payload.action;
      const updated = await repository.appendVersion(req.params.id, req.ownerId, strategy, changeRequest);
      res.json({ strategy: publicRecord(updated) });
    }),
  );

  router.get(
    "/",
    asyncRoute(async (req, res) => {
      const strategies = await repository.list(req.ownerId);
      res.json({ strategies });
    }),
  );

  router.get(
    "/:id",
    asyncRoute(async (req, res) => {
      const record = await repository.getById(req.params.id, req.ownerId);
      if (!record) return res.status(404).json({ error: "Strategiya tapılmadı.", code: "NOT_FOUND" });
      return res.json({ strategy: publicRecord(record) });
    }),
  );

  return router;
}

export function strategyErrorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error.code === "VALIDATION_ERROR") {
    return res.status(400).json({
      error: error.details?.[0]?.message || "Göndərilən məlumatları yoxla.",
      code: error.code,
      details: error.details,
    });
  }

  if (error.code === "AI_NOT_CONFIGURED") {
    return res.status(503).json({
      error: "AI xidməti hələ konfiqurasiya edilməyib. OPENAI_API_KEY əlavə et və yenidən yoxla.",
      code: error.code,
    });
  }

  if (error.status === 401 || error.code === "invalid_api_key") {
    return res.status(503).json({
      error: "OpenAI bağlantısı doğrulanmadı. Serverdəki OPENAI_API_KEY dəyərini yoxla.",
      code: "AI_AUTH_ERROR",
    });
  }

  if (error.status === 429 || error.code === "rate_limit_exceeded") {
    return res.status(429).json({
      error: "AI xidməti hazırda çox məşğuldur. Bir az sonra yenidən yoxla.",
      code: "AI_RATE_LIMITED",
    });
  }

  if (error.code === "AI_INVALID_OUTPUT") {
    return res.status(502).json({
      error: "Strategiya strukturunu tamamlamaq mümkün olmadı. Yenidən cəhd et.",
      code: error.code,
    });
  }

  console.error("Strategy request failed", {
    method: req.method,
    path: req.path,
    code: error.code,
    status: error.status,
    name: error.name,
  });
  return res.status(500).json({
    error: "Marketify hazırda sorğunu tamamlaya bilmədi. Məlumatların qorunub — yenidən cəhd et.",
    code: "STRATEGY_ERROR",
  });
}
