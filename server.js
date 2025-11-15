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

  // Hər intent üçün semantic KEYWORD paketi
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

  // Semantic ağırlıqlı matching sistemi
  let bestIntent = "general";
  let bestScore = 0;

  for (const intentName in INTENTS) {
    const keywords = INTENTS[intentName];

    let score = 0;

    for (const word of keywords) {
      if (msg.includes(word)) {
        // Uzun sözlərə daha çox bal
        score += word.length > 6 ? 2 : 1;
      }
    }

    // Ən yüksək score hansı intent-dədirsə onu seç
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intentName;
    }
  }

  return bestIntent;
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
    template = template.replace(new RegExp(cleanUser, "gi"), "{topic}");
  }

  // Platform adlarını generikləşdir
  template = template.replace(/Instagram/gi, "{platform}");
  template = template.replace(/LinkedIn/gi, "{platform}");
  template = template.replace(/TikTok/gi, "{platform}");

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

    // Son 1000 log saxla ki, fayl şişməsin
    const trimmedLog = log.slice(-1000);
    safeSaveJSON(KNOWLEDGE_LOG_PATH, trimmedLog);

    // 2) Intent tap
    const intent = detectIntent(userMessage);

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
    const selectedModel = req.body.model || "gpt-4o-mini"; // 👈 Frontend-dən gəlir: "local" və ya default

    if (!userMessage) {
      return res.status(400).json({ error: "Mesaj daxil edilməyib." });
    }

    // 🔹 İstifadəçi mesajını tarixçəyə əlavə et
    conversationHistory.push({ role: "user", content: userMessage });
    if (conversationHistory.length > 15) {
      conversationHistory = conversationHistory.slice(-15);
    }

    // 👇👇👇 LOCAL MODEL BURADA İŞƏ DÜŞÜR 👇👇👇
    if (selectedModel === "local") {
      console.log("🤖 Local (Marketify Brain) cavabı göndərildi.");

      ensureDataFiles();
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

      let finalText = random.template;
      finalText = finalText.replace("{topic}", userMessage);
      finalText = finalText.replace("{platform}", "Instagram");

      return res.json({ reply: finalText });
    }

    // 👇👇👇 BURADAN AŞAĞI SADECE GPT-4o mini ÜÇÜN 👇👇👇

    const systemPrompt = {
      role: "system",
      content: `
Sən Marketify AI adlanan enerjili, səmimi və az rəsmi tonda danışan süni intellektsən. 🇦🇿  
**Sən özün Marketify AI platformasının əsas modelisən**, Marketify isə səni yaradan brenddir (Innova Group Azerbaijan).  
Yəni sən istifadəçilərlə Marketify AI adından danışırsan, onları Marketify kimi qəbul etmə.

💬 TON QAYDALARI:
- Rəsmi yazma, amma düzgün Azərbaycan dilində danış.
- Yazı tərzin müasir, rahat və yaradıcı olsun.
- Emoji-lərdən təbii və lazım olduqda istifadə et 😊
- Cavabların çox uzun olmasın, sanki dostunla danışırsan.
- Mövzunu izah edərkən, Azərbaycan istifadəçisinə yönəl: yerli nümunələr, yerli brendlər və ifadələrdən istifadə et.
- “Marketify ruhu” saxla: enerjili, müasir, texnoloji və bir az zarafatcıl 😎

❌ Heç vaxt Türkiyə türkcəsindəki ifadələri işlətmə (örnək: “sen”, “ama”, “biraz”, “şey”, “çok”).

💡 Məsələn:
- “Bu ideya sənlikdi 😎”
- “Bax, bu məsələni belə sadə izah edim 💡”
- “Əla düşünmüsən, gəl belə yanaşaq!”

Sənin məqsədin: Marketify AI platformasında istifadəçilərə sanki real azərbaycanlı gənc kimi, brend ruhunda cavab verməkdir.
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

    // 🧠 Local Brain öyrənir (hər GPT cavabından)
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

// 💌 Feedback endpoint (əvvəlki kimi saxlayıram – istəsən istifadə edərsən)
app.post("/api/feedback", async (req, res) => {
  const { feedback, reply } = req.body;

  if (!feedback || !reply) {
    return res.status(400).json({ success: false, error: "Məlumat çatışmır" });
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
app.listen(PORT, () => {
  console.log(`✅ Marketify AI is live on port ${PORT}`);
});

// 🔁 Render üçün keep-alive
setInterval(() => {
  fetch("https://marketify-ai.onrender.com").catch(() =>
    console.log("⚠️ Keep-alive ping alınmadı")
  );
}, 10 * 60 * 1000);