import express from "express";
import {
  AssessRequestSchema,
  GenerateRequestSchema,
  RefineRequestSchema,
  SaveStrategyRequestSchema,
  formatValidationError,
} from "../domain/strategy.js";
import { assessBrief, generateStrategy, refineStrategy } from "../services/ai/strategy-service.js";
import { buildPersonalizationContext } from "../services/ai/personal-context.js";

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
      const abortController = new AbortController();
      req.on("close", () => {
        if (!res.writableEnded) abortController.abort();
      });
      const payload = parse(AssessRequestSchema, req.body);
      const personalizationContext = await buildPersonalizationContext({
        user: req.user,
        userMessage: payload.brief,
        mode: "strategy",
      });
      const assessment = await assessBrief({
        ...payload,
        ownerId: req.ownerId,
        personalizationContext,
        signal: abortController.signal,
      });
      if (!res.writableEnded) {
        res.json({ assessment });
      }
    }),
  );

  router.post(
    "/generate",
    asyncRoute(async (req, res) => {
      const abortController = new AbortController();
      req.on("close", () => {
        if (!res.writableEnded) abortController.abort();
      });

      const payload = parse(GenerateRequestSchema, req.body);
      const isStream = req.body.stream === true || req.headers.accept?.includes("text/event-stream");

      if (isStream) {
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.setHeader("Content-Encoding", "identity");
        if (typeof res.flushHeaders === "function") res.flushHeaders();

        try {
          const personalizationContext = await buildPersonalizationContext({
            user: req.user,
            userMessage: payload.brief,
            mode: "strategy",
          });

          const strategy = await generateStrategy({
            ...payload,
            ownerId: req.ownerId,
            personalizationContext,
            signal: abortController.signal,
            onChunk: ({ chunk, finishReason, model }) => {
              if (res.writableEnded) return;
              res.write(`data: ${JSON.stringify({ chunk, finishReason, model })}\n\n`);
              if (typeof res.flush === "function") res.flush();
            },
          });

          // Auto-save strategy to repository
          try {
            const now = new Date().toISOString();
            await repository.create(
              {
                clientSaveId: payload.idempotencyKey,
                brief: payload.brief,
                answers: payload.answers,
                strategy,
                versions: [
                  {
                    versionNumber: 1,
                    data: strategy,
                    changeRequest: "İlkin strategiya",
                    createdAt: now,
                  },
                ],
              },
              req.ownerId,
            );
          } catch (saveErr) {
            console.error("Auto-save on server failed:", saveErr);
          }

          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ done: true, strategy, model: payload.model, finishReason: "STOP" })}\n\n`);
            if (typeof res.flush === "function") res.flush();
            return res.end();
          }
        } catch (err) {
          if (res.writableEnded) return;
          console.error("Strategy generation stream error:", err.message);
          const statusCode = err.status || 500;
          const errorCode = err.code || "STRATEGY_STREAM_ERROR";
          res.write(`data: ${JSON.stringify({ error: err.message || "Generasiya zamanı xəta baş verdi", code: errorCode, status: statusCode, partialText: err.partialText })}\n\n`);
          if (typeof res.flush === "function") res.flush();
          return res.end();
        }
        return;
      }

      const requestKey = `${req.ownerId}:${payload.idempotencyKey}:${payload.model}`;
      let generation = activeGenerations.get(requestKey);
      if (!generation) {
        generation = (async () => {
          const personalizationContext = await buildPersonalizationContext({
            user: req.user,
            userMessage: payload.brief,
            mode: "strategy",
          });
          const strategy = await generateStrategy({
            ...payload,
            ownerId: req.ownerId,
            personalizationContext,
            signal: abortController.signal,
          });

          try {
            const now = new Date().toISOString();
            await repository.create(
              {
                clientSaveId: payload.idempotencyKey,
                brief: payload.brief,
                answers: payload.answers,
                strategy,
                versions: [
                  {
                    versionNumber: 1,
                    data: strategy,
                    changeRequest: "İlkin strategiya",
                    createdAt: now,
                  },
                ],
              },
              req.ownerId,
            );
          } catch (saveErr) {
            console.error("Auto-save on server failed:", saveErr);
          }
          return strategy;
        })();

        activeGenerations.set(requestKey, generation);
        generation.then(
          () => setTimeout(() => activeGenerations.delete(requestKey), 15 * 60 * 1000).unref(),
          () => activeGenerations.delete(requestKey),
        );
      }

      const strategy = await generation;
      if (!res.writableEnded) {
        res.json({ strategy, model: payload.model });
      }
    }),
  );

  router.post(
    "/refine",
    asyncRoute(async (req, res) => {
      const abortController = new AbortController();
      req.on("close", () => {
        if (!res.writableEnded) abortController.abort();
      });
      const payload = parse(RefineRequestSchema, req.body);
      const isStream = req.body.stream === true || req.headers.accept?.includes("text/event-stream");

      const personalizationContext = await buildPersonalizationContext({
        user: req.user,
        userMessage: payload.brief || payload.request || "",
        mode: "strategy",
      });

      if (isStream) {
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.setHeader("Content-Encoding", "identity");
        if (typeof res.flushHeaders === "function") res.flushHeaders();

        try {
          const strategy = await refineStrategy(
            payload,
            req.ownerId,
            abortController.signal,
            personalizationContext,
            ({ chunk, finishReason, model }) => {
              if (res.writableEnded) return;
              res.write(`data: ${JSON.stringify({ chunk, finishReason, model })}\n\n`);
              if (typeof res.flush === "function") res.flush();
            },
          );

          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ done: true, strategy, model: payload.model, finishReason: "STOP" })}\n\n`);
            if (typeof res.flush === "function") res.flush();
            return res.end();
          }
        } catch (err) {
          if (res.writableEnded) return;
          console.error("Refine stream error:", err.message);
          res.write(`data: ${JSON.stringify({ error: err.message || "Dəqiqləşdirmə zamanı xəta baş verdi", code: err.code || "REFINE_ERROR", status: err.status || 500 })}\n\n`);
          if (typeof res.flush === "function") res.flush();
          return res.end();
        }
        return;
      }

      const strategy = await refineStrategy(payload, req.ownerId, abortController.signal, personalizationContext);
      if (!res.writableEnded) {
        res.json({ strategy, model: payload.model });
      }
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
      const personalizationContext = await buildPersonalizationContext({
        user: req.user,
        userMessage: payload.brief || payload.request || "",
        mode: "strategy",
      });
      const strategy = await refineStrategy(payload, req.ownerId, undefined, personalizationContext);
      const changeRequest = payload.action === "custom" ? payload.request : payload.action;
      const updated = await repository.appendVersion(req.params.id, req.ownerId, strategy, changeRequest);
      res.json({ strategy: publicRecord(updated), model: payload.model });
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
      error: error.message || "AI xidməti hələ konfiqurasiya edilməyib. API açarını əlavə et və yenidən yoxla.",
      code: error.code,
      model: error.model,
    });
  }

  if (error.status === 401 || error.code === "invalid_api_key" || error.code === "AI_AUTH_ERROR") {
    return res.status(503).json({
      error: error.message || "AI bağlantısı doğrulanmadı. Serverdəki API açarını yoxla.",
      code: "AI_AUTH_ERROR",
      model: error.model,
    });
  }

  if (error.status === 429 || error.code === "rate_limit_exceeded" || error.code === "AI_RATE_LIMITED") {
    return res.status(429).json({
      error: error.message || "AI xidməti hazırda çox məşğuldur (429). Bir az sonra yenidən yoxla.",
      code: "AI_RATE_LIMITED",
      model: error.model,
    });
  }

  if (error.code === "AI_MAX_TOKENS") {
    return res.status(422).json({
      error: error.message || "Strategiya generasiyası token limitinə görə yarımçıq qaldı.",
      code: "AI_MAX_TOKENS",
      model: error.model,
      partialText: error.partialText,
    });
  }

  if (error.code === "AI_INVALID_OUTPUT") {
    return res.status(502).json({
      error: error.message || "Strategiya strukturunu tamamlamaq mümkün olmadı. Yenidən cəhd et.",
      code: error.code,
      model: error.model,
    });
  }

  console.error("Strategy request failed", {
    method: req.method,
    path: req.path,
    code: error.code,
    status: error.status,
    name: error.name,
    message: error.message,
  });

  return res.status(error.status || 500).json({
    error: error.message || "Marketify hazırda sorğunu tamamlaya bilmədi. Məlumatların qorunub — yenidən cəhd et.",
    code: error.code || "STRATEGY_ERROR",
    model: error.model,
  });
}

