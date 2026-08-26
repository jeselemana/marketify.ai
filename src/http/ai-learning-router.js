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

export function createAiLearningAdminRouter(service) {
  const router = express.Router();
  router.get("/overview", asyncRoute(async (req, res) => res.json(await service.overview(filters(req.query)))));
  router.get("/growth", asyncRoute(async (req, res) => res.json({ points: await service.growth(filters(req.query)) })));
  router.get("/models", asyncRoute(async (req, res) => res.json({ models: await service.modelPerformance(filters(req.query)) })));
  router.get("/tasks", asyncRoute(async (req, res) => res.json({ tasks: await service.taskIntelligence(filters(req.query)) })));
  router.get("/interactions", asyncRoute(async (req, res) => res.json(await service.listInteractions(filters(req.query), req.query.page, req.query.pageSize))));
  router.get("/interactions/:id", asyncRoute(async (req, res) => {
    const item = await service.getInteraction(req.params.id);
    if (!item) return res.status(404).json({ error: "Interaction tapılmadı.", code: "NOT_FOUND" });
    return res.json({ interaction: item });
  }));
  router.get("/candidates", asyncRoute(async (req, res) => res.json(await service.listCandidates(filters(req.query), req.query.page, req.query.pageSize))));
  router.get("/candidates/:id", asyncRoute(async (req, res) => {
    const item = await service.getCandidate(req.params.id);
    if (!item) return res.status(404).json({ error: "Candidate tapılmadı.", code: "NOT_FOUND" });
    return res.json({ candidate: item });
  }));
  router.post("/candidates/:id/review", asyncRoute(async (req, res) => {
    if (!["pending", "approved", "rejected"].includes(req.body?.status)) return res.status(400).json({ error: "Yanlış review statusu.", code: "VALIDATION_ERROR" });
    const item = await service.reviewCandidate(req.params.id, req.body.status, req.user.id);
    if (!item) return res.status(404).json({ error: "Candidate tapılmadı.", code: "NOT_FOUND" });
    return res.json({ candidate: item });
  }));
  router.get("/export", asyncRoute(async (req, res) => {
    const content = await service.exportApproved(req.query.format || "openai-chat-jsonl");
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="marketify-training-${new Date().toISOString().slice(0, 10)}.jsonl"`);
    return res.send(content);
  }));
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("AI learning admin API error:", error.message);
    return res.status(500).json({ error: "AI Learning məlumatı emal edilə bilmədi.", code: "AI_LEARNING_ERROR" });
  });
  return router;
}

export function createAiLearningSignalRouter(service) {
  const router = express.Router();
  router.post("/:interactionId", asyncRoute(async (req, res) => {
    const signal = await service.recordSignal(req.params.interactionId, req.ownerId, req.body || {});
    if (!signal) return res.status(404).json({ error: "Interaction tapılmadı.", code: "NOT_FOUND" });
    return res.status(201).json({ signal });
  }));
  return router;
}
