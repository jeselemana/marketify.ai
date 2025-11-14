import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { OpenAI } from "openai";
import fetch from "node-fetch";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// ES module üçün __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🧠 Data qovluğu və fayllar
const DATA_DIR = path.join(__dirname, "data");
const KNOWLEDGE_LOG_PATH = path.join(DATA_DIR, "knowledge_log.json");
const BASE_PATH = path.join(DATA_DIR, "marketify_base.json");
const TRASH_PATH = path.join(DATA_DIR, "marketify_trash.json");

// 💾 Faylları təhlükəsiz hazırlamaq
function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
  }

  if (!fs.existsSync(KNOWLEDGE_LOG_PATH)) {
    fs.writeFileSync(KNOWLEDGE_LOG_PATH, "[]", "utf-8");
  }

  if (!fs.existsSync(BASE_PATH)) {
    fs.writeFileSync(BASE_PATH, "{}", "utf-8");
  }

  if (!fs.existsSync(TRASH_PATH)) {
    fs.writeFileSync(TRASH_PATH, "{}", "utf-8");
  }
}

function safeLoadJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error("JSON yüklənmədi:", filePath, err.message);
    return fallback;
  }
}

function safeSaveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("JSON yazılmadı:", filePath, err.message);
  }
}

// 🧠 Sadə intent detektoru (GPT istifadə ETMİR)
function detectIntent(message) {
  const msg = message.toLowerCase();

  if (msg.includes("instagram") || msg.includes("insta") || msg.includes("caption")) {
    return "insta_caption";
  }
  if (msg.includes("linkedin")) {
    return "linkedin_post";
  }
  if (msg.includes("tiktok")) {
    return "tiktok_idea";
  }
  if (msg.includes("email") || msg.includes("e-poçt") || msg.includes("məktub")) {
    return "email_template";
  }
  if (msg.includes("strategiya") || msg.includes("strategy")) {
    return "marketing_strategy";
  }
  if (msg.includes("seo")) {
    return "seo_tip";
  }
  if (msg.includes("blog") || msg.includes("məqalə")) {
    return "blog_post";
  }

  return "unknown";
}

// 🧩 GPT cavabından şablon çıxarma (sadə versiya)
function extractTemplate(answer, userMessage) {
  if (!answer || answer.length < 200) return null;

  let template = answer;

  // İstifadəçi mesajını {topic} ilə əvəz et (əgər daxilidirsə)
  const cleanUser = userMessage.trim();
  if (cleanUser.length > 10 && template.toLowerCase().includes(cleanUser.toLowerCase())) {
    template = template.replace(new RegExp(cleanUser, "gi"), "{topic}");
  }

  // Bəzi konkret yerləri generikləşdir
  template = template.replace(/Instagram/gi, "{platform}");
  template = template.replace(/LinkedIn/gi, "{platform}");
  template = template.replace(/TikTok/gi, "{platform}");

  // Çox ümumi və ya qısa şeylərdən qaç
  if (!template.includes("{topic}") && !template.includes("{platform}")) {
    // Şablonlaşmağa uyğun deyil → boş qaytar
    return null;
  }

  return template.trim();
}

// 🧠 Marketify Brain – GPT cavablarından öyrənən layer
function learnFromGPT(userMessage, gptReply) {
  try {
    ensureDataFiles();

    // 1) Bütün cavabı log-a yaz
    const log = safeLoadJSON(KNOWLEDGE_LOG_PATH, []);
    log.push({
      question: userMessage,
      answer: gptReply,
      intent: detectIntent(userMessage),
      timestamp: Date.now(),
    });

    // Son 1000 log saxlayırıq ki, fayl çox böyüməsin
    const trimmedLog = log.slice(-1000);
    safeSaveJSON(KNOWLEDGE_LOG_PATH, trimmedLog);

    // 2) Intent tap
    const intent = detectIntent(userMessage);
    if (intent === "unknown") return; // bu dəfəlik öyrənmirik

    // 3) Şablon çıxart
    const template = extractTemplate(gptReply, userMessage);
    if (!template) return;

    // 4) Baza faylını yüklə və şablonu əlavə et
    const base = safeLoadJSON(BASE_PATH, {});

    if (!Array.isArray(base[intent])) {
      base[intent] = [];
    }

    const alreadyExists = base[intent].some(
      (item) => item && item.template === template
    );
    if (alreadyExists) return;

    base[intent].push({
      template,
      createdAt: Date.now(),
    });

    safeSaveJSON(BASE_PATH, base);

    console.log(`🧠 Marketify Brain → yeni şablon öyrəndi [${intent}]`);
  } catch (err) {
    console.error("Marketify Brain öyrənmə xətası:", err.message);
  }
}

// 💬 Sadə yaddaş (RAM-da saxlanır)
let conversationHistory = [];

// 🧠 Chat Endpoint (MODEL SEÇİMİ İLƏ)
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message?.trim();
    const selectedModel = req.body.model || "gpt-4o-mini"; // 👈 MODEL BURADA OXUNUR

    if (!userMessage)
      return res.status(400).json({ error: "Mesaj daxil edilməyib." });

    // 🔹 İstifadəçi mesajını tarixçəyə əlavə et
    conversationHistory.push({ role: "user", content: userMessage });
    if (conversationHistory.length > 15)
      conversationHistory = conversationHistory.slice(-15);

    // 👇👇👇 LOCAL MODEL BURADA İŞƏ DÜŞÜR 👇👇👇
    if (selectedModel === "local") {
      console.log("🤖 Local (Marketify Brain) cavabı göndərildi.");

      const intent = detectIntent(userMessage);
      const base = safeLoadJSON(BASE_PATH, {});
      const templates = base[intent] || [];

      if (templates.length === 0) {
        return res.json({
          reply:
            "Bu mövzu hələ Marketify Brain-də tam öyrənilməyib 🤖💛\n\nAmma yenə də kömək edə bilərəm! Mövzunu bir az daha dəqiq izah etsən, çalışım yaradıcı fikir verim ✨",
        });
      }

      // Sadə şablon seçimi
      const random = templates[Math.floor(Math.random() * templates.length)];

      const finalText = random.template
        .replace("{topic}", userMessage)
        .replace("{platform}", "Instagram");

      return res.json({ reply: finalText });
    }

    // 👇👇👇 BURADAN AŞAĞI SADECE GPT-4o mini ÜÇÜN 👇👇👇

    const systemPrompt = {
      role: "system",
      content: `
Sən Marketify AI adlanan enerjili, səmimi və yaradıcı tonda danışan süni intellektsən...
(tezliklə olduğu kimi qalsın)
      `,
    };

    // 🤖 OpenAI cavabı
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.9,
      presence_penalty: 0.4,
      frequency_penalty: 0.25,
      max_tokens: 1200,
      messages: [systemPrompt, ...conversationHistory],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Cavab alınmadı 😅";

    conversationHistory.push({ role: "assistant", content: reply });

    // 🧠 Local Brain öyrənir
    learnFromGPT(userMessage, reply);

    res.json({ reply });
  } catch (error) {
    console.error("OpenAI xətası:", error.message);
    res.status(500).json({ error: "Server xətası, AI cavab vermədi." });
  }
});


// 💡 Söhbəti sıfırlama (Clear düyməsi üçün)
app.post("/api/clear", (req, res) => {
  conversationHistory = [];
  res.json({ ok: true });
});

//
// 🧠 ADMIN PANEL – YALNIZ SƏNİN ÜÇÜN
//

// Stats
app.get("/admin/api/stats", (req, res) => {
  try {
    ensureDataFiles();
    const base = safeLoadJSON(BASE_PATH, {});
    const log = safeLoadJSON(KNOWLEDGE_LOG_PATH, []);

    const intents = Object.keys(base);
    const totalTemplates = intents.reduce((sum, key) => {
      const arr = Array.isArray(base[key]) ? base[key] : [];
      return sum + arr.length;
    }, 0);

    res.json({
      totalTemplates,
      totalIntents: intents.length,
      totalLogEntries: log.length,
    });
  } catch (err) {
    console.error("Admin stats xətası:", err.message);
    res.status(500).json({ error: "Stats alınmadı" });
  }
});

// Bütün template-lər + trash
app.get("/admin/api/templates", (req, res) => {
  try {
    ensureDataFiles();
    const base = safeLoadJSON(BASE_PATH, {});
    const trash = safeLoadJSON(TRASH_PATH, {});
    res.json({ base, trash });
  } catch (err) {
    console.error("Admin templates xətası:", err.message);
    res.status(500).json({ error: "Template-lər alınmadı" });
  }
});

// Template sil → trash-ə at
app.post("/admin/api/templates/delete", (req, res) => {
  try {
    const { intent, index } = req.body || {};
    if (!intent || typeof index !== "number") {
      return res
        .status(400)
        .json({ error: "intent və index göndərilməlidir" });
    }

    ensureDataFiles();
    const base = safeLoadJSON(BASE_PATH, {});
    const trash = safeLoadJSON(TRASH_PATH, {});

    if (!Array.isArray(base[intent]) || !base[intent][index]) {
      return res.status(404).json({ error: "Template tapılmadı" });
    }

    const [removed] = base[intent].splice(index, 1);

    if (!Array.isArray(trash[intent])) {
      trash[intent] = [];
    }
    trash[intent].push({
      ...removed,
      deletedAt: Date.now(),
    });

    safeSaveJSON(BASE_PATH, base);
    safeSaveJSON(TRASH_PATH, trash);

    res.json({ success: true });
  } catch (err) {
    console.error("Template silmə xətası:", err.message);
    res.status(500).json({ error: "Template silinmədi" });
  }
});

// Trash → geri qaytar
app.post("/admin/api/templates/restore", (req, res) => {
  try {
    const { intent, index } = req.body || {};
    if (!intent || typeof index !== "number") {
      return res
        .status(400)
        .json({ error: "intent və index göndərilməlidir" });
    }

    ensureDataFiles();
    const base = safeLoadJSON(BASE_PATH, {});
    const trash = safeLoadJSON(TRASH_PATH, {});

    if (!Array.isArray(trash[intent]) || !trash[intent][index]) {
      return res.status(404).json({ error: "Trash daxilində tapılmadı" });
    }

    const [restored] = trash[intent].splice(index, 1);

    if (!Array.isArray(base[intent])) {
      base[intent] = [];
    }
    base[intent].push({
      ...restored,
      restoredAt: Date.now(),
    });

    safeSaveJSON(BASE_PATH, base);
    safeSaveJSON(TRASH_PATH, trash);

    res.json({ success: true });
  } catch (err) {
    console.error("Template bərpa xətası:", err.message);
    res.status(500).json({ error: "Template bərpa olunmadı" });
  }
});

// Log-lar (son 50)
app.get("/admin/api/logs", (req, res) => {
  try {
    ensureDataFiles();
    const log = safeLoadJSON(KNOWLEDGE_LOG_PATH, []);
    const limit = Number(req.query.limit) || 50;
    const last = log.slice(-limit).reverse();
    res.json({ entries: last });
  } catch (err) {
    console.error("Log oxuma xətası:", err.message);
    res.status(500).json({ error: "Log alınmadı" });
  }
});

app.get("/admin", (req, res) => {
  const adminPath = path.join(__dirname, "public", "admin", "index.html");
  const altPath = path.join(__dirname, "public", "index_admin.html");

  // əgər admin/index.html VARSA → onu aç
  if (fs.existsSync(adminPath)) {
    return res.sendFile(adminPath);
  }

  // əgər admin/index.html YOXDURSA → public/index_admin.html aç
  if (fs.existsSync(altPath)) {
    return res.sendFile(altPath);
  }

  return res.status(404).send("Admin panel tapılmadı.");
});

// 🌐 Frontend üçün fallback
app.get("*", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () =>
  console.log(`✅ Marketify AI is live on port ${PORT}`)
);

// 🔁 Render üçün keep-alive
setInterval(() => {
  fetch("https://marketify-ai.onrender.com").catch(() =>
    console.log("⚠️ Keep-alive ping alınmadı")
  );
}, 10 * 60 * 1000);