import express from "express";
import {
  AssessRequestSchema,
  GenerateRequestSchema,
  RefineRequestSchema,
  SaveStrategyRequestSchema,
  formatValidationError,
} from "../domain/strategy.js";
import { assessBrief, refineStrategy, streamStrategy } from "../services/ai/strategy-service.js";
import { parseStreamedStrategy } from "../services/ai/provider-router.js";
import { buildPersonalizationContext } from "../services/ai/personal-context.js";

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
      const assessment = await assessBrief({ ...payload, ownerId: req.ownerId, personalizationContext, signal: abortController.signal });
      if (!res.writableEnded) {
        res.json({ assessment });
      }
    }),
  );

  router.post(
    "/generate",
    asyncRoute(async (req, res) => {
      const payload = parse(GenerateRequestSchema, req.body);
      const abortController = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) abortController.abort();
      });
      const personalizationContext = await buildPersonalizationContext({
        user: req.user,
        userMessage: payload.brief,
        mode: "strategy",
      });

      // Opening the upstream stream happens before SSE headers are committed.
      // Provider 429/503 failures can therefore retain their real HTTP status
      // and JSON body instead of turning into a misleading 200 response.
      const upstream = await streamStrategy({
        ...payload,
        ownerId: req.ownerId,
        personalizationContext,
        signal: abortController.signal,
      });
      const wantsStream = req.headers.accept?.includes("text/event-stream") || req.body.stream === true;
      let streamedText = "";
      let finishReason = "stop";

      if (wantsStream) {
        res.set({
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "Content-Encoding": "identity",
        });
        if (typeof res.flushHeaders === "function") res.flushHeaders();
        res.write(`event: ready\ndata: ${JSON.stringify({ model: upstream.model, provider: upstream.provider })}\n\n`);
        if (typeof res.flush === "function") res.flush();
      }

      try {
        for await (const event of upstream.events) {
          if (event.type === "delta") {
            streamedText += event.delta;
            if (wantsStream && !res.destroyed) {
              res.write(`event: delta\ndata: ${JSON.stringify({ chunk: event.delta })}\n\n`);
              if (typeof res.flush === "function") res.flush();
            }
          } else if (event.type === "done") {
            finishReason = event.finishReason || "stop";
          }
        }

        if (["max_output_tokens", "max_tokens"].includes(finishReason)) {
          if (wantsStream && !res.destroyed) {
            res.write(`event: incomplete\ndata: ${JSON.stringify({
              code: "AI_MAX_TOKENS",
              finishReason,
              message: "Model çıxış limitinə çatdı. Davam et seçərək strategiyanı tamamla.",
            })}\n\n`);
            return res.end();
          }
          const error = new Error("Model çıxış limitinə çatdı. Davam et seçərək strategiyanı tamamla.");
          error.code = "AI_MAX_TOKENS";
          error.status = 409;
          throw error;
        }

        const strategy = parseStreamedStrategy(streamedText);
        const now = new Date().toISOString();
        await repository.create(
          {
            clientSaveId: payload.idempotencyKey,
            brief: payload.brief,
            answers: payload.answers,
            strategy,
            versions: [{ versionNumber: 1, data: strategy, changeRequest: "İlkin strategiya", createdAt: now }],
          },
          req.ownerId,
        );

        if (wantsStream && !res.destroyed) {
          res.write(`event: complete\ndata: ${JSON.stringify({
            strategy,
            model: upstream.model,
            provider: upstream.provider,
            finishReason,
          })}\n\n`);
          return res.end();
        }
        if (!res.writableEnded) res.json({ strategy, model: upstream.model, finishReason });
      } catch (error) {
        if (error.name === "AbortError" || abortController.signal.aborted) return;
        if (!wantsStream || !res.headersSent) throw error;
        if (!res.destroyed) {
          res.write(`event: error\ndata: ${JSON.stringify({
            error: error.message || "Generasiya zamanı xəta baş verdi.",
            code: error.code || "AI_PROVIDER_ERROR",
            status: error.status || 502,
            provider: error.provider || upstream.provider,
          })}\n\n`);
          res.end();
        }
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
      const personalizationContext = await buildPersonalizationContext({
        user: req.user,
        userMessage: payload.brief || payload.request || "",
        mode: "strategy",
      });
      const strategy = await refineStrategy(payload, req.ownerId, abortController.signal, personalizationContext);
      if (!res.writableEnded) {
        res.json({ strategy });
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
      error: error.message || "AI xidməti hələ konfiqurasiya edilməyib.",
      code: error.code,
    });
  }

  if (error.code === "AI_MODEL_UNSUPPORTED") {
    return res.status(400).json({ error: error.message, code: error.code });
  }

  if (error.code === "AI_SERVICE_UNAVAILABLE") {
    return res.status(503).json({ error: error.message, code: error.code });
  }

  if (error.code === "AI_PROVIDER_ERROR") {
    return res.status(error.status >= 400 ? error.status : 502).json({
      error: error.message,
      code: error.code,
      provider: error.provider,
    });
  }

  if (error.code === "AI_AUTH_ERROR") {
    return res.status(503).json({ error: error.message, code: error.code, provider: error.provider });
  }

  if (error.code === "AI_MAX_TOKENS") {
    return res.status(409).json({ error: error.message, code: error.code, finishReason: "max_output_tokens" });
  }

  if (error.status === 401 || error.code === "invalid_api_key") {
    return res.status(503).json({
      error: "OpenAI bağlantısı doğrulanmadı. Serverdəki OPENAI_API_KEY dəyərini yoxla.",
      code: "AI_AUTH_ERROR",
    });
  }

  if (error.status === 429 || error.code === "rate_limit_exceeded") {
    return res.status(429).json({
      error: error.message || "AI xidməti hazırda çox məşğuldur. Bir az sonra yenidən yoxla.",
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
