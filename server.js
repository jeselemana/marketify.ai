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

// 🧠 Intent Engine (semantic)
// 🧠 Hybrid Intent Detection Engine
async function detectIntent(message) {
  const msg = message.toLowerCase();

  // 1) — FAST KEYWORD ENGINE (balans xərci = 0)
  const INTENTS = {
    slogan: [
      "sloqan", "slogan", "şüar", "tagline", "brand line",
      "reklam sloqanı", "brand slogan", "marka sloqanı",
      "loqo yazısı", "şüar tap"
    ],
    budget: [
      "büdcə", "maliyyə", "planlama", "budget",
      "ads budget", "reklam xərci", "xərcləri",
      "maliyyə planı", "media plan", "ads cost"
    ],
    caption: [
      "instagram", "caption", "post yaz", "post ideyası",
      "sosial media", "post yarat", "reklam postu",
      "content yaz", "insta"
    ],
    tiktok: [
      "tiktok", "reels", "shorts", "video idea",
      "creative video", "kreativ video", "trend video",
      "video çəkmək", "video ideya"
    ],
    strategy: [
      "strategiya", "strategy", "business plan",
      "marketinq planı", "marketing plan", "bazar analizi"
    ],
    seo: [
      "seo", "google search", "axtarış sistemi",
      "seo analizi", "seo optimizasiya"
    ],
    email: [
      "email", "məktub", "mail yaz", "rəsmi məktub",
      "formal email", "məktub hazırlamaq"
    ],
    blog: [
      "blog", "məqalə", "article", "yazı yaz",
      "blog content", "məqalə yarat"
    ]
  };

  let bestIntent = "general";
  let bestScore = 0;

  for (const intentName in INTENTS) {
    const keywords = INTENTS[intentName];
    let score = 0;

    for (const word of keywords) {
      if (msg.includes(word)) {
        score += word.length > 6 ? 2 : 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = intentName;
    }
  }

  // Əgər açıq-aşkar intent tapılıbsa → dərhal qaytar ✨
  if (bestScore > 0) {
    return bestIntent;
  }

  // 2) — GPT FALLBACK ENGINE (yalnız lazım olanda çağırılır)
  try {
    const ai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const gptIntent = await ai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 60,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `
Mesajı analiz edib aşağıdakılardan birini yalnız JSON formatında qaytar:
"slogan", "budget", "caption", "tiktok", "strategy", "seo", "email", "blog", "general".

Cavab forması:
{"intent":"caption"}
           `
        },
        { role: "user", content: message }
      ]
    });

    const json = JSON.parse(gptIntent.choices[0].message.content);

    if (json.intent) return json.intent;
  } catch (err) {
    console.log("⚠️ GPT intent fallback xətası:", err.message);
  }

  // Əgər hər ehtimala qarşı heç nə tapılmasa → general
  return "general";
}

// 🧠 Marketify Brain — Learning Layer
function learnFromGPT(userMessage, gptReply) {
  try {
    ensureDataFiles();

    const log = safeLoadJSON(KNOWLEDGE_LOG_PATH, []);
    log.push({
      question: userMessage,
      answer: gptReply,
      intent: detectIntent(userMessage),
      timestamp: Date.now(),
    });
    safeSaveJSON(KNOWLEDGE_LOG_PATH, log.slice(-1000));

    const intent = detectIntent(userMessage);
    const template = extractTemplate(gptReply, userMessage);
    if (!template) return;

    const base = safeLoadJSON(BASE_PATH, {});
    if (!Array.isArray(base[intent])) base[intent] = [];

    const exists = base[intent].some((t) => t.template === template);
    if (exists) return;

    base[intent].push({
      template,
      createdAt: Date.now(),
    });

    safeSaveJSON(BASE_PATH, base);

    console.log(`🧠 Marketify Brain: Yeni şablon öyrəndi → [${intent}]`);
  } catch (err) {
    console.error("Öyrənmə xətası:", err);
  }
}

let conversationHistory = [];

// 🧠 CHAT ENDPOINT
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message?.trim();
    const selectedModel = req.body.model || "gpt-4o-mini";

    if (!userMessage)
      return res.status(400).json({ error: "Mesaj daxil edilməyib." });

    conversationHistory.push({ role: "user", content: userMessage });
    if (conversationHistory.length > 15)
      conversationHistory = conversationHistory.slice(-15);

    // LOCAL MODEL
    if (selectedModel === "local") {
      console.log("🤖 LOCAL MODEL aktivdir.");

      ensureDataFiles();
      const intent = detectIntent(userMessage);
      const base = safeLoadJSON(BASE_PATH, {});
      const templates = base[intent] || [];

      if (templates.length === 0) {
        return res.json({
          reply:
            "Bu mövzu hələ Marketify Brain-də tam öyrənilməyib 🤖💛\n\nAmma izah etsən, kömək edə bilərəm! ✨",
        });
      }

      const random = templates[Math.floor(Math.random() * templates.length)];
      let finalText = random.template;

      finalText = finalText.replace("{topic}", userMessage);
      finalText = finalText.replace("{platform}", "Instagram");

      return res.json({ reply: finalText });
    }

    // GPT-4o mini üçün system prompt → tam brend tonu
    const systemPrompt = {
      role: "system",
      content: `
Sən Marketify AI adlanan enerjili, səmimi və az rəsmi tonda danışan süni intellektsən. 🇦🇿  

**Sən Marketify AI platformasının əsas modelisən** — istifadəçilərlə Marketify ruhunda danışırsan.

💬 TON QAYDALARI:
- Rəsmi yazma, amma düzgün Azərbaycan dilində danış.
- Yazı tərzin müasir, rahat və yaradıcı olsun.
- Emoji-lərdən təbii istifadə et 😊
- Cavablar çox uzun olmasın, dialoqa uyğun olsun.
- Azərbaycan istifadəçisinə uyğun yaz: yerli nümunələr, ifadələr.
- Bir az zarafatcıl və cool ol 😎

❌ QADAĞA:
- Türkiyə türkcəsi işlətmə (“sen”, “ama”, “biraz”, “çok”, “şey”).

🎯 Nümunələr:
- “Bu ideya lap sənlikdi 😎”
- “Gəl bunu daha yaradıcı edək 💡”
- “Bax, sadə dildə deyim sənə 😊”

Sənin missiyan: istifadəçiyə səmimi, kreativ və brend ruhunda cavab verməkdir.
      `,
    };

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

    learnFromGPT(userMessage, reply);

    res.json({ reply });
  } catch (err) {
    console.error("AI Xətası:", err);
    res.status(500).json({ error: "Server xətası." });
  }
});

// Clear
app.post("/api/clear", (req, res) => {
  conversationHistory = [];
  res.json({ ok: true });
});

// Admin endpoints (eyni saxlanılıb)
app.get("/admin/api/stats", (req, res) => {
  try {
    ensureDataFiles();
    const base = safeLoadJSON(BASE_PATH, {});
    const log = safeLoadJSON(KNOWLEDGE_LOG_PATH, []);
    const intents = Object.keys(base);

    const totalTemplates = intents.reduce(
      (sum, k) => sum + base[k].length,
      0
    );

    res.json({
      totalTemplates,
      totalIntents: intents.length,
      totalLogEntries: log.length,
    });
  } catch (err) {
    res.status(500).json({ error: "Stats alınmadı" });
  }
});

app.get("/admin/api/templates", (req, res) => {
  try {
    ensureDataFiles();
    res.json({
      base: safeLoadJSON(BASE_PATH, {}),
      trash: safeLoadJSON(TRASH_PATH, {}),
    });
  } catch {
    res.status(500).json({ error: "Template alınmadı" });
  }
});

// Admin UI
app.get("/admin", (req, res) => {
  const path1 = path.join(__dirname, "public", "admin", "index.html");
  const path2 = path.join(__dirname, "public", "index_admin.html");
  if (fs.existsSync(path1)) return res.sendFile(path1);
  if (fs.existsSync(path2)) return res.sendFile(path2);
  res.status(404).send("Admin tapılmadı.");
});

// Frontend fallback
app.get("*", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () =>
  console.log(`✅ Marketify AI is live on port ${PORT}`)
);

// Render keep-alive
setInterval(() => {
  fetch("https://marketify-ai.onrender.com").catch(() =>
    console.log("⚠️ Keep-alive alınmadı")
  );
}, 10 * 60 * 1000);