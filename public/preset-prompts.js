import { getLanguage } from "./i18n.js";

export const PRESET_PROMPTS_BY_LOCALE = {
  az: {
    ask: [
      { title: "Performansı analiz et", text: "Bu strategiyanın əsas güclü və zəif tərəflərini analiz et, ən vacib 3 inkişaf imkanını prioritetləşdir." },
      { title: "Bazar araşdırması", text: "Bu biznes üçün bazarı, hədəf auditoriyanı və əsas trendləri araşdırmaq üçün strukturlaşdırılmış yanaşma təklif et." },
      { title: "Rəqib müqayisəsi", text: "Əsas rəqiblərlə müqayisədə fərqlənmə imkanlarını və nəzərə alınmalı riskləri müəyyən et." },
      { title: "Büdcəni optimallaşdır", text: "Mövcud marketinq büdcəsini kanallar, məqsədlər və gözlənilən təsir üzrə necə optimallaşdırmaq olar?" },
      { title: "Növbəti addımları seç", text: "Bu strategiya üçün ən yüksək təsirli növbəti addımları 30 günlük praktik plan kimi sırala." },
    ],
    build: [
      { title: "Marketinq strategiyası", text: "Biznesim üçün hədəf auditoriya, mövqelənmə, kanallar, büdcə və KPI-ları əhatə edən marketinq strategiyası hazırla." },
      { title: "Kampaniya planı", text: "Yeni məhsul üçün məqsəd, mesaj, kanallar, zaman xətti, büdcə və ölçmə çərçivəsi ilə kampaniya planı qur." },
      { title: "Kontent planı", text: "Hədəf auditoriyaya uyğun 30 günlük kontent planı yarat: mövzular, formatlar, paylaşım ritmi və CTA-lar daxil olsun." },
      { title: "Go-to-market planı", text: "Məhsulu bazara çıxarmaq üçün mərhələli go-to-market planı hazırla: hədəf seqmentlər, təklif, kanallar və ilk 90 günün addımları." },
      { title: "Böyümə planı", text: "Ölçülə bilən hədəflər, test ideyaları, kanallar və həftəlik yoxlama nöqtələri ilə growth planı qur." },
    ],
  },
  en: {
    ask: [
      { title: "Analyze Performance", text: "Analyze the core strengths and weaknesses of this strategy and prioritize the top 3 growth opportunities." },
      { title: "Market Research", text: "Propose a structured methodology to research the target market, ideal customer profile, and current industry trends." },
      { title: "Competitor Comparison", text: "Identify key differentiation opportunities and strategic risks relative to main market competitors." },
      { title: "Optimize Budget", text: "How should our current marketing budget be allocated across channels, milestones, and expected ROI for maximum efficiency?" },
      { title: "Prioritize Next Steps", text: "Outline the highest-impact action items for this strategy as a concrete 30-day execution roadmap." },
    ],
    build: [
      { title: "Marketing Strategy", text: "Develop an end-to-end marketing strategy covering target audience, market positioning, acquisition channels, budget allocation, and core KPIs." },
      { title: "Campaign Roadmap", text: "Create a complete product launch campaign with clear objectives, messaging architecture, channels, timeline, budget, and measurement framework." },
      { title: "Content Plan", text: "Generate an actionable 30-day content roadmap tailored to our target audience, including themes, creative formats, posting cadences, and CTAs." },
      { title: "Go-to-Market Strategy", text: "Structure a phased go-to-market strategy covering target customer segments, value proposition, channel validation, and key 90-day deliverables." },
      { title: "Growth Strategy", text: "Design a scalable growth roadmap with measurable milestones, channel experimentation backlog, and weekly review checkpoints." },
    ],
  },
};

export function getPresetPrompts(mode, lang = null) {
  const currentLang = lang || getLanguage();
  const prompts = PRESET_PROMPTS_BY_LOCALE[currentLang] || PRESET_PROMPTS_BY_LOCALE.az;
  return prompts[mode] || prompts.build;
}

export const PRESET_PROMPTS = new Proxy(PRESET_PROMPTS_BY_LOCALE.az, {
  get(target, prop) {
    const lang = getLanguage();
    const localized = PRESET_PROMPTS_BY_LOCALE[lang] || PRESET_PROMPTS_BY_LOCALE.az;
    return localized[prop] || target[prop];
  },
});
