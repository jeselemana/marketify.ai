import express from "express";
import {
  AssessRequestSchema,
  GenerateRequestSchema,
  RefineRequestSchema,
  SaveStrategyRequestSchema,
  formatValidationError,
} from "../domain/strategy.js";
import { assessBrief, generateStrategy, refineStrategy } from "../services/ai/strategy-service.js";
import { buildStrategyPersonalizationContext } from "../services/ai/personal-context.js";
import { aiConfig } from "../services/ai/config.js";
import { logWithoutBlocking } from "../services/learning/learning-loop-service.js";

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

async function runTrackedBuild({ learningLoop, ownerId, taskType, userPrompt, relevantContext, execute }) {
  if (!learningLoop) return { result: await execute(() => {}), interactionId: null };
  const interactionId = learningLoop.createInteractionId();
  const startedAt = Date.now();
  let providerMeta = { provider: "openai", model: aiConfig.strategyModel, usage: null };
  try {
    const result = await execute((meta) => { providerMeta = { ...providerMeta, ...meta }; });
    logWithoutBlocking(learningLoop.recordInteraction({
      id: interactionId, ownerId, mode: "build", taskType, userPrompt, relevantContext,
      modelProvider: providerMeta.provider, modelName: providerMeta.model, modelResponse: result,
      usage: providerMeta.usage, latencyMs: Date.now() - startedAt, requestStatus: "success",
    }), `Build ${taskType} logging`);
    return { result, interactionId, providerMeta };
  } catch (error) {
    logWithoutBlocking(learningLoop.recordInteraction({
      id: interactionId, ownerId, mode: "build", taskType, userPrompt, relevantContext,
      modelProvider: providerMeta.provider, modelName: providerMeta.model, modelResponse: "",
      usage: providerMeta.usage, latencyMs: Date.now() - startedAt, requestStatus: "error",
      errorType: error?.code || error?.name || "BUILD_ERROR",
    }), `Build ${taskType} failure logging`);
    throw error;
  }
}

export function createStrategyRouter(repository, learningLoop = null) {
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
      const personalizationContext = buildStrategyPersonalizationContext({
        user: req.user,
      });
      const tracked = await runTrackedBuild({
        learningLoop, ownerId: req.ownerId, taskType: "build_assess", userPrompt: payload.brief,
        relevantContext: { personalizationApplied: Boolean(personalizationContext) },
        execute: (onUsage) => assessBrief({ ...payload, ownerId: req.ownerId, personalizationContext, signal: abortController.signal, onUsage }),
      });
      const assessment = tracked.result;
      if (!res.writableEnded) {
        res.json({ assessment });
      }
    }),
  );

  router.post(
    "/generate",
    asyncRoute(async (req, res) => {
      const payload = parse(GenerateRequestSchema, req.body);
      const requestKey = `${req.ownerId}:${payload.idempotencyKey}`;
      
      let generation = activeGenerations.get(requestKey);
      if (!generation) {
        generation = (async () => {
          const personalizationContext = buildStrategyPersonalizationContext({
            user: req.user,
          });
          const tracked = await runTrackedBuild({
            learningLoop, ownerId: req.ownerId, taskType: "build_generate", userPrompt: payload.brief,
            relevantContext: { personalizationApplied: Boolean(personalizationContext) },
            execute: (onUsage) => generateStrategy({ ...payload, ownerId: req.ownerId, personalizationContext, onUsage }),
          });
          const strategy = tracked.result;
          // Automatically save completed strategy to server repository so it is never lost if user closes browser
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
                learningInteractionId: tracked.interactionId,
              },
              req.ownerId,
            );
          } catch (saveErr) {
            console.error("Auto-save on server failed:", saveErr);
          }
          return tracked;
        })();

        activeGenerations.set(requestKey, generation);
        generation.then(
          () => setTimeout(() => activeGenerations.delete(requestKey), 15 * 60 * 1000).unref(),
          () => activeGenerations.delete(requestKey),
        );
      }

      const tracked = await generation;
      const strategy = tracked.result;
      if (!res.writableEnded) {
        res.json({ strategy });
      }
    }),
  );

  router.post(
    "/generate-stream",
    asyncRoute(async (req, res) => {
      const payload = parse(GenerateRequestSchema, req.body);
      const abortController = new AbortController();
      req.on("close", () => {
        if (!res.writableEnded) abortController.abort();
      });

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const sendEvent = (data) => {
        if (res.writableEnded) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const personalizationContext = buildStrategyPersonalizationContext({
          user: req.user,
        });

        const tracked = await runTrackedBuild({
          learningLoop, ownerId: req.ownerId, taskType: "build_generate", userPrompt: payload.brief,
          relevantContext: { personalizationApplied: Boolean(personalizationContext) },
          execute: (onUsage) => generateStrategy({
            ...payload, ownerId: req.ownerId, personalizationContext, signal: abortController.signal, onUsage,
            onChunk: ({ chunk, finishReason, model }) => sendEvent({ chunk, finishReason, model }),
          }),
        });
        const strategy = tracked.result;

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
              learningInteractionId: tracked.interactionId,
            },
            req.ownerId,
          );
        } catch (saveErr) {
          console.error("Auto-save on server failed:", saveErr);
        }

        sendEvent({ done: true, strategy });
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (streamError) {
        if (abortController.signal.aborted || streamError.name === "AbortError") {
          return res.end();
        }

        const isRateLimit = streamError.status === 429 || streamError.code === "AI_RATE_LIMITED";
        const isUnavailable = streamError.status === 503 || streamError.code === "AI_PROVIDER_UNAVAILABLE";
        const isAuth = streamError.status === 401 || streamError.code === "AI_AUTH_ERROR";
        const isMaxTokens = streamError.status === 422 || streamError.code === "AI_MAX_TOKENS";

        const errPayload = {
          error: streamError.message || "Strategiya generasiyası uğursuz oldu.",
          code: streamError.code || (isRateLimit ? "AI_RATE_LIMITED" : isUnavailable ? "AI_PROVIDER_UNAVAILABLE" : isMaxTokens ? "AI_MAX_TOKENS" : isAuth ? "AI_AUTH_ERROR" : "STRATEGY_ERROR"),
          status: streamError.status || 500,
          model: streamError.model,
          partialText: streamError.partialText || undefined,
        };

        sendEvent(errPayload);
        res.end();
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
      const personalizationContext = buildStrategyPersonalizationContext({
        user: req.user,
      });
      const tracked = await runTrackedBuild({
        learningLoop, ownerId: req.ownerId, taskType: `build_refine_${payload.action}`, userPrompt: payload.action === "custom" ? payload.request : payload.action,
        relevantContext: { personalizationApplied: Boolean(personalizationContext) },
        execute: (onUsage) => refineStrategy(payload, req.ownerId, abortController.signal, personalizationContext, undefined, onUsage),
      });
      const strategy = tracked.result;
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
      if (learningLoop && payload.acceptForLearning && record.learningInteractionId) {
        const latestVersion = payload.versions.at(-1);
        const learningUpdate = learningLoop.recordSignal(record.learningInteractionId, req.ownerId, { accepted: true })
          .then(() => payload.versions.length > 1 ? learningLoop.recordIteration({
            parentInteractionId: record.learningInteractionId,
            ownerId: req.ownerId,
            modificationRequest: latestVersion.changeRequest,
            response: latestVersion.data,
            modelProvider: "openai",
            modelName: aiConfig.strategyModel,
            finalAccepted: true,
          }) : null);
        logWithoutBlocking(learningUpdate, "Build acceptance logging");
      }
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
      const personalizationContext = buildStrategyPersonalizationContext({
        user: req.user,
      });
      const tracked = await runTrackedBuild({
        learningLoop, ownerId: req.ownerId, taskType: `build_refine_${payload.action}`, userPrompt: payload.action === "custom" ? payload.request : payload.action,
        relevantContext: { resourceId: existing.id, personalizationApplied: Boolean(personalizationContext) },
        execute: (onUsage) => refineStrategy(payload, req.ownerId, undefined, personalizationContext, undefined, onUsage),
      });
      const strategy = tracked.result;
      const changeRequest = payload.action === "custom" ? payload.request : payload.action;
      const updated = await repository.appendVersion(req.params.id, req.ownerId, strategy, changeRequest);
      if (learningLoop && existing.learningInteractionId) {
        logWithoutBlocking(
          learningLoop.recordIteration({
            parentInteractionId: existing.learningInteractionId, interactionId: tracked.interactionId, ownerId: req.ownerId,
            modificationRequest: changeRequest, response: strategy, modelProvider: tracked.providerMeta.provider,
            modelName: tracked.providerMeta.model, finalAccepted: false,
          }),
          "Build iteration logging",
        );
      }
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
      error: error.message || "Seçilmiş AI xidməti hələ konfiqurasiya edilməyib.",
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
      error: error.message || "AI xidmətində sorğu limiti aşılıb (429). Bir az sonra yenidən yoxla.",
      code: "AI_RATE_LIMITED",
      model: error.model,
    });
  }

  if (error.status === 503 || error.code === "AI_PROVIDER_UNAVAILABLE") {
    return res.status(503).json({
      error: error.message || "Seçilmiş AI xidməti hazırda yüksək yüklənmə altındadır (503). Zəhmət olmasa bir az sonra yenidən cəhd edin.",
      code: "AI_PROVIDER_UNAVAILABLE",
      model: error.model,
    });
  }

  if (error.code === "AI_MAX_TOKENS") {
    return res.status(422).json({
      error: error.message || "Strategiya generasiyası token limitinə çatdı.",
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
  return res.status(error.status && error.status < 600 ? error.status : 500).json({
    error: error.message || "Marketify hazırda sorğunu tamamlaya bilmədi. Məlumatların qorunub — yenidən cəhd et.",
    code: error.code || "STRATEGY_ERROR",
    model: error.model,
  });
}
