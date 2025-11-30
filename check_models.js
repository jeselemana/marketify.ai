import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listAvailableModels() {
  try {
    // API-dan model siyahısını çəkirik
    // Qeyd: Bu metod birbaşa API sorğusudur, ən dəqiq nəticəni verir.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`API Xətası: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    console.log("\n🔥 SƏNİN API AÇARIN ÜÇÜN AKTİV OLAN MODELLƏR:\n");
    
    const models = data.models || [];
    
    // Yalnız mətn yarada bilən modelləri süzürük (embedding modelləri lazım deyil)
    const chatModels = models.filter(m => 
      m.supportedGenerationMethods.includes("generateContent")
    );

    if (chatModels.length === 0) {
      console.log("⚠️ Heç bir model tapılmadı. API açarını və ya Billing-i yoxla.");
    } else {
      chatModels.forEach(m => {
        // Modelin texniki adı (bunu koda yazmalıyıq)
        const id = m.name.replace("models/", "");
        console.log(`✅ Ad: ${m.displayName} | 🆔 KOD: ${id}`);
      });
    }
    console.log("\n--------------------------------------------------\n");

  } catch (error) {
    console.error("❌ Modelləri tapmaq mümkün olmadı:", error.message);
  }
}

listAvailableModels();