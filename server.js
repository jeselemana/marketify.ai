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

// 🟦 GPT-5 limit sistemi — gündə 50 cavab
const gpt5Limits = {};
const GPT5_MAX_DAILY = 50;

// Limitin hər gün sıfırlanacağı saat (00:00)
const RESET_HOUR = "00:00";

// 🟩 İstifadəçi identifikasiyası (IP əsaslı)
function getUserId(req) {
  return req.ip;
}

// 🟨 Limitlərin sıfırlanma vaxtını yoxlayan funksiya
function shouldResetLimit(lastResetDate) {
  const now = new Date();
  const today = now.toDateString();

  // Gün dəyişibsə birbaşa sıfırla
  if (lastResetDate !== today) return true;

  // Saat sıfırlama nöqtəsini keçibsə sıfırla
  const [resetHour, resetMinute] = RESET_HOUR.split(":").map(Number);
  const resetTime = new Date();
  resetTime.setHours(resetHour, resetMinute, 0, 0);

  if (now >= resetTime) return true;

  return false;
}

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

// 🧠 HİBRİD INTENT ENGINE — əvvəl local semantic, tapmasa GPT
async function detectIntent(message) {
  const msg = message.toLowerCase();

  // 1️⃣ Semantic local intent paketləri
  const INTENTS = {
    slogan: [
      "sloqan",
      "slogan",
      "şüar",
      "tagline",
      "brand line",
      "reklam sloqanı",
      "brand slogan",
      "marka sloqanı",
      "şüar tap"
    ],
    budget: [
      "büdcə",
      "maliyyə",
      "planlama",
      "budget",
      "ads budget",
      "reklam xərci",
      "xərcləri",
      "maliyyə planı",
      "media plan",
      "ads cost"
    ],
    caption: [
      "instagram",
      "caption",
      "post yaz",
      "post ideyası",
      "sosial media",
      "post yarat",
      "reklam postu",
      "content yaz",
      "insta"
    ],
    tiktok: [
      "tiktok",
      "reels",
      "shorts",
      "video idea",
      "creative video",
      "kreativ video",
      "trend video",
      "video çəkmək",
      "video ideya"
    ],
    strategy: [
      "strategiya",
      "strategy",
      "business plan",
      "marketinq planı",
      "marketing plan",
      "bazar analizi"
    ],
    seo: [
      "seo",
      "google search",
      "axtarış sistemi",
      "seo analizi",
      "seo optimizasiya"
    ],
    email: [
      "email",
      "məktub",
      "mail yaz",
      "rəsmi məktub",
      "formal email",
      "məktub hazırlamaq"
    ],
    blog: [
      "blog",
      "məqalə",
      "article",
      "yazı yaz",
      "blog content",
      "məqalə yarat"
    ],
    sales: [
      "satış",
      "konversiya",
      "satış artırmaq",
      "satış funneli"
    ],
    branding: [
      "brend",
      "brand",
      "kimlik",
      "brand identity",
      "brend kimliyi",
      "marka kimliyi"
    ]
  };

  // 2️⃣ Lokal semantic score sistemi
  let bestIntent = null;
  let bestScore = 0;

  for (const key in INTENTS) {
    const keywords = INTENTS[key];
    let score = 0;

    for (const word of keywords) {
      if (msg.includes(word)) {
        score += word.length > 6 ? 2 : 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIntent = key;
    }
  }

  // 3️⃣ Əgər semantic engine TAPIRSA → GPT-yə ehtiyac YOXDUR
  if (bestScore > 0) {
    console.log("🧩 Lokal intent tapıldı:", bestIntent);
    return bestIntent;
  }

  // 4️⃣ Semantic tapa bilmədisə → GPT-ə sorğu göndər
  console.log("🤖 Semantic tapmadı → GPT intent engine aktiv oldu");

  try {
    const prompt = `
Aşağıdakı istifadəçi mesajına yalnız BİR SÖZLÜ intent adı qaytar.
Sadəcə intent adı yaz, başqa heç nə yazma.

Mesaj: "${message}"

Mümkün intent-lər:
slogan, caption, tiktok, budget, strategy, seo, branding,
blog, email, analysis, sales, creative, story, product,
announcement, general
    `;

    const completion = await openai.chat.completions.create({
      model: selectedModel === "gpt-5" ? "gpt-5" : "gpt-4o",
      messages: [
        { role: "system", content: "Sən yalnız intent təyin edən sistemsən." },
        { role: "user", content: prompt }
      ],
      temperature: 0.0,
      max_tokens: 10
    });

    let intent =
      completion.choices?.[0]?.message?.content?.trim()?.toLowerCase();

    const allowed = [
      "slogan",
      "caption",
      "tiktok",
      "budget",
      "strategy",
      "seo",
      "branding",
      "blog",
      "email",
      "analysis",
      "sales",
      "creative",
      "story",
      "product",
      "announcement",
      "general"
    ];

    if (!intent || !allowed.includes(intent)) {
      intent = "general";
    }

    console.log("🎯 GPT final intent:", intent);
    return intent;
  } catch (err) {
    console.error("GPT intent engine xətası:", err.message);
    return "general"; // fallback
  }
}

// 🔧 User input-u regex üçün escape etmək
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 🧩 GPT cavabından şablon çıxarma – hər mesajdan öyrənmək üçün
function extractTemplate(answer, userMessage) {
  if (!answer) return null;

  let template = answer;

  // İstifadəçi inputunu generikləşdir → {topic}
  const cleanUser = userMessage.trim();
  if (
    cleanUser.length > 3 &&
    template.toLowerCase().includes(cleanUser.toLowerCase())
  ) {
    const safeUser = escapeRegex(cleanUser);
    template = template.replace(new RegExp(safeUser, "gi"), "{topic}");
  }

  // Platform adlarını generikləşdir
  template = template.replace(/Instagram/gi, "{platform}");
  template = template.replace(/LinkedIn/gi, "{platform}");
  template = template.replace(/TikTok/gi, "{platform}");

  return template.trim();
}

// 🧠 Marketify Brain — Learning Layer
function learnFromGPT(userMessage, gptReply, intent) {
  try {
    ensureDataFiles();

    // 1) Log faylı
    const log = safeLoadJSON(KNOWLEDGE_LOG_PATH, []);
    log.push({
      question: userMessage,
      answer: gptReply,
      intent,
      timestamp: Date.now(),
    });
    safeSaveJSON(KNOWLEDGE_LOG_PATH, log.slice(-1000));

    // 2) Şablon çıxart
    const template = extractTemplate(gptReply, userMessage);
    if (!template) return;

    // 3) Baza faylına yaz
    const base = safeLoadJSON(BASE_PATH, {});
    if (!Array.isArray(base[intent])) {
      base[intent] = [];
    }

    const exists = base[intent].some(
      (t) => t && t.template === template
    );
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

// 💬 Sadə yaddaş (RAM-da saxlanır)
let conversationHistory = [];

// 🧠 CHAT ENDPOINT
app.post("/api/chat", async (req, res) => {    const userId = getUserId(req);

    // 🟥 YALNIZ GPT-5 üçün limit yoxlaması
    if (selectedModel === "gpt-5") {

      // İlk dəfə istifadə edən üçün obyekt yarat
      if (!gpt5Limits[userId]) {
        gpt5Limits[userId] = {
          count: 0,
          lastReset: new Date().toDateString()
        };
      }

      // Limiti sıfırlamaq lazımdırsa
      if (shouldResetLimit(gpt5Limits[userId].lastReset)) {
        gpt5Limits[userId].count = 0;
        gpt5Limits[userId].lastReset = new Date().toDateString();
      }

      // Limit keçilibsə → GPT-4o cavab versin
      if (gpt5Limits[userId].count >= GPT5_MAX_DAILY) {
        return res.json({
          reply: "⚠️ GPT-5 gündəlik limitini keçdin. Bu cavab GPT-4o ilə verildi.",
        });
      }

      // Əgər keçməyibsə → limiti artırırıq
      gpt5Limits[userId].count++;
    }

  try {
    const userMessage = req.body.message?.trim();
    const selectedModel = req.body.model || "gpt-4o-mini";

    if (!userMessage) {
      return res.status(400).json({ error: "Mesaj daxil edilməyib." });
    }

    // 🔹 Mesajı tarixçəyə əlavə et
    conversationHistory.push({ role: "user", content: userMessage });
    if (conversationHistory.length > 15) {
      conversationHistory = conversationHistory.slice(-15);
    }

    // 🔍 Intent-i bir dəfə hesablayırıq (həm local, həm learning üçün istifadə ediləcək)
    const intent = await detectIntent(userMessage);

    // 👇 LOCAL MODEL (Marketify Brain) MODU
    if (selectedModel === "local") {
      console.log("🤖 LOCAL MODEL aktivdir. Intent:", intent);

      ensureDataFiles();
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

    // 👇 GPT-4o üçün system prompt → brend tonu
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

    // 🤖 OpenAI cavabı
    const completion = await openai.chat.completions.create({
      model: selectedModel === "gpt-5" ? "gpt-5" : "gpt-4o",
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

    // 🧠 Marketify Brain — bu cavabdan öyrənir
    learnFromGPT(userMessage, reply, intent);

    res.json({ reply });
  } catch (err) {
    console.error("AI Xətası:", err);
    res.status(500).json({ error: "Server xətası." });
  }
});

// 💡 Söhbəti sıfırlama (Clear düyməsi üçün)
app.post("/api/clear", (req, res) => {
  conversationHistory = [];
  res.json({ ok: true });
});

// 💌 Feedback endpoint (istəsən aktiv istifadə edərsən)
app.post("/api/feedback", async (req, res) => {
  const { feedback, reply } = req.body;

  if (!feedback || !reply) {
    return res
      .status(400)
      .json({ success: false, error: "Məlumat çatışmır" });
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "marketify.ai.feedback@gmail.com",
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: "Marketify AI <marketify.ai.feedback@gmail.com>",
    to: "sənin_adressin@example.com", // buraya öz e-poçtunu yaz
    subject: `Yeni Marketify Rəyi (${feedback === "like" ? "👍" : "👎"})`,
    text: `İstifadəçi bu cavabı ${
      feedback === "like" ? "bəyəndi 👍" : "bəyənmədi 👎"
    }:\n\n"${reply}"`,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error("E-poçt göndərilmədi:", err);
    res.status(500).json({ success: false });
  }
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

// Admin UI
app.get("/admin", (req, res) => {
  const adminPath = path.join(__dirname, "public", "admin", "index.html");
  const altPath = path.join(__dirname, "public", "index_admin.html");

  if (fs.existsSync(adminPath)) {
    return res.sendFile(adminPath);
  }

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