// Synthetic content for homepage screenshots and local UI verification only.
export const strategy = {
  title: "Bakıda coffee shop üçün bazara giriş",
  summary: "Keyfiyyətli qəhvə və sakit iş mühiti axtaran auditoriyaya fokuslan. Açılışdan əvvəl yerli icma qur, ilk ziyarəti aydın təkliflə təşviq et və təkrar ziyarətlər üçün səbəb yarat.",
  context: { business: "Premium coffee shop", objective: "Yerli auditoriyaya çıxış və təkrar ziyarətlər", market: "Bakı, Azərbaycan", targetAudience: "Yaxınlıqda yaşayan və işləyən qəhvə həvəskarları" },
  priorities: [
    { title: "Aydın mövqelənmə", description: "Keyfiyyətli qəhvə, diqqətli xidmət və rahat iş mühiti.", priority: "high" },
    { title: "Yerli kəşf olunma", description: "Xəritələr, məhəllə tərəfdaşlıqları və yerli məzmun.", priority: "high" },
    { title: "Təkrar ziyarət", description: "Qonaq təcrübəsi və sadə loyallıq proqramı.", priority: "medium" },
  ],
  sections: [
    { id: "positioning", title: "Mövqelənmə", summary: "Gündəlik qəhvə ritualı üçün etibarlı ünvan.", content: "Məkanın atmosferini, qəhvənin mənşəyini və xidmət yanaşmasını vahid kommunikasiya xəttində birləşdir.", bullets: ["Məkanın dəyərini konkret nümunələrlə göstər."] },
    { id: "channels", title: "Kanallar", summary: "Yaxın auditoriyaya çat.", content: "Yerli axtarış, xəritələr və sosial media məzmununu açılış planı ilə əlaqələndir.", bullets: ["Xəritə profilində ünvanı və iş saatlarını dəqiqləşdir."] },
    { id: "offer", title: "İlk ziyarət təklifi", summary: "Yeni qonağa sadə seçim ver.", content: "Açılış həftəsində qəhvə ilə uyğun məhsulları birləşdirən aydın menyu təklifi hazırla.", bullets: ["Təklifin şərtlərini kassada və sosial mediada göstər."] },
  ],
  actionPlan: [{ phase: "Açılışdan əvvəl", actions: ["Xəritə profilini tamamla.", "Məkan və menyu haqqında ilk məzmunları hazırla."], expectedOutcome: "İlk qonaqlar üçün aydın məlumat və seçim." }, { phase: "Açılış və davamı", actions: ["Qonaq rəylərini topla.", "Təkrar ziyarət səbəblərini öyrən."], expectedOutcome: "Təcrübəyə əsaslanan növbəti addımlar." }],
  kpis: [{ name: "Təkrar ziyarət", reason: "Qonaq təcrübəsinin davamlılığını yoxlamaq.", target: "İlk ay baza göstəricisini müəyyən et." }],
  risks: [{ risk: "Təklifin ümumi görünməsi.", mitigation: "Məkanın konkret üstünlüklərini göstər." }],
  assumptions: ["Nümunə strategiyadır; real biznes məlumatları ilə dəqiqləşdirilməlidir."],
  nextSteps: ["Yerli auditoriya ilə qısa müsahibələr apar.", "Açılış planını büdcə ilə uyğunlaşdır."],
};
export const sampleRecord = {
  id: "homepage-sample", title: strategy.title, brief: "Bakıda yeni premium coffee shop üçün bazara giriş strategiyası hazırla. Büdcə: 3000 AZN.", strategy,
  versions: [{ versionNumber: 1, data: strategy, createdAt: "2026-08-27T10:00:00Z" }], versionCount: 1, updatedAt: "2026-08-27T10:00:00Z", createdAt: "2026-08-27T10:00:00Z", clarification: { answers: [] },
};
