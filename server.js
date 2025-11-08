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

app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage)
      return res.status(400).json({ error: "Mesaj daxil edilməyib." });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // istəsən buranı "gpt-4o" ilə əvəz et
      temperature: 0.5,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: "You are Marketify AI, a creative and professional marketing assistant developed by Innova Group Azerbaijan. You provide smart, brand-focused, and visually structured responses. Always use a confident, helpful, and modern tone.",
        },
        { role: "user", content: userMessage },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content || "Cavab alınmadı 😔";
    res.json({ reply });
  } catch (error) {
    console.error("OpenAI xətası:", error.message);
    res.status(500).json({ error: "Server xətası, AI cavab vermədi." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(process.cwd() + "/public/index.html");
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`✅ Marketify AI is live on port ${PORT}`);
});

setInterval(() => {
  fetch("https://marketify-ai.onrender.com").catch(() =>
    console.log("⚠️ Keep-alive ping alınmadı")
  );
}, 10 * 60 * 1000);