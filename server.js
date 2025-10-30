import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Sən Marketify AI-sən — enerjili, kreativ və minimalist marketinq köməkçisisən. Cavablarını səmimi, dinamik və ilhamverici tonla ver.",
        },
        { role: "user", content: message },
      ],
    });
    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.json({
      reply:
        "⚡ Marketify AI hal-hazırda texniki fasilədədir. Amma sən yenə də ideyalarını itirmə! 💡",
    });
  }
});

app.listen(process.env.PORT || 5050, () =>
  console.log(`✅ Marketify AI is live on port ${process.env.PORT || 5050}`)
);