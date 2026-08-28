// Local-only verification harness. No model calls, real accounts, or application data.
// Run: node dev/homepage-preview-server.mjs
import express from "express";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { sampleRecord } from "./homepage-fixture.mjs";
const app = express();
const logPath = path.join(os.tmpdir(), "marketify-homepage-requests.jsonl");
const user = { id: "homepage-test", fullName: "Nümunə iş məkanı", username: "numune", onboardingCompleted: true, settings: { defaultMode: "build" } };
app.use(express.json());
app.use((req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
// Real app documents at mobile widths, for browsers without viewport emulation.
app.get("/__theme-mobile", (req, res) => res.type("html").send(`<!doctype html>
  <html lang="en"><head><title>Marketify responsive theme verification</title></head>
  <body style="margin:0;display:flex;gap:20px;background:#333">
    <iframe title="Mobile workspace" src="/workspace" style="width:390px;height:844px;border:0;flex:none"></iframe>
    <iframe title="Mobile homepage" src="/" style="width:390px;height:844px;border:0;flex:none"></iframe>
    <iframe title="Narrow sign-in" src="/login" style="width:320px;height:844px;border:0;flex:none"></iframe>
  </body></html>`));
app.get("/api/auth/config", (req, res) => res.json({ googleClientId: "" }));
app.get("/api/auth/me", (req, res) => req.headers.cookie?.includes("homepage_test=1") ? res.json({ user }) : res.status(401).json({ code: "AUTH_REQUIRED" }));
app.post("/api/auth/login", (req, res) => {
  if (req.body.identifier !== "homepage-demo" || req.body.password !== "local-test-only") return res.status(401).json({ error: "Test giriş məlumatları yanlışdır." });
  res.setHeader("Set-Cookie", "homepage_test=1; Path=/; HttpOnly; SameSite=Lax"); res.json({ user });
});
app.post("/api/auth/logout", (req, res) => { res.setHeader("Set-Cookie", "homepage_test=; Path=/; Max-Age=0"); res.json({ ok: true }); });
app.get("/api/strategy", (req, res) => res.json({ strategies: [sampleRecord] }));
app.get("/api/strategy/homepage-sample", (req, res) => res.json({ strategy: sampleRecord }));
app.get("/api/ask/chats", (req, res) => res.json({ chats: [] }));
app.get("/api/planner", (req, res) => res.json({ tasks: [] }));
app.get("/api/usage/stats", (req, res) => res.json({}));
app.post("/api/strategy/assess", (req, res) => {
  fs.appendFileSync(logPath, JSON.stringify({ endpoint: req.path, body: req.body }) + "\n");
  res.json({ assessment: { status: "needs_clarification", understanding: req.body.brief, assumptions: [], questions: [{ id: "goal", question: "Bu strategiyanın əsas məqsədi nədir?", reason: "Nümunə dəqiqləşdirmə", inputType: "text", options: [] }] } });
});
app.post("/api/ask", (req, res) => {
  fs.appendFileSync(logPath, JSON.stringify({ endpoint: req.path, body: req.body }) + "\n");
  res.json({ reply: "**Əvvəlcə yerli auditoriyanı və təklifini dəqiqləşdir.**\n\nStrategiyanı üç ardıcıl addımla icraya keçirə bilərsən:\n\n1. **Auditoriyanı tanı.** Yaxınlıqda yaşayan və işləyən insanların qəhvə seçimlərini və məkan gözləntilərini öyrən.\n2. **İlk ziyarəti asanlaşdır.** Xəritə profilini, menyunu və açılış təklifini hazırla.\n3. **Təkrar ziyarəti ölç.** Qonaq rəylərinə əsasən xidmətini və təklifini yenilə.\n\nBüdcəni kanallara bölməzdən əvvəl bu fərziyyələri yoxlamaq daha əsaslı qərar verməyə kömək edər.", model: "auto" });
});
app.post("/api/events", (req, res) => res.json({ ok: true }));
app.use("/api", (req, res) => res.status(404).json({ error: "Test endpoint not implemented" }));
app.use(express.static("public", { index: false }));
app.get("*", (req, res) => res.sendFile(path.resolve("public", req.path === "/" ? "home.html" : "index.html")));
app.listen(5052, "127.0.0.1", () => console.log(`Homepage verification: http://127.0.0.1:5052 — requests: ${logPath}`));
