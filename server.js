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

// 💬 Sadə yaddaş (RAM-da saxlanır)
let conversationHistory = [];

// 🧠 Chat Endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message?.trim();
    if (!userMessage)
      return res.status(400).json({ error: "Mesaj daxil edilməyib." });

    // 🔹 İstifadəçi mesajını tarixçəyə əlavə et
    conversationHistory.push({ role: "user", content: userMessage });
    if (conversationHistory.length > 15)
      conversationHistory = conversationHistory.slice(-15);

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

  ❌ Heç vaxt Türkiyə türkcəsindəki ifadələri işlətmə (örnək: ‘sen’, ‘ama’, ‘biraz’, ‘şey’, ‘çok’).

  💡 Məsələn:
  - “Bu ideya sənlikdi 😎”
  - “Bax, bu məsələni belə sadə izah edim 💡”
  - “Əla düşünmüsən, gəl belə yanaşaq!”

  Sənin məqsədin: Marketify AI platformasında istifadəçilərə sanki real azərbaycanlı gənc kimi, brend ruhunda cavab verməkdir.
  `
};

    // 🤖 Model cavabı
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // istəsən "gpt-4o" qoy, amma -mini daha sürətlidir
      temperature: 0.9, // daha sərbəst və kreativ ton üçün
      presence_penalty: 0.4,
      frequency_penalty: 0.25,
      max_tokens: 1200,
      messages: [systemPrompt, ...conversationHistory],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Cavab alınmadı 😅";

    // 🔹 Cavabı tarixçəyə əlavə et
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