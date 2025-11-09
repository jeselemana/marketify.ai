import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { OpenAI } from "openai";
import fetch from "node-fetch";

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

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message?.trim();
    if (!userMessage) return res.status(400).json({ error: "Mesaj daxil edilməyib." });

    // İstifadəçinin mesajını tarixçəyə əlavə et
    conversationHistory.push({ role: "user", content: userMessage });

    // Tarixçəni çox uzatmasın deyə, son 10 mesaj saxlanır
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    // Modeli çağır
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.7,
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content: `You are Marketify AI — a next-gen marketing assistant created by Innova Group Azerbaijan.
          Speak like a friendly, confident marketing expert. Stay natural and creative.`,
        },
        ...conversationHistory,
      ],
    });

    const reply = completion.choices?.[0]?.message?.content || "Cavab alınmadı 😔";

    // Bot cavabını tarixçəyə əlavə et
    conversationHistory.push({ role: "assistant", content: reply });

    res.json({ reply });
  } catch (error) {
    console.error("OpenAI xətası:", error.message);
    res.status(500).json({ error: "Server xətası, AI cavab vermədi." });
  }
});

// 💡 “Söhbəti sıfırla” üçün ayrıca endpoint (Clear düyməsi üçün istəyə görə)
app.post("/api/clear", (req, res) => {
  conversationHistory = [];
  res.json({ ok: true });
});

app.get("*", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`✅ Marketify AI is live on port ${PORT}`));

setInterval(() => {
  fetch("https://marketify-ai.onrender.com").catch(() =>
    console.log("⚠️ Keep-alive ping alınmadı")
  );
}, 10 * 60 * 1000);