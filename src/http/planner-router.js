import express from "express";
import { z } from "zod";

const UpdateTaskSchema = z.object({
  text: z.string().trim().min(1, "Tapşırıq mətni boş ola bilməz.").max(1000).optional(),
  completed: z.boolean().optional(),
  groupLabel: z.string().trim().max(100).optional(),
}).strict();

export function createPlannerRouter(plannerRepository) {
  const router = express.Router();

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
      const rawTasks = Array.isArray(req.body.tasks) ? req.body.tasks : [];
      if (!rawTasks.length) {
        return res.status(400).json({ error: "Əlavə ediləcək tapşırıq tapılmadı." });
      }
      const added = await plannerRepository.addBatch(req.ownerId, rawTasks);
      const allTasks = await plannerRepository.list(req.ownerId);
      return res.json({ added, count: added.length, tasks: allTasks });
    } catch (error) {
      console.error("Planner batch add error:", error);
      return res.status(500).json({ error: "Tapşırıqları əlavə etmək mümkün olmadı." });
    }
  });

  router.post("/", async (req, res) => {
    try {
      const text = typeof req.body.text === "string" ? req.body.text.trim() : "";
      if (!text) {
        return res.status(400).json({ error: "Tapşırıq mətni daxil edilməlidir." });
      }
      const added = await plannerRepository.addBatch(req.ownerId, [
        {
          text,
          groupLabel: req.body.groupLabel || "Ümumi",
          strategyId: req.body.strategyId || null,
          strategyTitle: req.body.strategyTitle || null,
        },
      ]);
      return res.status(201).json({ task: added[0] || null });
    } catch (error) {
      console.error("Planner create error:", error);
      return res.status(500).json({ error: "Tapşırıq yaratmaq mümkün olmadı." });
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
