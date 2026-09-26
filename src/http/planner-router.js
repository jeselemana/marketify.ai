import express from "express";
import { z } from "zod";
import { summarizeTasksWithLuna } from "../services/ai/strategy-service.js";
import { aiConfig } from "../services/ai/config.js";

export const TaskInputSchema = z.object({
  text: z.string().trim().min(1).max(1000).optional(),
  title: z.string().trim().min(1).max(1000).optional(),
  timeframe: z.string().trim().max(100).optional(),
  groupLabel: z.string().trim().max(100).optional(),
  status: z.enum(["todo", "in_progress", "completed"]).optional(),
  completed: z.boolean().optional(),
  strategyId: z.string().regex(/^[0-9a-f-]{36}$/i, "Geçərsiz strategiya ID").nullable().optional(),
  strategyTitle: z.string().trim().max(300).nullable().optional(),
}).strict().refine((data) => Boolean(data.text || data.title), {
  message: "Tapşırıq mətni daxil edilməlidir.",
});

export const BatchCreateTasksSchema = z.object({
  tasks: z.array(TaskInputSchema).min(1, "Əlavə ediləcək tapşırıq tapılmadı.").max(100),
}).strict();

export const UpdateTaskSchema = z.object({
  text: z.string().trim().min(1, "Tapşırıq mətni boş ola bilməz.").max(1000).optional(),
  title: z.string().trim().min(1, "Tapşırıq mətni boş ola bilməz.").max(1000).optional(),
  completed: z.boolean().optional(),
  status: z.enum(["todo", "in_progress", "completed"]).optional(),
  timeframe: z.string().trim().max(100).optional(),
  groupLabel: z.string().trim().max(100).optional(),
}).strict();

export const SummarizeTasksSchema = z.object({
  tasks: z.array(
    z.union([
      z.string().trim().min(1).max(1000),
      z.object({
        text: z.string().trim().min(1).max(1000).optional(),
        title: z.string().trim().min(1).max(1000).optional(),
        timeframe: z.string().trim().max(100).optional(),
        groupLabel: z.string().trim().max(100).optional(),
      }).strict(),
    ])
  ).min(1).max(50).optional(),
  strategyId: z.string().regex(/^[0-9a-f-]{36}$/i, "Geçərsiz strategiya ID").nullable().optional(),
  strategyTitle: z.string().trim().max(300).nullable().optional(),
  language: z.enum(["az", "en"]).optional(),
}).strict();

export function createPlannerRouter(plannerRepository, options = {}) {
  const router = express.Router();
  const strategyRepository = options.strategyRepository || null;
  const telemetryService = options.telemetryService || null;

  router.get("/", async (req, res) => {
    try {
      const tasks = await plannerRepository.list(req.ownerId);
      return res.json({ tasks });
    } catch (error) {
      console.error("Planner list error:", error);
      return res.status(500).json({ error: "Tapşırıqları yükləmək mümkün olmadı." });
    }
  });

  router.post("/batch", async (req, res) => {
    try {
      const parsed = BatchCreateTasksSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || "Əlavə ediləcək tapşırıq tapılmadı.",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        });
      }

      const tasksToInsert = parsed.data.tasks.map((item) => {
        const rawText = item.title || item.text || "";
        const text = rawText.replace(/^[\s\-*•\d.)\]]+/, "").trim() || rawText.trim();
        const title = text;
        const timeframe = item.timeframe || item.groupLabel || "Ümumi";
        const groupLabel = item.groupLabel || timeframe;
        const status = item.status || (item.completed ? "completed" : "todo");
        return {
          title,
          text,
          timeframe,
          groupLabel,
          status,
          strategyId: item.strategyId || null,
          strategyTitle: item.strategyTitle || null,
          completed: status === "completed" || Boolean(item.completed),
        };
      });

      const added = await plannerRepository.addBatch(req.ownerId, tasksToInsert);
      const allTasks = await plannerRepository.list(req.ownerId);
      return res.json({ added, count: added.length, tasks: allTasks });
    } catch (error) {
      console.error("Planner batch add error:", error);
      return res.status(500).json({ error: "Tapşırıqları əlavə etmək mümkün olmadı." });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const parsed = TaskInputSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || "Tapşırıq məlumatı düzgün deyil.",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        });
      }
      const data = parsed.data;
      const rawText = data.title || data.text || "";
      const text = rawText.replace(/^[\s\-*•\d.)\]]+/, "").trim() || rawText.trim();
      const title = text;
      const timeframe = data.timeframe || data.groupLabel || "Ümumi";
      const groupLabel = data.groupLabel || timeframe;
      const status = data.status || (data.completed ? "completed" : "todo");

      const added = await plannerRepository.addBatch(req.ownerId, [
        {
          title,
          text,
          timeframe,
          groupLabel,
          status,
          strategyId: data.strategyId || null,
          strategyTitle: data.strategyTitle || null,
          completed: status === "completed" || Boolean(data.completed),
        },
      ]);
      return res.status(201).json({ task: added[0] || null });
    } catch (error) {
      console.error("Planner create error:", error);
      return res.status(500).json({ error: "Tapşırıq yaratmaq mümkün olmadı." });
    }
  });

  router.post("/summarize", async (req, res) => {
    try {
      const parsed = SummarizeTasksSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || "Məlumatları yoxlayın.",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        });
      }

      const { strategyId, strategyTitle, language = "az" } = parsed.data;
      let tasks = parsed.data.tasks || [];

      // Tenant isolation & IDOR check: If strategyId is provided, enforce ownerId match (Rule 3)
      if (strategyId) {
        if (strategyRepository) {
          const strategyRecord = await strategyRepository.getById(strategyId, req.ownerId);
          if (!strategyRecord) {
            return res.status(404).json({ error: "Strategiya tapılmadı.", code: "NOT_FOUND" });
          }
          if (!tasks.length && Array.isArray(strategyRecord.strategy?.nextSteps)) {
            tasks = strategyRecord.strategy.nextSteps;
          }
        }
      }

      if (!tasks.length) {
        return res.status(400).json({ error: "Xülasələndiriləcək tapşırıq tapılmadı.", code: "VALIDATION_ERROR" });
      }

      const client = options.openAiClient || options.client || null;
      const startedAt = Date.now();
      let summaryUsage = null;

      const result = await summarizeTasksWithLuna({
        tasks,
        strategyTitle: strategyTitle || "",
        language,
        client,
        onUsage: (u) => { summaryUsage = u; },
      });

      if (telemetryService && typeof telemetryService.trackSummary === "function") {
        telemetryService.trackSummary({
          ownerId: req.ownerId,
          sessionId: req.guestOwnerId,
          model: result.model || aiConfig.plannerSummaryModel || "gpt-6-luna",
          latencyMs: Date.now() - startedAt,
          usage: summaryUsage,
          status: "success",
        }).catch(() => {});
      }

      return res.json({
        tasks: result.tasks,
        model: result.model || "gpt-6-luna",
        count: result.tasks.length,
      });
    } catch (error) {
      console.error("Planner summarize error:", error);
      return res.status(500).json({ error: error.message || "Tapşırıqları xülasələndirmək mümkün olmadı." });
    }
  });

  router.patch("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return res.status(400).json({ error: "Tapşırıq ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
      }
      const parsed = UpdateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || "Məlumatları yoxlayın.",
          code: "VALIDATION_ERROR",
          details: parsed.error.issues,
        });
      }
      const updated = await plannerRepository.update(id, req.ownerId, parsed.data);
      if (!updated) {
        return res.status(404).json({ error: "Tapşırıq tapılmadı." });
      }
      return res.json({ task: updated });
    } catch (error) {
      console.error("Planner update error:", error);
      return res.status(500).json({ error: "Tapşırığı yeniləmək mümkün olmadı." });
    }
  });

  router.delete("/completed", async (req, res) => {
    try {
      const count = await plannerRepository.clearCompleted(req.ownerId);
      return res.json({ ok: true, cleared: count });
    } catch (error) {
      console.error("Planner clear completed error:", error);
      return res.status(500).json({ error: "Tamamlanmış tapşırıqları silmək mümkün olmadı." });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!/^[0-9a-f-]{36}$/i.test(id)) {
        return res.status(400).json({ error: "Tapşırıq ID-si düzgün deyil.", code: "VALIDATION_ERROR" });
      }
      const ok = await plannerRepository.delete(id, req.ownerId);
      return res.json({ ok });
    } catch (error) {
      console.error("Planner delete error:", error);
      return res.status(500).json({ error: "Tapşırığı silmək mümkün olmadı." });
    }
  });

  return router;
}
