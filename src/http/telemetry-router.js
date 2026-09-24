import express from "express";
import { z } from "zod";

const ClientTelemetryEventSchema = z.object({
  eventType: z.enum(["export_requested", "summary_clicked", "ui_action"]),
  format: z.enum(["pdf", "markdown", "html", "excel", "csv", "spreadsheet"]).optional(),
  title: z.string().max(200).optional(),
  metadata: z.record(z.any()).optional(),
}).strict();

export function createTelemetryAdminRouter(telemetryService) {
  const router = express.Router();

  // 1. Live KPI Overview
  router.get("/overview", async (req, res) => {
    try {
      const dateRange = typeof req.query.dateRange === "string" ? req.query.dateRange : "today";
      const overview = await telemetryService.repository.getOverview({ dateRange });
      return res.json(overview);
    } catch (error) {
      console.error("Telemetry overview error:", error);
      return res.status(500).json({ error: "Telemetriya göstəriciləri əldə edilmədi.", code: "TELEMETRY_OVERVIEW_ERROR" });
    }
  });

  // 2. Paginated, filterable, searchable live audit feed
  router.get("/events", async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const pageSize = parseInt(req.query.pageSize, 10) || 25;
      const mode = typeof req.query.mode === "string" ? req.query.mode : "all";
      const status = typeof req.query.status === "string" ? req.query.status : "all";
      const model = typeof req.query.model === "string" ? req.query.model : "all";
      const marketMode = typeof req.query.marketMode === "string" ? req.query.marketMode : "all";
      const search = typeof req.query.search === "string" ? req.query.search : "";
      const dateRange = typeof req.query.dateRange === "string" ? req.query.dateRange : "all";

      const result = await telemetryService.repository.listEvents({
        page,
        pageSize,
        mode,
        status,
        model,
        marketMode,
        search,
        dateRange,
      });

      return res.json(result);
    } catch (error) {
      console.error("Telemetry events error:", error);
      return res.status(500).json({ error: "Audit jurnalı əldə edilmədi.", code: "TELEMETRY_EVENTS_ERROR" });
    }
  });

  // 3. Single Event Safe JSON Inspector
  router.get("/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const event = await telemetryService.repository.getEventById(id);
      if (!event) {
        return res.status(404).json({ error: "Hadisə tapılmadı.", code: "NOT_FOUND" });
      }
      return res.json({ event });
    } catch (error) {
      console.error("Telemetry event get error:", error);
      return res.status(500).json({ error: "Hadisə detalları əldə edilmədi.", code: "TELEMETRY_EVENT_ERROR" });
    }
  });

  return router;
}

export function createTelemetryClientRouter(telemetryService) {
  const router = express.Router();

  router.post("/event", async (req, res) => {
    try {
      const parseResult = ClientTelemetryEventSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: "Daxil edilən telemetriya hadisəsi etibarsızdır.",
          code: "VALIDATION_ERROR",
          details: parseResult.error.issues,
        });
      }

      const { eventType, format, title } = parseResult.data;
      const ownerId = req.ownerId || null;
      const sessionId = req.guestOwnerId || null;

      if (eventType === "export_requested") {
        await telemetryService.trackExport({
          ownerId,
          sessionId,
          format: format || "pdf",
          title: title || "",
          status: "success",
        });
      }

      return res.json({ success: true });
    } catch (error) {
      console.warn("⚠️ Client telemetry ingestion warning:", error.message);
      return res.status(500).json({ error: "Hadisə qeydə alınmadı.", code: "INGEST_FAILED" });
    }
  });

  return router;
}
