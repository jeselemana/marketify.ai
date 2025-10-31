import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Frontend fayllar (index.html, style.css, script.js)

// 🔹 OpenAI müştərisini qoşuruq
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔹 Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage)
      return res.status(400).json({ error: "Mesaj daxil edilməyib." });

    // 🧠 OpenAI cavabı
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: userMessage }],
    });

    const reply = completion.choices?.[0]?.message?.content || "Cavab alınmadı 😔";
    res.json({ reply });
  } catch (error) {
    console.error("OpenAI xətası:", error.message);
    res.status(500).json({ error: "Server xətası, AI cavab vermədi." });
  }
});

// 🔹 Frontend üçün “catch-all” route (Render-də vacibdir)
app.get("*", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

// 🔹 Render port
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`✅ Marketify AI is live on port ${PORT}`);
});

// 🟢 Serveri aktiv saxlamaq üçün "Keep Alive" sistemi
import fetch from "node-fetch";

setInterval(() => {
  fetch("https://marketify-ai.onrender.com").catch(() =>
    console.log("⚠️ Keep-alive ping alınmadı")
  );
}, 10 * 60 * 1000); // hər 10 dəqiqədən bir