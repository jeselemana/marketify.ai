import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { uuid } from "../services/artifacts/schemas.js";
import { resolveCapabilityIntent } from "../services/plugins/registry.js";
import { publicArtifact } from "../repositories/artifact-repository.js";
import { requireAuth } from "./auth-middleware.js";
import { prepareUploadedContext, validUploadMetadata } from "../services/artifacts/upload-context.js";

const upload = z.object({
  fileId: z.string().max(100).optional(), name: z.string().min(1).max(255).refine(name => !/[\/\\\x00-\x1f]/.test(name)),
  size: z.number().min(0).max(20 * 1024 * 1024), type: z.string().max(100), mimeType: z.string().max(100).optional(),
  data: z.string().max(28 * 1024 * 1024).optional(), textContent: z.string().max(200000).optional(),
}).strict().refine(validUploadMetadata, "Invalid upload MIME or extension");
// Existing Ask UI fields are accepted explicitly. Persisted artifact metadata always comes from the server.
export const askRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]), content: z.string().max(10000), file: upload.optional(),
    strategyTitle: z.string().max(1000).optional(), taskTitle: z.string().max(1000).optional(), model: z.string().max(100).optional(),
    interactionId: uuid.optional(), createdAt: z.string().max(100).optional(), feedback: z.enum(["positive", "negative"]).nullable().optional(),
    isStreaming: z.boolean().optional(), status: z.string().max(100).optional(), statusText: z.string().max(500).optional(),
    groundingMetadata: z.unknown().optional(), artifacts: z.array(z.unknown()).max(6).optional(), execution: z.unknown().optional(),
    pluginIds: z.array(z.string().max(41)).max(6).optional(),
    type: z.string().max(100).optional(), jobId: uuid.optional(), steps: z.array(z.unknown()).optional(),
    sources: z.array(z.unknown()).optional(), query: z.string().max(10000).optional(), error: z.string().max(2000).optional(),
    updatedAt: z.string().max(100).optional(), id: uuid.optional(),
  }).strict()).min(1).max(200),
  model: z.string().max(100).optional(), mode: z.enum(["ask", "research"]).optional(), thinkingLevel: z.enum(["low", "medium", "high"]).optional(),
  strategyId: uuid.optional(), taskId: uuid.optional(), chatId: uuid.optional(),
  pluginIds: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,40}$/)).max(6).optional(),
  chatRevision: z.number().int().positive().optional(),
  artifactId: uuid.optional(), stream: z.boolean().optional(),
}).strict();

function storedMessage(message) {
  return { role: message.role, content: message.content, ...(message.strategyTitle ? { strategyTitle: message.strategyTitle } : {}), ...(message.taskTitle ? { taskTitle: message.taskTitle } : {}),
    ...(message.file ? { file: { fileId: message.file.fileId, name: message.file.name, size: message.file.size, type: message.file.type, mimeType: message.file.mimeType } } : {}) };
}

export function createCapabilityRouter({ allowGuestChat = false, registry, workflow, artifacts, chats, strategies, planner, rateLimit, hydrateFile, onComplete }) {
  const router = express.Router();
  router.get("/plugins", requireAuth, (_req, res) => res.json({ plugins: registry.list() }));
  router.post("/", (req, res, next) => allowGuestChat && !req.user && req.ownerId?.startsWith("guest_") ? next() : requireAuth(req, res, next), async (req, res, next) => {
    let streaming = false, controller, heartbeat, completedResult, committed = false, allocatedChatId, initialChat;
    const emit = data => { if (!res.destroyed && !res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`); };
    try {
      const parsed = askRequestSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Sorğu parametrləri düzgün deyil.", code: "VALIDATION_ERROR" });
      const payload = parsed.data;
      if (!req.user && (payload.mode === 'research' || payload.artifactId || payload.messages.some(message => message.file) || (payload.pluginIds || []).some(id => id !== 'web'))) return res.status(401).json({ code: 'AUTH_REQUIRED' });
      const prompt = payload.messages.at(-1)?.content || "";
      if (payload.messages.at(-1)?.role !== "user" || (!prompt.trim() && !payload.messages.at(-1)?.file)) return res.status(400).json({ error: "Mesaj daxil edilməyib.", code: "VALIDATION_ERROR" });
      const chat = payload.chatId ? await chats.getById(payload.chatId, req.ownerId) : null;
      if (payload.chatId && !chat) return res.status(404).json({ error: "Söhbət tapılmadı.", code: "NOT_FOUND" });
      const expectedRevision = chat ? (chat.revision || 1) : 1;
      const clientRevision = payload.chatRevision !== undefined && payload.chatRevision !== null
        ? Number(payload.chatRevision)
        : expectedRevision;
      if (chat && clientRevision !== expectedRevision) return res.status(409).json({ code: 'REVISION_CONFLICT', revision: expectedRevision });
      const references = chat?.messages.flatMap(message => message.artifacts || []) || [];
      const selectedArtifacts = (payload.pluginIds || []).map(id => registry.get(id)).filter(plugin => plugin?.capabilities.includes("artifact_generation"));
      const inferredReference = selectedArtifacts.length === 1 ? selectedArtifacts[0] : registry.reference(prompt);
      let target = payload.artifactId ? references.find(artifact => artifact.id === payload.artifactId) : (inferredReference ? references.filter(artifact => artifact.pluginId === inferredReference.id).at(-1) : references.at(-1));
      if (payload.artifactId && !target) return res.status(404).json({ error: "Artifact bu söhbətdə tapılmadı.", code: "NOT_FOUND" });
      const previous = target ? await artifacts.get(target.id, req.ownerId) : null;
      const latestPublished = target ? references.filter(artifact => artifact.id === target.id).at(-1) : null;
      if (previous && previous.versions.at(-1).version !== latestPublished?.version) throw new Error("Artifact update is still being committed");
      const selection = resolveCapabilityIntent({ registry, pluginIds: payload.pluginIds, prompt, previousArtifact: previous });
      if (selection.intent === "chat") {
        if (previous) req.askArtifactContext = JSON.stringify(previous.versions.at(-1).spec);
        return next();
      }
      if (!req.user) return res.status(401).json({ code: "AUTH_REQUIRED" });
      if (rateLimit) { let limited = true; rateLimit(req, res, () => { limited = false; }); if (limited) return; }
      const strategyId = payload.strategyId || chat?.strategyId;
      const taskId = payload.taskId || chat?.taskId;
      const strategy = strategyId ? await strategies.getById(strategyId, req.ownerId) : null;
      const task = taskId ? (await planner.list(req.ownerId)).find(item => item.id === taskId) : null;
      if ((strategyId && !strategy) || (taskId && !task)) return res.status(404).json({ error: "Seçilmiş kontekst tapılmadı.", code: "NOT_FOUND" });
      const sourceContext = strategy || task ? JSON.stringify({ strategy: strategy ? { title: strategy.title, brief: strategy.brief, strategy: strategy.strategy } : null, task: task ? { text: task.text, strategyTitle: task.strategyTitle } : null }) : "";
      const isRetry = chat?.messages.at(-1)?.role === "user" && chat.messages.at(-1).content === prompt;
      const incoming = payload.messages.at(-1);
      const fresh = { ...storedMessage(incoming), ...(incoming.file ? { file: incoming.file } : {}) };
      const history = chat ? [...chat.messages.map(message => ({ ...message })), ...(isRetry ? [] : [fresh])] : payload.messages.map(message => ({ ...storedMessage(message), ...(message.file ? { file: message.file } : {}) }));
      if (isRetry && incoming.file) history.at(-1).file = incoming.file;
      history.at(-1).pluginIds = selection.plugins.map(plugin => plugin.id);
      for (const message of history) if (message.file) {
        message.file = await prepareUploadedContext(hydrateFile ? await hydrateFile(message.file, req.ownerId) : message.file);
        if (!message.file.data && !message.file.textContent) throw new Error("Uploaded context expired; attach the file again");
      }
      allocatedChatId = chat?.id || randomUUID();
      // Establish an owner-scoped chat before artifact persistence; failed runs stay retryable.
      const safeHistory = history.map((message, index) => chat && index < chat.messages.length ? chat.messages[index] : { ...storedMessage(message), pluginIds: message.pluginIds });
      initialChat = await chats.saveChat({ id: allocatedChatId, ownerId: req.ownerId, messages: safeHistory, strategyId, taskId, mustExist: Boolean(chat), expectedRevision: chat ? expectedRevision : null });
      streaming = payload.stream === true || req.headers.accept?.includes("text/event-stream");
      controller = new AbortController();
      res.on("close", () => { if (!res.writableEnded) controller.abort(); });
      if (streaming) {
        res.set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no", "Content-Encoding": "identity" });
        res.flushHeaders();
        heartbeat = setInterval(() => { if (!res.destroyed) res.write(": keepalive\n\n"); }, 15000);
        emit({ status: "analyzing", statusText: "Məlumatları analiz edirəm...", chatId: allocatedChatId, chatRevision: initialChat.revision });
      }
      const result = completedResult = await workflow.execute({ plugins: selection.plugins, ownerId: req.ownerId, chatId: allocatedChatId, prompt, messages: history, sourceContext, previous,
        preferEdit: Boolean(payload.artifactId),
        requestedModel: payload.model, scopes: new Set(["context:read", "artifacts:write", "web:search"]), signal: controller.signal,
        language: req.user?.settings?.language || (req.headers["accept-language"]?.includes("en") ? "en" : "az"), onStatus: streaming ? emit : () => {} });
      const assistant = { role: "assistant", content: result.reply, artifacts: result.artifacts, execution: result.execution, model: result.model, groundingMetadata: result.groundingMetadata, createdAt: new Date().toISOString() };
      const savedChat = await chats.saveChat({ id: allocatedChatId, ownerId: req.ownerId, messages: [...safeHistory, assistant], strategyId, taskId, mustExist: true, expectedRevision: initialChat.revision || 1 });
      committed = true;
      onComplete?.({ req, result });
      const response = { done: true, reply: result.reply, artifacts: result.artifacts, execution: result.execution, model: result.model, chat: savedChat, chatId: savedChat.id, chatRevision: savedChat.revision, groundingMetadata: result.groundingMetadata };
      if (streaming) { emit(response); return res.end(); }
      return res.json(response);
    } catch (error) {
      if (completedResult && !committed) for (const artifact of completedResult.artifacts.reverse()) await artifacts.rollback(artifact, req.ownerId).catch(() => {});
      // Provider/renderer internals and raw model output never appear in the conversation.
      const response = { error: "Tapşırığı tamamlamaq mümkün olmadı. Yenidən cəhd edin.", code: "CAPABILITY_EXECUTION_FAILED", retryable: true, execution: error.execution, chatId: allocatedChatId, chatRevision: initialChat?.revision };
      console.error("Capability execution failed:", error.code || error.name);
      if (streaming && !res.destroyed) { emit(response); return res.end(); }
      if (!res.headersSent) return res.status(502).json(response);
    } finally { clearInterval(heartbeat); }
  });
  return router;
}

export function createArtifactRouter({ artifacts, chats }) {
  const router = express.Router();
  router.use(requireAuth);
  router.get("/:id/versions/:version/:action", async (req, res) => {
    try {
      if (!uuid.safeParse(req.params.id).success || !/^[1-9]\d{0,2}$/.test(req.params.version) || !["download", "preview"].includes(req.params.action)) return res.status(400).json({ error: "Fayl seçimi düzgün deyil." });
      const record = await artifacts.get(req.params.id, req.ownerId);
      const chat = record ? await chats.getById(record.chatId, req.ownerId) : null;
      const queryRevision = req.query.chatRevision !== undefined ? Number(req.query.chatRevision) : undefined;
      if (chat && queryRevision !== undefined && queryRevision !== (chat.revision || 1)) return res.status(409).json({ code: 'REVISION_CONFLICT', revision: chat.revision || 1 });
      const references = chat?.messages.flatMap(message => message.artifacts || []).filter(artifact => artifact.id === record?.id) || [];
      if (!record || !chat || !references.some(artifact => artifact.version === Number(req.params.version))) return res.status(404).json({ error: "Fayl tapılmadı." });
      const version = record.versions.find(item => item.version === Number(req.params.version));
      if (!version) return res.status(404).json({ error: "Versiya tapılmadı." });
      res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      if (req.params.action === "preview") return res.json({ artifact: publicArtifact(record, version), specification: version.spec, versions: record.versions.filter(item => references.some(reference => reference.version === item.version)).map(item => publicArtifact(record, item)) });
      const result = await artifacts.download(record, version.version, req.ownerId);
      res.set({ "Content-Type": record.mimeType, "Content-Length": String(result.buffer.length), "Content-Disposition": `attachment; filename="Helmer_Artifact.${record.extension}"; filename*=UTF-8''${encodeURIComponent(version.filename)}` });
      return res.send(result.buffer);
    } catch { return res.status(503).json({ error: "Faylı açmaq mümkün olmadı. Yenidən cəhd edin." }); }
  });
  return router;
}
