import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { OpenAI } from "openai";
import fetch from "node-fetch";
import nodemailer from "nodemailer";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 💬 Sadə sessiya yaddaşı (RAM-da saxlanır)
let conversationHistory = [];

// 🧠 Chat Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message?.trim();
    if (!userMessage)
      return res.status(400).json({ error: "Mesaj daxil edilməyib." });

    // İstifadəçinin mesajını tarixçəyə əlavə et
    conversationHistory.push({ role: "user", content: userMessage });

    // Tarixçəni çox uzatmasın deyə, son 20 mesaj saxlanır
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    // 💬 Marketify Style təlimatı əlavə edirik
    const systemPrompt = {
      role: "system",
      content: `
      Sən Marketify AI adlanan enerjili və yaradıcı brendin süni intellektisən.
      Marketify, Innova Group Azerbaijan tərəfindən yaradılmışdır.
      Tonun: isti, səmimi, pozitiv və motivasiya doludur.
      Sadəcə cavab vermə — qarşıdakı ilə insan kimi danış.
      Emoji-lərdən təbii şəkildə istifadə et (amma çox yox).
      Yazı tərzin dostyana və yaradıcı olmalıdır.
      Formal yox, brend tonunda yaz (Apple, Notion, Marketify üslubunda).
      Hər cavabda yaradıcı enerji və “biz bunu bacararıq” ruhu hiss olunsun.
      Əgər mövzu çox akademikdirsə, onu insaniləşdir və emosional tonda təqdim et.
      Nümunə ton:
      “Gəlin belə edək 💡” və ya “Bu ideya sənlikdi 😎” kimi.
      `,
    };

    // Modeli çağır
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.85,
      max_tokens: 1500,
      messages: [systemPrompt, ...conversationHistory],
    });

    const reply =
      completion.choices?.[0]?.message?.content || "Cavab alınmadı 😔";

    // Bot cavabını tarixçəyə əlavə et
    conversationHistory.push({ role: "assistant", content: reply });

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

// 💌 Feedback endpoint
app.post("/api/feedback", async (req, res) => {
  const { feedback, reply } = req.body;
  if (!feedback || !reply)
    return res.status(400).json({ error: "Məlumat natamamdır." });

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