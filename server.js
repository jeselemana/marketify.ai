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


// 🔥 REDIS (Analytics limit üçün)
import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
});

// Event listeners — createClient-dən SONRA gəlməlidir
redis.on("connect", () => console.log("🔥 Redis connected"));
redis.on("error", (err) => console.error("❌ Redis error:", err));

// Render-da auto-reconnect üçün
redis.connect().catch((err) =>
  console.error("❌ Redis connection error:", err)
);

// Günlük limit yoxlama funksiyası
async function canUseAnalytics(ip) {
  const today = new Date().toISOString().slice(0, 10);
  const key = `analytics:${ip}:${today}`;

  const count = await redis.get(key);

  if (count && parseInt(count) >= 1) {
    return false;
  }

  await redis.incr(key);
  await redis.expire(key, 60 * 60 * 24); // 24 saatlıq TTL

  return true;
}


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

// 🧠 HİBRİD INTENT ENGINE — əvvəl local semantic, tapmasa GPT-4o-mini
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
      "şüar tap",
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
      "ads cost",
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
      "insta",
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
      "video ideya",
    ],
    strategy: [
      "strategiya",
      "strategy",
      "business plan",
      "marketinq planı",
      "marketing plan",
      "bazar analizi",
    ],
    seo: [
      "seo",
      "google search",
      "axtarış sistemi",
      "seo analizi",
      "seo optimizasiya",
    ],
    email: [
      "email",
      "məktub",
      "mail yaz",
      "rəsmi məktub",
      "formal email",
      "məktub hazırlamaq",
    ],
    blog: [
      "blog",
      "məqalə",
      "article",
      "yazı yaz",
      "blog content",
      "məqalə yarat",
    ],
    sales: ["satış", "konversiya", "satış artırmaq", "satış funneli"],
    branding: [
      "brend",
      "brand",
      "kimlik",
      "brand identity",
      "brend kimliyi",
      "marka kimliyi",
    ],
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

  // 4️⃣ Semantic tapa bilmədisə → GPT-4o-mini-yə sorğu göndər
  console.log("🤖 Semantic tapmadı → GPT-4o-mini intent engine aktiv oldu");

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
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sən yalnız intent təyin edən sistemsən." },
        { role: "user", content: prompt },
      ],
      temperature: 0.0,
      max_tokens: 10,
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
      "general",
    ];

    if (!intent || !allowed.includes(intent)) {
      intent = "general";
    }

    console.log("🎯 GPT-mini final intent:", intent);
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

    const exists = base[intent].some((t) => t && t.template === template);
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
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message?.trim();
    const selectedModel = req.body.model || "gpt-4o";

if (selectedModel === "gpt-5.1-analytics") {
  // Render + Proxy serverlər üçün real IP-ni düzgün almaq
  const userIp =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.ip;

  console.log("🔍 Analytics request from IP:", userIp);

  if (!(await canUseAnalytics(userIp))) {
    return res.json({
      reply:
        "⚠️ Bu gün üçün Analitika Rejimi üzrə istifadə limitini tamamladın.\nXidmət keyfiyyətini stabil saxlamaq üçün gün ərzində bütün istifadəçilərə müəyyən limit tətbiq edirik.\nLimit sabah yenilənəcək və funksiyanı yenidən istifadə edə biləcəksən.\n\nℹ️ Söhbətə qaldığın yerdən davam etmək üçün cari \"🔎 Analitika\" modelini digər hər hansı bir modelə dəyişə bilərsən.\n\nAnlayışın üçün təşəkkür edirik!",
    });
  }
}

    if (!userMessage) {
      return res.status(400).json({ error: "Mesaj daxil edilməyib." });
    }

    // 🔹 Mesajı tarixçəyə əlavə et
    conversationHistory.push({ role: "user", content: userMessage });
    if (conversationHistory.length > 3) {
      conversationHistory = conversationHistory.slice(-3);
    }

    // 🏷️ İntentlərin İstifadəçi Dostu Adları (hazırda yalnız suggestion üçün idi, amma qalsın)
    const INTENT_LABELS = {
      slogan: "✍️ Sloqan və Şüarlar",
      budget: "💰 Büdcə və Maliyyə",
      caption: "📸 Instagram Postları",
      tiktok: "🎥 TikTok və Reels",
      strategy: "🚀 Marketinq Strategiyası",
      seo: "🔎 SEO və Axtarış",
      email: "📧 Email Marketinq",
      blog: "📝 Blog və Məqalələr",
      sales: "📈 Satış Taktikaları",
      branding: "🎨 Brendinq",
      general: "💡 Ümumi İdeyalar",
    };

    // 🔍 Intent-i bir dəfə hesablayırıq (həm local, həm learning üçün istifadə ediləcək)
    const intent = await detectIntent(userMessage);

    // 👇 LOCAL MODEL (Marketify Brain) MODU
    if (selectedModel === "local") {
      console.log("🤖 LOCAL MODEL aktivdir. Intent:", intent);

      ensureDataFiles();
      const base = safeLoadJSON(BASE_PATH, {});
      const templates = base[intent] || [];

      // ⚠️ ƏGƏR ŞABLON VARSA → sadəcə lokal cavab ver
      if (templates.length > 0) {
        const random =
          templates[Math.floor(Math.random() * templates.length)];
        let finalText = random.template;

        finalText = finalText.replace("{topic}", userMessage);
        finalText = finalText.replace("{platform}", "Instagram");

        return res.json({ reply: finalText });
      }

      // ⚠️ ƏGƏR ŞABLON YOXDUR → LOCAL SUSUR,
      // AŞAĞIDA GPT-Ə GETMƏK ÜÇÜN HEÇ BİR RETURN ETMİRİK.
      console.log(
        "📚 Brain-də bu intent üçün şablon yoxdur → cavab GPT-dən alınacaq və Brain öyrənəcək."
      );
    }

    // 👇 GPT-4o üçün system prompt → brend tonu
    const systemPrompt = {
      role: "system",
      content: `

You are Marketify AI, the main AI model of a SaaS platform owned by Innova Group.

You must sound natural, confident, and GPT-like.
You are allowed to structure responses clearly.
You are NOT allowed to sound academic, robotic, or instructional.

LANGUAGE & COMMUNICATION

- Detect the user's language automatically.
- Reply in the same language.
- Do not mix languages.
- If unclear, default to Azerbaijani.

Language rules:
- Azerbaijani: always use “sən”, NEVER “siz”.
- Clean Azerbaijani only (no Turkish grammar).
- Turkish: casual Istanbul Turkish.
- English / Russian: natural, GPT-like.

If asked who you are:
“I am Marketify AI, the main AI model of a SaaS platform owned by Innova Group.”
(Translate naturally.)

TONE

- Human, relaxed, confident
- Not formal, not corporate
- Emojis are allowed and natural
- Responses may start with an emoji

STRUCTURE RULE (CRITICAL)

You MUST actively use structure when it improves clarity.

This includes:
- Big headers
- Short sections
- Light dividers

Do NOT avoid structure.
Use it intelligently.

HEADERS (IMPORTANT)

- Use a BIG header when:
  - the topic changes
  - multiple ideas are presented
  - the answer would otherwise feel messy

- Headers should be short and natural.
- Headers are NOT academic titles.
- Headers are allowed and encouraged.

Example:
“## Niyə bu işləyir”
“## Burda səhv hardadır”

DIVIDERS (IMPORTANT)

- Use a divider to separate:
  - examples from explanation
  - main idea from alternative
  - different tones or angles

- Divider must be subtle.
- Divider is a visual pause, not a wall.

Allowed styles:
"···"
"— — —"

CONTENT CREATION OVERRIDE

When the user asks for marketing, sales, or creative content:
- Do NOT explain.
- Do NOT teach.
- Produce usable output.

ANTI-GENERIC RULE

If a response starts to look like:
- tips
- advice lists
- educational explanation

STOP.
Rewrite it into applied, real-world language.

MOBILE OUTPUT

- Text must look clean on a phone.
- No long paragraphs.
- Structure must help readability, not hurt it.

IDENTITY

- You are Marketify AI.
- You think clearly.
- You structure when needed.
- You sound like GPT at its best — not worse, not safer.

Be clear. Be structured. Be natural.
      `,
    };

    // 🔥 SYSTEM PROMPT seçimi
    let finalSystemPrompt = systemPrompt;

    // 🔥 Mesaj strukturu
    let messagesToSend = [];

    // 🔥 Model konfiqurasiyası
    let settings = {
      model: "gpt-4o",
      temperature: 0.5,
      presence_penalty: 0.2,
      frequency_penalty: 0.1,
    };

    // ANALYTICS model seçilibsə → GPT-5.1 istifadə et
    if (selectedModel === "gpt-5.1-analytics") {
      settings.model = "gpt-5.1";

      finalSystemPrompt = {
        role: "system",
        content: `
Sən Marketify AI Analitika modulusan.

— Cavabları maksimum 3–5 cümlə arasında saxla.
— Emoji istifadə edə bilərsən, amma çox yox 😊
— Ton: səliqəli, fokuslanmış, çox yığcam və dərin.
— Faktlara söykən, səthi danışma.
— lazımsız giriş/uzatma/şablon cümlələr yazma.

❌ QADAĞA:
- Cavabları çox uzatma
- Cavabların rəsmi tonda olsun, amma tam akademik ton istifadə etmə
- Türkçe ifadələr istifadə etmə: "Çok", "İyi", "Hadi", "Haydi", "Merakla", "Fakat", "İşletme" və hər zaman cavabların Türkçe ifadələrlə qarışmaması üçün onları diqqətlə nəzərdən keçir.

Məqsəd: qısa, aydın və yüksək səviyyəli analitik cavab verməkdir.
`,
      };

      // Tarixçə qalır — sadəcə systemPrompt dəyişir
      messagesToSend = [finalSystemPrompt, ...conversationHistory];

      // Analitik setting-lər
      settings.temperature = 0.25;
      settings.presence_penalty = 0;
      settings.frequency_penalty = 0;
    } else {
      // Kreativ mod (default Marketify tone)
      messagesToSend = [finalSystemPrompt, ...conversationHistory];
    }

    // 🔥 OPENAI REQUEST
    const completion = await openai.chat.completions.create({
      ...settings,
      messages: messagesToSend,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Cavab alınmadı 😅";

    conversationHistory.push({ role: "assistant", content: reply });

    // 🧠 Marketify Brain — bu cavabdan öyrənir (BÜTÜN GPT modellərində)
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