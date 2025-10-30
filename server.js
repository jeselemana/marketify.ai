import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { OpenAI } from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // frontend fayllar üçün

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// API endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: userMessage }],
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Render üçün dinamik port
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`✅ Marketify AI is live on port ${PORT}`);
});