import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import express from "express";
import { acquireIdempotencyLock } from "./execution-lock.js";
import { httpStatusOf, publicErrorMessage } from "./error-response.js";
import {
  AssessRequestSchema,
  GenerateRequestSchema,
  RefineRequestSchema,
  SaveStrategyRequestSchema,
  StrategySummaryRequestSchema,
  formatValidationError,
} from "../domain/strategy.js";
import {
  assessBrief,
  generateStrategy,
  refineStrategy,
  summarizeStrategyWithLuna,
} from "../services/ai/strategy-service.js";
import { buildStrategyPersonalizationContext } from "../services/ai/personal-context.js";
import { detectTargetMarket } from "../services/ai/prompts.js";
import { aiConfig } from "../services/ai/config.js";
import { logWithoutBlocking } from "../services/learning/learning-loop-service.js";
import { isModelImprovementEnabled } from "./auth-middleware.js";

export function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) {
      sorted[key] = canonicalize(value[key]);
    }
  }
  return sorted;
}

export function computePayloadFingerprint(operation, payload, resourceId = null) {
  const norm = {
    op: operation,
    resId: resourceId || payload?.strategyId || null,
    brief: typeof payload?.brief === "string" ? payload.brief.trim() : "",
    answers: Array.isArray(payload?.answers)
      ? payload.answers.map((a) => ({
          qid: typeof a?.questionId === "string" ? a.questionId.trim() : "",
          q: typeof a?.question === "string" ? a.question.trim() : "",
          a: typeof a?.answer === "string" ? a.answer.trim() : "",
        }))
      : [],
    assumptions: Array.isArray(payload?.assumptions)
      ? payload.assumptions.map((item) => (typeof item === "string" ? item.trim() : ""))
      : [],
    action: payload?.action || null,
    request: typeof payload?.request === "string" ? payload.request.trim() : null,
    language: payload?.language || null,
    autoSave: payload?.autoSave !== undefined ? Boolean(payload.autoSave) : null,
    strategy: payload?.strategy && typeof payload.strategy === "object" ? canonicalize(payload.strategy) : null,
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(norm))).digest("hex");
}

export function computeLegacyPayloadFingerprint(operation, payload, resourceId = null) {
  const norm = {
    op: operation,
    resId: resourceId || null,
    brief: typeof payload?.brief === "string" ? payload.brief.trim() : "",
    answers: Array.isArray(payload?.answers)
      ? payload.answers.map((a) => ({ q: a?.question || "", a: a?.answer || "" }))
      : [],
    action: payload?.action || null,
    request: typeof payload?.request === "string" ? payload.request.trim() : null,
    language: payload?.language || null,
    strategyTitle: payload?.strategy?.title || null,
    targetMarket: payload?.strategy?.targetMarket || null,
  };
  return createHash("sha256").update(JSON.stringify(norm)).digest("hex");
}

const activeGenerations = new Map();
const activeRefinements = new Map();
const requestWindows = new Map();

// Periodic cleanup for requestWindows to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, history] of requestWindows.entries()) {
    const valid = (history || []).filter((timestamp) => now - timestamp < 10 * 60 * 1000);
    if (valid.length === 0) {
      requestWindows.delete(key);
    } else {
      requestWindows.set(key, valid);
    }
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || "127.0.0.1";
}

function rateLimit(limit, windowMs = 10 * 60 * 1000) {
  return (req, res, next) => {
    const now = Date.now();
    const clientIp = getClientIp(req);
    const identifier = req.user?.id ? `user:${req.user.id}` : `ip:${clientIp}`;
    const key = `strat:${identifier}:${req.baseUrl || "/api/strategy"}`;
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

function resolveLanguage(req, payloadLang) {
  if (payloadLang === "en" || payloadLang === "az") return payloadLang;
  const headerLang = req?.headers?.["x-helmer-language"] || req?.headers?.["x-language"];
  if (headerLang === "en" || headerLang === "az") return headerLang;
  if (req?.user?.settings?.language === "en" || req?.user?.settings?.language === "az") {
    return req.user.settings.language;
  }
  const accept = String(req?.headers?.["accept-language"] || "").toLowerCase();
  if (accept.startsWith("en") || accept.includes("en-") || accept.includes("en,")) return "en";
  return "az";
}

async function runTrackedBuild({
  learningLoop,
  telemetryService,
  ownerId,
  taskType,
  userPrompt,
  relevantContext,
  execute,
  onlyNecessaryData = false,
  modelImprovement = true,
}) {
  if (!learningLoop && !telemetryService) return { result: await execute(() => {}), interactionId: null };
  const interactionId = learningLoop ? learningLoop.createInteractionId() : null;
  const startedAt = Date.now();
  let providerMeta = { provider: "google", model: aiConfig.strategyModel, usage: null };
  const isRestricted = onlyNecessaryData || modelImprovement === false;
  try {
    const result = await execute((meta) => { providerMeta = { ...providerMeta, ...meta }; });
    if (learningLoop) {
      logWithoutBlocking(learningLoop.recordInteraction({
        id: interactionId,
        ownerId,
        mode: "build",
        taskType,
        userPrompt: isRestricted ? "[Zəruri əməliyyat qeydi - Məzmun ötürülmür]" : userPrompt,
        relevantContext: isRestricted ? null : relevantContext,
        modelProvider: providerMeta.provider,
        modelName: providerMeta.model,
        modelResponse: isRestricted ? "[Məzmun gizlədilib - Töhfə deaktivdir]" : result,
        usage: providerMeta.usage,
        latencyMs: Date.now() - startedAt,
        requestStatus: "success",
        onlyNecessaryData: isRestricted,
        modelImprovement: !isRestricted,
      }), `Build ${taskType} logging`);
    }
    if (telemetryService) {
      telemetryService.trackBuildStrategy({
        ownerId,
        brief: isRestricted ? "" : userPrompt,
        model: providerMeta.model,
        latencyMs: Date.now() - startedAt,
        usage: providerMeta.usage,
        status: "success",
        strategy: isRestricted ? null : result,
        action: taskType,
        onlyNecessaryData: isRestricted,
        modelImprovement: !isRestricted,
      }).catch(() => {});
    }
    return { result, interactionId, providerMeta };
  } catch (error) {
    if (learningLoop) {
      logWithoutBlocking(learningLoop.recordInteraction({
        id: interactionId,
        ownerId,
        mode: "build",
        taskType,
        userPrompt: isRestricted ? "[Zəruri əməliyyat qeydi - Məzmun ötürülmür]" : userPrompt,
        relevantContext: isRestricted ? null : relevantContext,
        modelProvider: providerMeta.provider,
        modelName: providerMeta.model,
        modelResponse: "",
        usage: providerMeta.usage,
        latencyMs: Date.now() - startedAt,
        requestStatus: "error",
        errorType: error?.code || error?.name || "BUILD_ERROR",
        onlyNecessaryData: isRestricted,
        modelImprovement: !isRestricted,
      }), `Build ${taskType} failure logging`);
    }
    if (telemetryService) {
      telemetryService.trackBuildStrategy({
        ownerId,
        brief: isRestricted ? "" : userPrompt,
        model: providerMeta.model,
        latencyMs: Date.now() - startedAt,
        usage: providerMeta.usage,
        status: "error",
        error,
        action: taskType,
        onlyNecessaryData: isRestricted,
        modelImprovement: !isRestricted,
      }).catch(() => {});
    }
    throw error;
  }
}

export function createStrategyRouter(repository, learningLoop = null, options = {}) {
  const router = express.Router();
  const telemetryService = options?.telemetryService || null;

  router.use(rateLimit(30));

  router.post(
    "/assess",
    asyncRoute(async (req, res) => {
      const payload = parse(AssessRequestSchema, req.body);
      const abortController = new AbortController();
      const onClose = () => {
        if (!res.writableEnded) abortController.abort();
      };
      if (typeof req?.on === "function") req.on("close", onClose);
      if (typeof res?.on === "function") res.on("close", onClose);

      try {
        const language = resolveLanguage(req, payload.language);
        const personalizationContext = buildStrategyPersonalizationContext({
          user: req.user,
        });
        const marketMode = detectTargetMarket({ brief: payload.brief, answers: payload.answers });
        const modelImprovement = isModelImprovementEnabled(req);
        const tracked = await runTrackedBuild({
          learningLoop, telemetryService, ownerId: req.ownerId, taskType: "build_assess", userPrompt: payload.brief,
          relevantContext: { personalizationApplied: Boolean(personalizationContext), language, marketMode },
          execute: (onUsage) => assessBrief({ ...payload, language, ownerId: req.ownerId, personalizationContext, signal: abortController.signal, onUsage }),
          onlyNecessaryData: !modelImprovement,
          modelImprovement,
        });
        const assessment = tracked.result;
        if (!res.writableEnded) {
          res.json({ assessment });
        }
      } finally {
        if (typeof req?.off === "function") req.off("close", onClose);
        if (typeof res?.off === "function") res.off("close", onClose);
      }
    }),
  );

  async function getOrCreateGeneration({
    payload,
    ownerId,
    user,
    req,
    subscriberId = randomUUID(),
    onEntry = null,
    onChunk = null,
  }) {
    const fingerprint = computePayloadFingerprint("generate", payload);
    const requestKey = `${ownerId}:${payload.idempotencyKey}`;

    const findSaved = async () => {
      const tenantRecords = typeof repository.readTenant === "function"
        ? await repository.readTenant(ownerId)
        : await repository.readAll(ownerId);

      const existingSaved = tenantRecords.find((r) => r.clientSaveId === payload.idempotencyKey);
      if (existingSaved) {
        if (existingSaved.payloadFingerprint) {
          const matchesCanonical = existingSaved.payloadFingerprint === fingerprint;
          const matchesLegacy = existingSaved.payloadFingerprint === computeLegacyPayloadFingerprint("generate", payload);
          if (!matchesCanonical && !matchesLegacy) {
            const conflictErr = new Error("Eyni idempotency açarı fərqli parametrlərlə istifadə edilib.");
            conflictErr.code = "IDEMPOTENCY_CONFLICT";
            conflictErr.status = 409;
            throw conflictErr;
          }
        }
        return {
          result: existingSaved.strategy,
          interactionId: existingSaved.learningInteractionId || null,
          savedRecord: existingSaved,
          fromStore: true,
        };
      }

      return null;
    };
    const saved = await findSaved();
    if (saved) return saved;

    // 2. In-process active generation check
    let activeEntry = activeGenerations.get(requestKey);
    if (activeEntry) {
      if (activeEntry.fingerprint !== fingerprint) {
        const conflictErr = new Error("Eyni idempotency açarı fərqli parametrlərlə icra edilir.");
        conflictErr.code = "IDEMPOTENCY_CONFLICT";
        conflictErr.status = 409;
        throw conflictErr;
      }
      activeEntry.subscribers.add(subscriberId);
      if (onChunk) {
        activeEntry.onChunkListeners.set(subscriberId, onChunk);
      }
      if (onEntry) onEntry(activeEntry);
      return activeEntry.promise;
    }

    // 3. Acquire distributed / cross-process lock
    const redis = options?.redis || repository?.redis || null;
    const locksDir = repository?.strategiesDir
      ? path.join(path.dirname(repository.strategiesDir), ".strategy-locks")
      : null;

    let distLock = await acquireIdempotencyLock({
      ownerId,
      idempotencyKey: payload.idempotencyKey,
      operation: "generate",
      redis,
      locksDir,
      timeoutMs: 120000,
      storage: options.leaseStorage,
    });

    if (!distLock) {
      // Another instance holds the lock! Wait and poll for authoritative result or lock release
      const maxWaitMs = 60000;
      const pollStart = Date.now();
      while (Date.now() - pollStart < maxWaitMs) {
        await new Promise((r) => setTimeout(r, 200));

        const persisted = await findSaved();
        if (persisted) return persisted;

        // Try to acquire lock if previous instance failed or released
        distLock = await acquireIdempotencyLock({
          ownerId,
          idempotencyKey: payload.idempotencyKey,
          operation: "generate",
          redis,
          locksDir,
          timeoutMs: 120000,
          storage: options.leaseStorage,
        });
        if (distLock) break;
      }

      if (!distLock) {
        const timeoutErr = new Error("Strategiya generasiyası başqa proses tərəfindən icra olunur.");
        timeoutErr.code = "EXECUTION_BUSY";
        timeoutErr.status = 429;
        throw timeoutErr;
      }
    }

    // 4. Create in-flight generation with subscriber tracking
    const masterAbortController = new AbortController();
    const generationSignal = AbortSignal.any([masterAbortController.signal, distLock.signal]);
    const subscribers = new Set([subscriberId]);
    const onChunkListeners = new Map();
    if (onChunk) {
      onChunkListeners.set(subscriberId, onChunk);
    }

    const generationPromise = (async () => {
      try {
        // The pre-lock snapshot may have been read before another replica committed.
        const completed = await findSaved();
        if (completed) return completed;
        const cached = await distLock.readResult();
        if (cached) {
          if (cached.fingerprint !== fingerprint) {
            const error = new Error("Eyni idempotency açarı fərqli parametrlərlə istifadə edilib.");
            error.code = "IDEMPOTENCY_CONFLICT";
            error.status = 409;
            throw error;
          }
          return cached.tracked;
        }
        generationSignal.throwIfAborted();
        await distLock.assertOwned();
        const language = resolveLanguage(req, payload.language);
        const personalizationContext = buildStrategyPersonalizationContext({
          user,
        });
        const marketMode = detectTargetMarket({ brief: payload.brief, answers: payload.answers });
        const modelImprovement = isModelImprovementEnabled(req);
        const tracked = await runTrackedBuild({
          learningLoop,
          telemetryService,
          ownerId,
          taskType: "build_generate",
          userPrompt: payload.brief,
          relevantContext: { personalizationApplied: Boolean(personalizationContext), language, marketMode },
          execute: (onUsage) =>
            generateStrategy({
              ...payload,
              language,
              ownerId,
              personalizationContext,
              signal: generationSignal,
              onUsage,
              onChunk: (chunkInfo) => {
                for (const listener of onChunkListeners.values()) {
                  try { listener(chunkInfo); } catch {}
                }
              },
            }),
          onlyNecessaryData: !modelImprovement,
          modelImprovement,
        });

        generationSignal.throwIfAborted();
        await distLock.assertOwned();
        const strategy = tracked.result;
        const shouldAutoSave = payload.autoSave !== undefined
          ? payload.autoSave
          : (user?.settings?.autoSaveStrategies !== false);

        let savedRecord = null;
        if (shouldAutoSave) {
          const now = new Date().toISOString();
          savedRecord = await repository.create(
            {
              clientSaveId: payload.idempotencyKey,
              payloadFingerprint: fingerprint,
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
            ownerId,
          );
          if (!savedRecord) {
            const error = new Error("Tenant was deleted during generation.");
            error.code = "TENANT_DELETED";
            error.status = 404;
            throw error;
          }
        }
        const completedResult = { ...tracked, result: savedRecord?.strategy || tracked.result, savedRecord };
        if (!shouldAutoSave) await distLock.saveResult({ fingerprint, tracked: completedResult });
        return completedResult;
      } finally {
        if (distLock) {
          await distLock.release().catch(() => {});
        }
      }
    })();

    const entry = {
      fingerprint,
      promise: generationPromise,
      masterAbortController,
      subscribers,
      onChunkListeners,
    };

    activeGenerations.set(requestKey, entry);
    if (onEntry) onEntry(entry);

    generationPromise.then(
      () => setTimeout(() => activeGenerations.delete(requestKey), 15 * 60 * 1000).unref(),
      () => activeGenerations.delete(requestKey),
    );

    return generationPromise;
  }

  router.post(
    "/generate",
    asyncRoute(async (req, res) => {
      const payload = parse(GenerateRequestSchema, req.body);
      const subscriberId = randomUUID();
      let entry = null, disconnected = false;
      const onClose = () => {
        disconnected = true;
        entry?.subscribers.delete(subscriberId);
        if (entry?.subscribers.size === 0) entry.masterAbortController.abort();
      };
      req.on?.("close", onClose);
      res.on?.("close", onClose);
      try {
        const tracked = await getOrCreateGeneration({
          payload, ownerId: req.ownerId, user: req.user, req, subscriberId,
          onEntry: value => { entry = value; if (disconnected) onClose(); },
        });
        if (!disconnected && !res.writableEnded && !res.destroyed) {
          const savedRecord = tracked.savedRecord || null;
          res.json({
            strategy: tracked.result,
            savedStrategy: savedRecord ? publicRecord(savedRecord) : null,
            savedId: savedRecord ? savedRecord.id : null,
          });
        }
      } finally {
        req.off?.("close", onClose);
        res.off?.("close", onClose);
        onClose();
      }
    }),
  );

  router.post(
    "/generate-stream",
    asyncRoute(async (req, res) => {
      const payload = parse(GenerateRequestSchema, req.body);
      const subscriberId = randomUUID();
      let generationEntry = null;
      let disconnected = false;

      const onClose = () => {
        disconnected = true;
        if (generationEntry) {
          generationEntry.subscribers?.delete(subscriberId);
          generationEntry.onChunkListeners?.delete(subscriberId);
          if (generationEntry.subscribers?.size === 0) {
            generationEntry.masterAbortController?.abort();
          }
        }
      };

      if (typeof req?.on === "function") req.on("close", onClose);
      if (typeof res?.on === "function") res.on("close", onClose);

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const heartbeat = setInterval(() => {
        if (!res.writableEnded && !res.destroyed) {
          res.write(": keepalive\n\n");
          if (typeof res.flush === "function") res.flush();
        }
      }, 15000);

      const sendEvent = (data) => {
        if (res.writableEnded) return;
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const tracked = await getOrCreateGeneration({
          payload,
          ownerId: req.ownerId,
          user: req.user,
          req,
          subscriberId,
          onEntry: (entry) => { generationEntry = entry; if (disconnected) onClose(); },
          onChunk: ({ chunk, finishReason, model }) => sendEvent({ chunk, finishReason, model }),
        });
        const strategy = tracked.result;
        const savedRecord = tracked.savedRecord || null;

        sendEvent({
          done: true,
          strategy,
          savedStrategy: savedRecord ? publicRecord(savedRecord) : null,
          savedId: savedRecord ? savedRecord.id : null,
        });
        res.write("data: [DONE]\n\n");
        res.end();
      } catch (streamError) {
        if (streamError.name === "AbortError" || generationEntry?.masterAbortController?.signal?.aborted) {
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
      } finally {
        clearInterval(heartbeat);
        if (typeof req?.off === "function") req.off("close", onClose);
        if (typeof res?.off === "function") res.off("close", onClose);
        onClose();
      }
    }),
  );

  router.post(
    "/refine",
    asyncRoute(async (req, res) => {
      const payload = parse(RefineRequestSchema, req.body);
      const abortController = new AbortController();
      const onClose = () => {
        if (!res.writableEnded) abortController.abort();
      };
      if (typeof req?.on === "function") req.on("close", onClose);
      if (typeof res?.on === "function") res.on("close", onClose);

      const fingerprint = computePayloadFingerprint("refine", payload);
      const refineKey = payload.idempotencyKey ? `${req.ownerId}:${payload.idempotencyKey}` : null;

      try {
        if (refineKey && activeRefinements.has(refineKey)) {
          const entry = activeRefinements.get(refineKey);
          if (entry.fingerprint && entry.fingerprint !== fingerprint) {
            const conflictErr = new Error("Eyni idempotency açarı fərqli parametrlərlə istifadə edilib.");
            conflictErr.code = "IDEMPOTENCY_CONFLICT";
            conflictErr.status = 409;
            throw conflictErr;
          }
          const result = await entry.promise;
          if (!res.writableEnded) {
            res.json(result);
          }
          return;
        }

        const executeRefine = async () => {
          const language = resolveLanguage(req, payload.language);
          const personalizationContext = buildStrategyPersonalizationContext({
            user: req.user,
          });
          const marketMode = detectTargetMarket({ brief: payload.brief, answers: payload.answers, strategy: payload.strategy });
          const modelImprovement = isModelImprovementEnabled(req);
          const tracked = await runTrackedBuild({
            learningLoop, telemetryService, ownerId: req.ownerId, taskType: `build_refine_${payload.action}`, userPrompt: payload.action === "custom" ? payload.request : payload.action,
            relevantContext: { personalizationApplied: Boolean(personalizationContext), language, marketMode },
            execute: (onUsage) => refineStrategy({ ...payload, language }, req.ownerId, abortController.signal, personalizationContext, undefined, onUsage),
            onlyNecessaryData: !modelImprovement,
            modelImprovement,
          });
          return { strategy: tracked.result };
        };

        const refinePromise = executeRefine();
        if (refineKey) {
          activeRefinements.set(refineKey, { promise: refinePromise, fingerprint, abortController });
          refinePromise.then(
            () => setTimeout(() => activeRefinements.delete(refineKey), 5 * 60 * 1000).unref(),
            () => activeRefinements.delete(refineKey),
          );
        }

        const result = await refinePromise;
        if (!res.writableEnded) {
          res.json(result);
        }
      } finally {
        if (typeof req?.off === "function") req.off("close", onClose);
        if (typeof res?.off === "function") res.off("close", onClose);
      }
    }),
  );

  const handleSummary = asyncRoute(async (req, res) => {
    const payload = parse(StrategySummaryRequestSchema, req.body);
    const abortController = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) abortController.abort();
    };
    if (typeof req?.on === "function") req.on("close", onClose);
    if (typeof res?.on === "function") res.on("close", onClose);

    try {
      const language = resolveLanguage(req, payload.language);
      let strategy = payload.strategy;

      // Tenant isolation & IDOR check: If strategyId is provided, enforce ownerId match (Rule 3)
      if (payload.strategyId) {
        const existing = await repository.getById(payload.strategyId, req.ownerId);
        if (!existing) {
          return res.status(404).json({ error: "Strategiya tapılmadı.", code: "NOT_FOUND" });
        }
        if (!strategy) {
          strategy = existing.strategy;
        }
      }

      if (!strategy) {
        return res.status(400).json({ error: "Strategiya məlumatı tələb olunur.", code: "VALIDATION_ERROR" });
      }

      const client = options.openAiClient || options.client || null;
      const summaryStartedAt = Date.now();
      let summaryUsage = null;

      const summary = await summarizeStrategyWithLuna({
        strategy,
        language,
        client,
        signal: abortController.signal,
        onUsage: (u) => { summaryUsage = u; },
      });

      const modelImprovement = isModelImprovementEnabled(req);
      if (telemetryService) {
        telemetryService.trackSummary({
          ownerId: req.ownerId,
          sessionId: req.guestOwnerId,
          model: aiConfig.strategySummaryModel || "gpt-5.6-luna",
          latencyMs: Date.now() - summaryStartedAt,
          usage: summaryUsage,
          status: "success",
          onlyNecessaryData: !modelImprovement,
          modelImprovement,
        }).catch(() => {});
      }

      if (!res.writableEnded) {
        res.json({ summary });
      }
    } catch (summaryErr) {
      const modelImprovement = isModelImprovementEnabled(req);
      if (telemetryService) {
        telemetryService.trackSummary({
          ownerId: req.ownerId,
          sessionId: req.guestOwnerId,
          model: aiConfig.strategySummaryModel || "gpt-5.6-luna",
          latencyMs: Date.now() - summaryStartedAt,
          status: "error",
          error: summaryErr,
          onlyNecessaryData: !modelImprovement,
          modelImprovement,
        }).catch(() => {});
      }
      throw summaryErr;
    } finally {
      if (typeof req?.off === "function") req.off("close", onClose);
      if (typeof res?.off === "function") res.off("close", onClose);
    }
  });

  router.post("/summary", handleSummary);
  router.post("/summarize", handleSummary);

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
            modelProvider: aiConfig.strategyModel.startsWith("gemini") ? "google" : "openai",
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
        brief: existing.brief || "",
        answers: existing.clarification?.answers || existing.answers || [],
        strategy: existing.strategy,
      });

      const fingerprint = computePayloadFingerprint("refine_id", req.body, req.params.id);
      const refineKey = payload.idempotencyKey ? `${req.ownerId}:${payload.idempotencyKey}` : null;

      // Check if version with this idempotencyKey was already appended (replay after restart)
      if (payload.idempotencyKey && Array.isArray(existing.versions)) {
        const completedVersion = existing.versions.find((v) => v.clientSaveId === payload.idempotencyKey);
        if (completedVersion) {
          if (completedVersion.payloadFingerprint) {
            const matchesCanonical = completedVersion.payloadFingerprint === fingerprint;
            const matchesLegacy = completedVersion.payloadFingerprint === computeLegacyPayloadFingerprint("refine_id", req.body, req.params.id);
            if (!matchesCanonical && !matchesLegacy) {
              const conflictErr = new Error("Eyni idempotency açarı fərqli parametrlərlə istifadə edilib.");
              conflictErr.code = "IDEMPOTENCY_CONFLICT";
              conflictErr.status = 409;
              throw conflictErr;
            }
          }
          return res.json({ strategy: publicRecord(existing) });
        }
      }

      if (refineKey && activeRefinements.has(refineKey)) {
        const entry = activeRefinements.get(refineKey);
        if (entry.fingerprint && entry.fingerprint !== fingerprint) {
          const conflictErr = new Error("Eyni idempotency açarı fərqli parametrlərlə istifadə edilib.");
          conflictErr.code = "IDEMPOTENCY_CONFLICT";
          conflictErr.status = 409;
          throw conflictErr;
        }
        const result = await entry.promise;
        if (!res.writableEnded) {
          res.json(result);
        }
        return;
      }

      const abortController = new AbortController();
      const onClose = () => {
        if (!res.writableEnded) abortController.abort();
      };
      if (typeof req?.on === "function") req.on("close", onClose);
      if (typeof res?.on === "function") res.on("close", onClose);

      try {
        const executeRefine = async () => {
          const language = resolveLanguage(req, payload.language);
          const personalizationContext = buildStrategyPersonalizationContext({
            user: req.user,
          });
          const modelImprovement = isModelImprovementEnabled(req);
          const tracked = await runTrackedBuild({
            learningLoop, ownerId: req.ownerId, taskType: `build_refine_${payload.action}`, userPrompt: payload.action === "custom" ? payload.request : payload.action,
            relevantContext: { resourceId: existing.id, personalizationApplied: Boolean(personalizationContext), language },
            execute: (onUsage) => refineStrategy({ ...payload, language }, req.ownerId, abortController.signal, personalizationContext, undefined, onUsage),
            onlyNecessaryData: !modelImprovement,
            modelImprovement,
          });
          const strategy = tracked.result;
          const changeRequest = payload.action === "custom" ? payload.request : payload.action;
          const updated = await repository.appendVersion(
            req.params.id,
            req.ownerId,
            strategy,
            changeRequest,
            { clientSaveId: payload.idempotencyKey || null, payloadFingerprint: fingerprint }
          );
          if (modelImprovement && learningLoop && existing.learningInteractionId) {
            logWithoutBlocking(
              learningLoop.recordIteration({
                parentInteractionId: existing.learningInteractionId, interactionId: tracked.interactionId, ownerId: req.ownerId,
                modificationRequest: changeRequest, response: strategy, modelProvider: tracked.providerMeta.provider,
                modelName: tracked.providerMeta.model, finalAccepted: false,
              }),
              "Build iteration logging",
            );
          }
          return { strategy: publicRecord(updated) };
        };

        const refinePromise = executeRefine();
        if (refineKey) {
          activeRefinements.set(refineKey, { promise: refinePromise, fingerprint, abortController });
          refinePromise.then(
            () => setTimeout(() => activeRefinements.delete(refineKey), 5 * 60 * 1000).unref(),
            () => activeRefinements.delete(refineKey),
          );
        }

        const result = await refinePromise;
        if (!res.writableEnded) {
          res.json(result);
        }
      } finally {
        if (typeof req?.off === "function") req.off("close", onClose);
        if (typeof res?.off === "function") res.off("close", onClose);
      }
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
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
        return res.status(400).json({ error: "Strategiya ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
      }
      const existing = await repository.getById(req.params.id, req.ownerId);
      if (!existing) return res.status(404).json({ error: "Strategiya tapılmadı.", code: "NOT_FOUND" });
      return res.json({ strategy: publicRecord(existing) });
    }),
  );

  router.delete(
    "/:id",
    asyncRoute(async (req, res) => {
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
        return res.status(400).json({ error: "Strategiya ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
      }
      const success = await repository.delete(req.params.id, req.ownerId);
      if (!success) return res.status(404).json({ error: "Strategiya tapılmadı.", code: "NOT_FOUND" });
      return res.json({ success: true, id: req.params.id });
    }),
  );

  router.patch(
    "/:id",
    asyncRoute(async (req, res) => {
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
        return res.status(400).json({ error: "Strategiya ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
      }
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      if (!title) {
        return res.status(400).json({ error: "Strategiya adı boş ola bilməz.", code: "VALIDATION_ERROR" });
      }
      const updated = await repository.updateTitle(req.params.id, req.ownerId, title);
      if (!updated) return res.status(404).json({ error: "Strategiya tapılmadı.", code: "NOT_FOUND" });
      return res.json({ strategy: publicRecord(updated) });
    }),
  );

  router.post(
    "/:id/duplicate",
    asyncRoute(async (req, res) => {
      if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) {
        return res.status(400).json({ error: "Strategiya ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
      }
      const duplicate = await repository.duplicate(req.params.id, req.ownerId);
      if (!duplicate) return res.status(404).json({ error: "Strategiya tapılmadı.", code: "NOT_FOUND" });
      return res.status(201).json({ strategy: publicRecord(duplicate) });
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

  if (error.code === "IDEMPOTENCY_CONFLICT" || error.status === 409) {
    return res.status(409).json({
      error: error.message || "Eyni idempotency açarı fərqli parametrlərlə istifadə edilib.",
      code: "IDEMPOTENCY_CONFLICT",
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
  return res.status(httpStatusOf(error)).json({
    error: publicErrorMessage(error, "Helmer hazırda sorğunu tamamlaya bilmədi. Məlumatların qorunub — yenidən cəhd et."),
    code: error.code || "STRATEGY_ERROR",
    model: error.model,
  });
}
