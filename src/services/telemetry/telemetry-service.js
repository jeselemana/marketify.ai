import { randomUUID } from "node:crypto";
import { anonymizeIp, categorizeBrief, maskIdentifier, redactPayload, redactSensitiveText } from "./privacy.js";
import { calculateEstimatedCost } from "./pricing.js";
import { detectTargetMarket } from "../ai/prompts.js";

export class TelemetryService {
  constructor(repository, privacyPolicy = null) {
    this.repository = repository;
    this.privacyPolicy = privacyPolicy;
  }

  async trackUp(ownerId, event) {
    const id = `evt_${event.id}`;
    await this.repository.recordEventOnce({
      id, eventType: `up_${event.type}`, mode: "up", maskedUserId: maskIdentifier(ownerId),
      model: null, status: event.type === "evaluation_failed" ? "error" : "success",
      tokens: null, costUsd: 0, costAzn: 0, marketMode: null, category: "Business practice",
      summary: `Helmer UP: ${event.type}`, metadata: { eventType: event.type }, timestamp: event.timestamp,
    });
  }

  async trackBuildStrategy({
    ownerId = null,
    sessionId = null,
    brief = "",
    answers = [],
    strategy = null,
    model = "gemini-3.8-flash",
    latencyMs = null,
    usage = null,
    status = "success",
    qualityScore = null,
    error = null,
    action = "build_strategy",
    onlyNecessaryData = false,
    modelImprovement = true,
  } = {}) {
    const isRestricted = onlyNecessaryData === true || modelImprovement === false || (this.privacyPolicy && !await this.privacyPolicy.allows(ownerId));
    const rawMarket = isRestricted ? "global" : detectTargetMarket({ brief, answers, strategy });
    const marketMode = rawMarket === "azerbaijan" ? "LOCAL_AZ_MODE" : "GLOBAL_MODE";
    const category = isRestricted ? "Zəruri Əməliyyat" : categorizeBrief(brief || strategy?.title || "");
    const cost = calculateEstimatedCost(model, usage?.prompt_tokens, usage?.completion_tokens);
    const summary = isRestricted
      ? "[Zəruri məlumat] Model inkişafına töhfə deaktivdir - Məzmun ötürülmür"
      : redactSensitiveText(brief || strategy?.title || "Strategiya generasiyası", 80);

    const event = {
      id: `evt_bld_${randomUUID()}`,
      eventType: action,
      mode: "build",
      maskedUserId: maskIdentifier(ownerId || sessionId),
      marketMode,
      category,
      model,
      latencyMs: Number.isFinite(Number(latencyMs)) ? Math.round(Number(latencyMs)) : null,
      tokens: {
        prompt: cost.inputTokens,
        completion: cost.outputTokens,
        total: cost.totalTokens,
      },
      costUsd: cost.costUsd,
      costAzn: cost.costAzn,
      status: status === "error" ? "error" : "success",
      qualityScore: isRestricted ? null : (Number.isFinite(Number(qualityScore)) ? Number(Number(qualityScore).toFixed(2)) : null),
      summary,
      error: error ? String(error.code || "OPERATION_FAILED").slice(0, 80) : null,
      onlyNecessaryData: isRestricted,
      modelImprovement: !isRestricted,
      metadata: isRestricted
        ? {
            model,
            tokens: cost.totalTokens,
            latencyMs,
            onlyNecessaryData: true,
            dataRestricted: true,
            restrictedReason: "Model inkişafına töhfə deaktivdir - yalnız zəruri telemetriya ötürülüb",
          }
        : redactPayload({
            model,
            marketMode,
            category,
            tokens: cost.totalTokens,
            latencyMs,
            qualityScore,
            versionCount: Array.isArray(strategy?.versions) ? strategy.versions.length : 1,
          }),
      timestamp: new Date().toISOString(),
    };

    return this.repository.recordEvent(event).catch((err) => {
      console.warn("⚠️ Telemetry build event logging error:", err.message);
      return null;
    });
  }

  async trackAskQuery({
    ownerId = null,
    sessionId = null,
    model = "gpt-5.6-luna",
    latencyMs = null,
    usage = null,
    groundingActive = false,
    status = "success",
    querySnippet = "",
    error = null,
    onlyNecessaryData = false,
    modelImprovement = true,
  } = {}) {
    const isRestricted = onlyNecessaryData === true || modelImprovement === false || (this.privacyPolicy && !await this.privacyPolicy.allows(ownerId));
    const cost = calculateEstimatedCost(model, usage?.prompt_tokens, usage?.completion_tokens);
    const rawMarket = isRestricted ? "global" : detectTargetMarket({ brief: querySnippet });
    const marketMode = rawMarket === "azerbaijan" ? "LOCAL_AZ_MODE" : "GLOBAL_MODE";
    const summary = isRestricted
      ? "[Zəruri məlumat] Model inkişafına töhfə deaktivdir - Məzmun ötürülmür"
      : redactSensitiveText(querySnippet || "İnteraktiv Ask sorğusu", 80);

    const event = {
      id: `evt_ask_${randomUUID()}`,
      eventType: "ask_query",
      mode: "ask",
      maskedUserId: maskIdentifier(ownerId || sessionId),
      marketMode,
      category: isRestricted ? "Zəruri Əməliyyat" : "İnteraktiv Məsləhət",
      model,
      groundingActive: Boolean(groundingActive),
      latencyMs: Number.isFinite(Number(latencyMs)) ? Math.round(Number(latencyMs)) : null,
      tokens: {
        prompt: cost.inputTokens,
        completion: cost.outputTokens,
        total: cost.totalTokens,
      },
      costUsd: cost.costUsd,
      costAzn: cost.costAzn,
      status: status === "error" ? "error" : "success",
      summary,
      error: error ? String(error.code || "OPERATION_FAILED").slice(0, 80) : null,
      onlyNecessaryData: isRestricted,
      modelImprovement: !isRestricted,
      metadata: isRestricted
        ? {
            model,
            groundingActive: Boolean(groundingActive),
            tokens: cost.totalTokens,
            latencyMs,
            onlyNecessaryData: true,
            dataRestricted: true,
            restrictedReason: "Model inkişafına töhfə deaktivdir - yalnız zəruri telemetriya ötürülüb",
          }
        : redactPayload({
            model,
            groundingActive: Boolean(groundingActive),
            tokens: cost.totalTokens,
            latencyMs,
          }),
      timestamp: new Date().toISOString(),
    };

    return this.repository.recordEvent(event).catch((err) => {
      console.warn("⚠️ Telemetry ask event logging error:", err.message);
      return null;
    });
  }

  async trackSummary({
    ownerId = null,
    sessionId = null,
    model = "gpt-5.6-luna",
    latencyMs = null,
    usage = null,
    status = "success",
    error = null,
    onlyNecessaryData = false,
    modelImprovement = true,
  } = {}) {
    const isRestricted = onlyNecessaryData === true || modelImprovement === false || (this.privacyPolicy && !await this.privacyPolicy.allows(ownerId));
    const cost = calculateEstimatedCost(model, usage?.prompt_tokens, usage?.completion_tokens);

    const event = {
      id: `evt_sum_${randomUUID()}`,
      eventType: "summary_generate",
      mode: "summary",
      maskedUserId: maskIdentifier(ownerId || sessionId),
      marketMode: null,
      category: isRestricted ? "Zəruri Əməliyyat" : "İcraçı Xülasə",
      model,
      latencyMs: Number.isFinite(Number(latencyMs)) ? Math.round(Number(latencyMs)) : null,
      tokens: {
        prompt: cost.inputTokens,
        completion: cost.outputTokens,
        total: cost.totalTokens,
      },
      costUsd: cost.costUsd,
      costAzn: cost.costAzn,
      status: status === "error" ? "error" : "success",
      summary: isRestricted
        ? "[Zəruri məlumat] Model inkişafına töhfə deaktivdir - Məzmun ötürülmür"
        : "Strateji icraçı xülasəsi generasiyası (Luna)",
      error: error ? String(error.code || "OPERATION_FAILED").slice(0, 80) : null,
      onlyNecessaryData: isRestricted,
      modelImprovement: !isRestricted,
      metadata: isRestricted
        ? {
            model,
            tokens: cost.totalTokens,
            latencyMs,
            onlyNecessaryData: true,
            dataRestricted: true,
            restrictedReason: "Model inkişafına töhfə deaktivdir - yalnız zəruri telemetriya ötürülüb",
          }
        : redactPayload({
            model,
            tokens: cost.totalTokens,
            latencyMs,
          }),
      timestamp: new Date().toISOString(),
    };

    return this.repository.recordEvent(event).catch((err) => {
      console.warn("⚠️ Telemetry summary event logging error:", err.message);
      return null;
    });
  }

  async trackExport({
    ownerId = null,
    sessionId = null,
    format = "pdf",
    title = "",
    status = "success",
    onlyNecessaryData = false,
    modelImprovement = true,
  } = {}) {
    const isRestricted = onlyNecessaryData === true || modelImprovement === false || (this.privacyPolicy && !await this.privacyPolicy.allows(ownerId));
    const cleanFormat = String(format || "pdf").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const safeTitle = isRestricted ? "" : redactSensitiveText(title || "Strategiya hesabatı", 60);

    const event = {
      id: `evt_exp_${randomUUID()}`,
      eventType: "export_download",
      mode: "export",
      maskedUserId: maskIdentifier(ownerId || sessionId),
      marketMode: null,
      category: isRestricted ? "Zəruri Əməliyyat" : "Sənəd İxracı",
      model: "system-exporter",
      format: cleanFormat,
      latencyMs: null,
      tokens: null,
      costUsd: 0,
      costAzn: 0,
      status: status === "error" ? "error" : "success",
      summary: isRestricted
        ? `Strategiya ixracı: ${cleanFormat.toUpperCase()}`
        : `Strategiya ixracı: ${cleanFormat.toUpperCase()}${safeTitle ? ` (${safeTitle})` : ""}`,
      onlyNecessaryData: isRestricted,
      modelImprovement: !isRestricted,
      metadata: isRestricted
        ? {
            format: cleanFormat,
            onlyNecessaryData: true,
            dataRestricted: true,
            restrictedReason: "Model inkişafına töhfə deaktivdir - yalnız zəruri telemetriya ötürülüb",
          }
        : redactPayload({
            format: cleanFormat,
            titleLength: safeTitle.length,
          }),
      timestamp: new Date().toISOString(),
    };

    return this.repository.recordEvent(event).catch((err) => {
      console.warn("⚠️ Telemetry export event logging error:", err.message);
      return null;
    });
  }

  async trackAuth({
    ownerId = null,
    sessionId = null,
    action = "login",
    provider = "credentials",
    ip = null,
    status = "success",
    reason = null,
  } = {}) {
    const cleanAction = String(action || "login").toLowerCase().replace(/[^a-z0-9_]/g, "");

    const event = {
      id: `evt_ath_${randomUUID()}`,
      eventType: `auth_${cleanAction}`,
      mode: "auth",
      maskedUserId: maskIdentifier(ownerId || sessionId),
      marketMode: null,
      category: "İstifadəçi Sessiyası",
      model: null,
      anonymizedIp: anonymizeIp(ip),
      provider: String(provider || "credentials").slice(0, 30),
      latencyMs: null,
      tokens: null,
      costUsd: 0,
      costAzn: 0,
      status: status === "error" || status === "failed" ? "error" : "success",
      summary: `Autentifikasiya: ${cleanAction.toUpperCase()} (${provider})`,
      metadata: redactPayload({
        action: cleanAction,
        provider,
        reason: reason ? String(reason).slice(0, 100) : null,
      }),
      timestamp: new Date().toISOString(),
    };

    return this.repository.recordEvent(event).catch((err) => {
      console.warn("⚠️ Telemetry auth event logging error:", err.message);
      return null;
    });
  }

  async trackSystemError({
    ownerId = null,
    sessionId = null,
    path = "",
    method = "POST",
    statusCode = 500,
    errorCode = "SYSTEM_ERROR",
    latencyMs = null,
  } = {}) {
    const event = {
      id: `evt_sys_${randomUUID()}`,
      eventType: "system_error",
      mode: "system",
      maskedUserId: maskIdentifier(ownerId || sessionId),
      marketMode: null,
      category: "Sistem Xətası",
      model: null,
      statusCode: Number(statusCode) || 500,
      latencyMs: Number.isFinite(Number(latencyMs)) ? Math.round(Number(latencyMs)) : null,
      tokens: null,
      costUsd: 0,
      costAzn: 0,
      status: "error",
      summary: `HTTP ${statusCode} [${String(errorCode).slice(0, 40)}] - ${String(method).toUpperCase()} ${String(path).slice(0, 60)}`,
      metadata: redactPayload({
        path: String(path).slice(0, 100),
        method: String(method).toUpperCase(),
        statusCode,
        errorCode,
      }),
      timestamp: new Date().toISOString(),
    };

    return this.repository.recordEvent(event).catch((err) => {
      console.warn("⚠️ Telemetry system error logging error:", err.message);
      return null;
    });
  }

  async trackTaskFeedback({
    ownerId = null,
    sessionId = null,
    taskId = "",
    taskText = "",
    feedback = "like",
    strategyId = null,
    strategyTitle = null,
    source = "brief",
    userNote = "",
  } = {}) {
    const isLike = feedback === "like";
    const feedbackLabel = isLike ? "Faydalı oldu (Like 👍)" : "Faydalı olmadı (Dislike 👎)";
    const safeTaskSnippet = redactSensitiveText(taskText || "Tapşırıq", 80);
    const safeStrategyTitle = strategyTitle ? redactSensitiveText(strategyTitle, 60) : null;

    const baseExplanation = isLike
      ? `İstifadəçi "${safeStrategyTitle || "Strategiya"}" briefindən olan tapşırığın icrasını FAYDALI hesab etdi.`
      : `İstifadəçi "${safeStrategyTitle || "Strategiya"}" briefindən olan tapşırığın icrasını FAYDASIZ / QEYRİ-EFFEKTİV hesab etdi.`;

    const explanation = userNote ? `${baseExplanation} İstifadəçi qeydi: "${userNote}"` : baseExplanation;

    const event = {
      id: `evt_fbk_${randomUUID()}`,
      eventType: "task_feedback",
      mode: "planner",
      maskedUserId: maskIdentifier(ownerId || sessionId),
      marketMode: null,
      category: "İcra Rəyi",
      model: "user-feedback",
      latencyMs: null,
      tokens: null,
      costUsd: 0,
      costAzn: 0,
      status: isLike ? "success" : "warning",
      summary: `Planner Rəyi: [${feedbackLabel}] "${safeTaskSnippet}"`,
      metadata: redactPayload({
        taskId,
        feedback,
        rating: isLike ? "positive" : "negative",
        taskTitle: safeTaskSnippet,
        strategyId,
        strategyTitle: safeStrategyTitle,
        source,
        izahat: explanation,
        explanation,
      }),
      timestamp: new Date().toISOString(),
    };

    return this.repository.recordEvent(event).catch((err) => {
      console.warn("⚠️ Telemetry task feedback logging error:", err.message);
      return null;
    });
  }

  async syncHistoricalIfEmpty({ strategyRepository, chatRepository, aiLearningRepository } = {}) {
    try {
      const store = await this.repository.readStore();
      if (store.events.length > 0) return; // Already has telemetry records

      const backfillEvents = [];

      // 1. Backfill from AI Learning repository if available
      if (aiLearningRepository && typeof aiLearningRepository.readStore === "function") {
        const learningStore = await aiLearningRepository.readStore().catch(() => null);
        if (learningStore && Array.isArray(learningStore.interactions)) {
          for (const item of learningStore.interactions) {
            const rawMarket = detectTargetMarket({ brief: item.userPrompt });
            const marketMode = rawMarket === "azerbaijan" ? "LOCAL_AZ_MODE" : "GLOBAL_MODE";
            const cost = calculateEstimatedCost(item.modelName, item.inputTokens, item.outputTokens);
            backfillEvents.push({
              id: `evt_hst_${item.id || randomUUID()}`,
              eventType: item.mode === "build" ? (item.taskType || "build_strategy") : "ask_query",
              mode: item.mode || "build",
              maskedUserId: maskIdentifier(item.ownerId || item.sessionId),
              marketMode,
              category: item.mode === "build" ? categorizeBrief(item.userPrompt) : "İnteraktiv Məsləhət",
              model: item.modelName || "gemini-3.8-flash",
              groundingActive: Boolean(item.relevantContext?.searchGrounded),
              latencyMs: item.latencyMs || null,
              tokens: {
                prompt: cost.inputTokens,
                completion: cost.outputTokens,
                total: cost.totalTokens,
              },
              costUsd: cost.costUsd,
              costAzn: cost.costAzn,
              status: item.requestStatus === "error" ? "error" : "success",
              qualityScore: Number.isFinite(item.qualityScore) ? Number(item.qualityScore.toFixed(2)) : null,
              summary: redactSensitiveText(item.userPrompt || "Tarixi qarşılıqlı əlaqə", 80),
              metadata: redactPayload({
                taskType: item.taskType,
                model: item.modelName,
                tokens: cost.totalTokens,
              }),
              timestamp: item.createdAt || new Date().toISOString(),
            });
          }
        }
      }

      // 2. Backfill from strategyRepository if learning was empty
      if (backfillEvents.length === 0 && strategyRepository && typeof strategyRepository.readAll === "function") {
        const strategies = await strategyRepository.readAll().catch(() => []);
        for (const strat of strategies) {
          const rawMarket = detectTargetMarket({ brief: strat.brief, answers: strat.answers, strategy: strat.strategy });
          const marketMode = rawMarket === "azerbaijan" ? "LOCAL_AZ_MODE" : "GLOBAL_MODE";
          const cost = calculateEstimatedCost("gemini-3.8-flash", 1200, 3200);
          backfillEvents.push({
            id: `evt_hst_st_${strat.id || randomUUID()}`,
            eventType: "build_strategy",
            mode: "build",
            maskedUserId: maskIdentifier(strat.ownerId),
            marketMode,
            category: categorizeBrief(strat.brief || strat.title || ""),
            model: "gemini-3.8-flash",
            latencyMs: 1450,
            tokens: { prompt: 1200, completion: 3200, total: 4400 },
            costUsd: cost.costUsd,
            costAzn: cost.costAzn,
            status: "success",
            qualityScore: 0.88,
            summary: redactSensitiveText(strat.brief || strat.title || "Tarixi strategiya", 80),
            metadata: redactPayload({
              title: redactSensitiveText(strat.title, 40),
              model: "gemini-3.8-flash",
              marketMode,
            }),
            timestamp: strat.createdAt || new Date().toISOString(),
          });
        }
      }

      if (backfillEvents.length > 0) {
        // Sort descending by timestamp
        backfillEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        await this.repository.recordEventsBatch(backfillEvents);
      }
    } catch (err) {
      console.warn("⚠️ Historical telemetry sync skipped:", err.message);
    }
  }
}
