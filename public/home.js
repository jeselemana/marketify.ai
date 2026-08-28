/* home.js — Public homepage interactions & localization (i18n, mobile menu, composers, tabs, copyright year). */
import { getLanguage, setLanguage } from "./i18n.js";

const HOMEPAGE_COPY = {
  az: {
    pageTitle: "Marketify v3.0 — Marketinq üçün iş məkanı",
    metaDesc: "Araşdır, strategiya qur və işinə qaldığın yerdən davam et. Marketify araşdırma, strategiya və qərarverməni vahid iş məkanında birləşdirir.",
    skipToMain: "Əsas hissəyə keç",
    langToggleText: "EN",
    langToggleAria: "İnterfeys dilini ingilis dilinə dəyiş",
    langToggleTitle: "Dili dəyiş (Language)",
    mobileLangText: "Dil: English (EN)",
    navProduct: "Məhsul",
    navCapabilities: "İmkanlar",
    navPricing: "Qiymətlər",
    navFaq: "FAQ",
    navLogin: "Daxil ol",
    navGetStarted: "Başla",
    heroEyebrow: "Marketinq üçün iş məkanı",
    heroTitle: "Marketinqi düşünməkdən<br />icraya keç.",
    heroCopy: "Marketify araşdırma, strategiya və qərarverməni<br class=\"desktop-break\" /> vahid iş məkanında birləşdirir.",
    heroPlaceholder: "Nə üzərində işləyirsən?",
    heroHint: "Sualdan başla. Strategiyaya çevir.",
    heroEnterHint: "Enter ilə göndər",
    heroExplore: "İş məkanı ilə tanış ol",
    modeLabels: {
      ask: "Araşdır və düşün",
      build: "Yarat və icra et",
    },
    capEyebrow: "Marketify v3.0",
    capTitle: "Araşdır. Düşün. Qur.",
    capSubtitle: "İlk sualdan növbəti addıma qədər.",
    capabilities: [
      { title: "Ask", desc: "Biznes və marketinq suallarını araşdır, müqayisə et və təhlil et." },
      { title: "Build", desc: "Məqsəd və kontekstdən tam marketinq strategiyası qur." },
      { title: "Search", desc: "Aktual məlumat və bazar konteksti ilə qərarlarını əsaslandır." },
      { title: "Context", desc: "Mövcud strategiyalar və əvvəlki işlərin üzərindən davam et." },
    ],
    prodEyebrow: "Məhsulun içində",
    prodTitle: "Bir söhbətdən daha çox.<br />İşinin davam etdiyi yer.",
    prodSubtitle: "Araşdırmanı strategiyaya, strategiyanı isə<br class=\"desktop-break\" /> növbəti addımlarına bağla.",
    tabBuild: "Build",
    tabBuildSub: "Strategiyanı qur",
    tabAsk: "Ask",
    tabAskSub: "Araşdır və düşün",
    tabContext: "Arxiv",
    tabContextSub: "Qaldığın yerdən davam et",
    previewCaption: "Build — məqsəddən strukturlaşdırılmış strategiyaya.",
    previewSubCaption: "Real məhsul interfeysi · nümunə məzmun",
    continuity: ["Araşdırma", "Strategiya", "İcra planı", "Davamlı kontekst"],
    howEyebrow: "Necə işləyir",
    howTitle: "Aydın bir iş axını.",
    steps: [
      { num: "01", title: "Soruş", desc: "Məqsədini, problemini və ya qərarını Marketify-a ver." },
      { num: "02", title: "Qur", desc: "Marketify konteksti analiz edir, lazım olduqda araşdırır və strukturlaşdırılmış nəticə yaradır." },
      { num: "03", title: "Davam et", desc: "Strategiyanı saxla, inkişaf etdir və eyni kontekst üzərindən işləməyə davam et." },
    ],
    useEyebrow: "Sənin işin üçün",
    useTitle: "Bir məqsədlə başla.",
    useSubtitle: "Nümunəni seç, öz kontekstini əlavə et.",
    useCases: [
      { label: "Marketinq strategiyası", prompt: "Bakıda yeni premium coffee shop üçün bazara giriş strategiyası hazırla." },
      { label: "Rəqib analizi", prompt: "Azərbaycanda onlayn təhsil bazarının əsas oyunçularını və fərqlənmə imkanlarını araşdır." },
      { label: "Kampaniya planlaşdırılması", prompt: "Yerli geyim brendinin payız kolleksiyası üçün 4 həftəlik kampaniya planı qur." },
      { label: "Biznes qərarları", prompt: "Kiçik B2B şirkəti üçün birbaşa satış və tərəfdaşlıq kanallarını müqayisə et." },
    ],
    philEyebrow: "Niyə Marketify",
    philTitle: "Cavab almaq başlanğıcdır.<br />Əsas məsələ onunla nə etdiyindir.",
    philCopy: "Düşünmək, aktual məlumatı araşdırmaq, strategiya qurmaq və icraya keçmək eyni işin hissələridir. Marketify bunları bir araya gətirir — hər dəfə sıfırdan başlamamaq üçün.",
    priceEyebrow: "Qiymətlər və istifadə",
    priceTitle: "Əvvəlcə iş məkanınla tanış ol.",
    priceCopy: "Hesab yaratmaq pulsuzdur. İstifadə məlumatları və limitlər iş məkanında göstərilir.",
    priceLink: "İstifadə məlumatları",
    faqEyebrow: "Bilmək istədiklərin",
    faqTitle: "Tez-tez verilən suallar.",
    faqs: [
      {
        q: "Marketify nədir?",
        a: "Marketify araşdırma, marketinq strategiyası və biznes qərarları üçün iş məkanıdır. Sualını araşdırmağa, strukturlaşdırılmış plan qurmağa və əvvəlki işlərin üzərindən davam etməyə kömək edir.",
      },
      {
        q: "Ask və Build arasında fərq nədir?",
        a: "Ask sualları araşdırmaq, ideyaları müqayisə etmək və qərarları təhlil etmək üçündür. Build məqsədini və biznes kontekstini strateji istiqamətlər, icra planı və ölçmə meyarları olan strategiyaya çevirir.",
      },
      {
        q: "Marketify internetdə aktual məlumatları araşdıra bilir?",
        a: "Bəli. Sual aktual məlumat tələb etdikdə Marketify internetdə axtarış edə və nəticəni mənbələrlə əsaslandıra bilər. Vacib qərarlardan əvvəl mənbələri və məlumatların tarixini yoxla.",
      },
      {
        q: "Hazırladığım strategiyalar saxlanılır?",
        a: "Strategiyanı iş məkanında yadda saxladıqdan sonra Arxiv bölməsindən yenidən aça bilərsən. Hesabına daxil olaraq əvvəlki işlərini inkişaf etdirə və onları yeni suallar üçün kontekst kimi istifadə edə bilərsən.",
      },
      {
        q: "Marketify adi AI çatından nə ilə fərqlənir?",
        a: "Marketify-də iş axını marketinq qərarları ətrafında qurulub: araşdırma, strukturlaşdırılmış strategiya, icra planı və saxlanılan kontekst bir-birinə bağlıdır.",
      },
      {
        q: "Marketify-dan necə istifadə etməyə başlaya bilərəm?",
        a: "Bu səhifədə sualını və ya məqsədini yaz, Ask və ya Build rejimini seç və göndər. Hesabına daxil olduqdan sonra yazdığın mətn iş məkanına ötürülür və sorğun davam edir.",
      },
    ],
    finalEyebrow: "Növbəti addım səndən",
    finalTitle: "Nə üzərində işləyirsən?",
    finalPlaceholder: "Nə üzərində işləyirsən?",
    footerAbout: "Haqqımızda",
    footerPrivacy: "Məxfilik",
    footerTerms: "İstifadə şərtləri",
    noscript: "Sorğu göndərmək üçün JavaScript-i aktiv et. ",
    noscriptLogin: "Hesabına daxil ol →",
  },
  en: {
    pageTitle: "Marketify v3.0 — Workspace for Marketing Strategy",
    metaDesc: "Research, build strategies, and pick up where you left off. Marketify unifies market research, strategic planning, and commercial decision-making in one workspace.",
    skipToMain: "Skip to main content",
    langToggleText: "AZ",
    langToggleAria: "Switch interface language to Azerbaijani",
    langToggleTitle: "Change language (Dil)",
    mobileLangText: "Language: Azərbaycan dili (AZ)",
    navProduct: "Product",
    navCapabilities: "Capabilities",
    navPricing: "Pricing",
    navFaq: "FAQ",
    navLogin: "Sign In",
    navGetStarted: "Get Started",
    heroEyebrow: "Workspace for Marketing",
    heroTitle: "Turn strategic thinking<br />into real execution.",
    heroCopy: "Marketify unifies market research, strategic planning, and decision-making<br class=\"desktop-break\" /> in a single workspace.",
    heroPlaceholder: "What are you working on?",
    heroHint: "Start with a question. Turn it into strategy.",
    heroEnterHint: "Press Enter to send",
    heroExplore: "Explore the workspace",
    modeLabels: {
      ask: "Research & explore",
      build: "Build & execute",
    },
    capEyebrow: "Marketify v3.0",
    capTitle: "Research. Strategize. Build.",
    capSubtitle: "From the initial brief to the next execution step.",
    capabilities: [
      { title: "Ask", desc: "Explore, compare, and analyze marketing and business questions." },
      { title: "Build", desc: "Build a complete, structured marketing roadmap from your business context." },
      { title: "Search", desc: "Back your decisions with live web data and verified market sources." },
      { title: "Context", desc: "Seamlessly build upon existing strategies and historical workspace context." },
    ],
    prodEyebrow: "Inside the Product",
    prodTitle: "More than a chat.<br />Where your work moves forward.",
    prodSubtitle: "Connect market research to strategy, and strategy<br class=\"desktop-break\" /> to concrete execution steps.",
    tabBuild: "Build",
    tabBuildSub: "Build strategy",
    tabAsk: "Ask",
    tabAskSub: "Research & explore",
    tabContext: "Archive",
    tabContextSub: "Pick up where you left off",
    previewCaption: "Build — from business objective to structured strategy.",
    previewSubCaption: "Real product interface · sample content",
    continuity: ["Research", "Strategy", "Execution Roadmap", "Persistent Context"],
    howEyebrow: "How It Works",
    howTitle: "A clear, structured workflow.",
    steps: [
      { num: "01", title: "Ask", desc: "Submit your business objective, challenge, or decision to Marketify." },
      { num: "02", title: "Build", desc: "Marketify analyzes context, conducts research if needed, and builds a structured plan." },
      { num: "03", title: "Execute", desc: "Save, refine, and iterate on your strategy with persistent context." },
    ],
    useEyebrow: "Tailored for Your Work",
    useTitle: "Start with a clear goal.",
    useSubtitle: "Select a sample prompt or enter your own business context.",
    useCases: [
      { label: "Marketing Strategy", prompt: "Develop a go-to-market strategy for a new premium coffee shop in Baku." },
      { label: "Competitor Analysis", prompt: "Analyze key players and differentiation opportunities in the online education market." },
      { label: "Campaign Planning", prompt: "Build a 4-week marketing campaign plan for an apparel brand's autumn collection." },
      { label: "Commercial Decisions", prompt: "Compare direct sales versus partnership channels for a B2B service company." },
    ],
    philEyebrow: "Why Marketify",
    philTitle: "Getting an answer is just the start.<br />What matters is what you do with it.",
    philCopy: "Exploring ideas, researching live market data, crafting strategies, and executing are parts of the same workflow. Marketify brings them together so you never have to start from scratch.",
    priceEyebrow: "Pricing & Usage",
    priceTitle: "Explore your workspace first.",
    priceCopy: "Creating an account is free. Usage details and limits are transparently displayed inside your workspace.",
    priceLink: "Usage details",
    faqEyebrow: "Everything You Need to Know",
    faqTitle: "Frequently Asked Questions",
    faqs: [
      {
        q: "What is Marketify?",
        a: "Marketify is a unified workspace for research, marketing strategy, and commercial decisions. It helps you explore questions, build structured plans, and build continuously on past work.",
      },
      {
        q: "What is the difference between Ask and Build?",
        a: "Ask is designed for exploring questions, comparing ideas, and analyzing decisions. Build transforms your objective and context into a complete strategy with strategic directions, an execution roadmap, and measurable KPIs.",
      },
      {
        q: "Can Marketify research live web information?",
        a: "Yes. When a query requires current information, Marketify can perform live web searches and cite sources. Always verify sources and dates before critical decisions.",
      },
      {
        q: "Are my generated strategies saved?",
        a: "Yes. Once saved in your workspace, strategies can be reopened from the Archive. Logging into your account allows you to iterate on past work and use it as context for new inquiries.",
      },
      {
        q: "How is Marketify different from a standard AI chat?",
        a: "Marketify's workflow is purpose-built around commercial marketing decisions: research, structured strategy, execution roadmaps, and persistent context are tightly connected.",
      },
      {
        q: "How do I get started with Marketify?",
        a: "Type your question or business goal on this page, choose Ask or Build mode, and submit. Your prompt seamlessly transfers to your workspace upon sign-in.",
      },
    ],
    finalEyebrow: "Your next step",
    finalTitle: "What are you working on?",
    finalPlaceholder: "What are you working on?",
    footerAbout: "About",
    footerPrivacy: "Privacy",
    footerTerms: "Terms of Service",
    noscript: "Enable JavaScript to submit requests. ",
    noscriptLogin: "Sign in to your account →",
  },
};

function applyHomepageLanguage(lang) {
  const currentLang = lang === "en" ? "en" : "az";
  const copy = HOMEPAGE_COPY[currentLang];
  document.documentElement.lang = currentLang;

  // Title & Meta
  document.title = copy.pageTitle;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.content = copy.metaDesc;

  // Skip link
  const skipLink = document.querySelector(".skip-link");
  if (skipLink) skipLink.textContent = copy.skipToMain;

  // Header Lang toggles
  const langToggle = document.getElementById("homeLangToggle");
  if (langToggle) {
    langToggle.textContent = copy.langToggleText;
    langToggle.setAttribute("aria-label", copy.langToggleAria);
    langToggle.setAttribute("title", copy.langToggleTitle);
  }
  const mobileLangToggle = document.getElementById("mobileHomeLangToggle");
  if (mobileLangToggle) {
    mobileLangToggle.textContent = copy.mobileLangText;
  }

  // Header desktop nav
  const desktopNavLinks = document.querySelectorAll(".desktop-nav a");
  if (desktopNavLinks.length >= 4) {
    desktopNavLinks[0].textContent = copy.navProduct;
    desktopNavLinks[1].textContent = copy.navCapabilities;
    desktopNavLinks[2].textContent = copy.navPricing;
    desktopNavLinks[3].textContent = copy.navFaq;
  }

  // Mobile nav
  const mobileNavLinks = document.querySelectorAll(".mobile-nav a");
  if (mobileNavLinks.length >= 5) {
    mobileNavLinks[0].textContent = copy.navProduct;
    mobileNavLinks[1].textContent = copy.navCapabilities;
    mobileNavLinks[2].textContent = copy.navPricing;
    mobileNavLinks[3].textContent = copy.navFaq;
    mobileNavLinks[4].textContent = copy.navLogin;
  }

  // Header actions
  const loginLink = document.querySelector(".header-actions .login-link");
  if (loginLink) loginLink.textContent = copy.navLogin;
  const startBtn = document.querySelector(".header-actions .button-dark");
  if (startBtn) startBtn.innerHTML = `${copy.navGetStarted} <span aria-hidden="true">↗</span>`;

  // Hero section
  const heroEyebrow = document.querySelector(".hero .eyebrow");
  if (heroEyebrow) heroEyebrow.textContent = copy.heroEyebrow;
  const heroTitle = document.getElementById("heroTitle");
  if (heroTitle) heroTitle.innerHTML = copy.heroTitle;
  const heroCopy = document.querySelector(".hero .hero-copy");
  if (heroCopy) heroCopy.innerHTML = copy.heroCopy;

  const heroPrompt = document.getElementById("heroPrompt");
  if (heroPrompt) heroPrompt.placeholder = copy.heroPlaceholder;
  const heroHint = document.getElementById("heroHint");
  if (heroHint) {
    heroHint.innerHTML = `<span>${copy.heroHint}</span><span class="keyboard-hint">${copy.heroEnterHint} <span aria-hidden="true">↵</span></span>`;
  }
  const heroExplore = document.querySelector(".hero-explore");
  if (heroExplore) heroExplore.innerHTML = `${copy.heroExplore} <span aria-hidden="true">↓</span>`;

  // Update mode descriptions
  document.querySelectorAll(".home-composer").forEach((form) => {
    const mode = form.querySelector('input[name="mode"]:checked')?.value || "ask";
    const modeDesc = form.closest(".composer-wrap")?.querySelector(".mode-description");
    if (modeDesc) modeDesc.textContent = copy.modeLabels[mode] || "";
  });

  // Capabilities section
  const capEyebrow = document.querySelector(".capabilities .eyebrow");
  if (capEyebrow) capEyebrow.textContent = copy.capEyebrow;
  const capTitle = document.getElementById("capabilitiesTitle");
  if (capTitle) capTitle.textContent = copy.capTitle;
  const capSub = document.querySelector(".capabilities .section-heading p:last-child");
  if (capSub) capSub.textContent = copy.capSubtitle;

  const capGridDivs = document.querySelectorAll(".capability-grid > div");
  copy.capabilities.forEach((cap, idx) => {
    if (capGridDivs[idx]) {
      const h3 = capGridDivs[idx].querySelector("h3");
      const p = capGridDivs[idx].querySelector("p");
      if (h3) h3.textContent = cap.title;
      if (p) p.textContent = cap.desc;
    }
  });

  // Product section
  const prodEyebrow = document.querySelector(".product-section .eyebrow");
  if (prodEyebrow) prodEyebrow.textContent = copy.prodEyebrow;
  const prodTitle = document.getElementById("productTitle");
  if (prodTitle) prodTitle.innerHTML = copy.prodTitle;
  const prodSub = document.querySelector(".product-section .section-heading > p");
  if (prodSub) prodSub.innerHTML = copy.prodSubtitle;

  const tabBuild = document.getElementById("preview-build");
  if (tabBuild) tabBuild.innerHTML = `${copy.tabBuild} <span>${copy.tabBuildSub}</span>`;
  const tabAsk = document.getElementById("preview-ask");
  if (tabAsk) tabAsk.innerHTML = `${copy.tabAsk} <span>${copy.tabAskSub}</span>`;
  const tabContext = document.getElementById("preview-context");
  if (tabContext) tabContext.innerHTML = `${copy.tabContext} <span>${copy.tabContextSub}</span>`;

  const previewCaption = document.getElementById("previewCaption");
  if (previewCaption) previewCaption.textContent = copy.previewCaption;
  const previewSubCaption = document.querySelector(".product-preview figcaption span:last-child");
  if (previewSubCaption) previewSubCaption.textContent = copy.previewSubCaption;

  const continuitySpans = document.querySelectorAll(".product-continuity > span:not([aria-hidden])");
  copy.continuity.forEach((text, idx) => {
    if (continuitySpans[idx]) continuitySpans[idx].textContent = text;
  });

  // How it works
  const howEyebrow = document.querySelector(".how-section .eyebrow");
  if (howEyebrow) howEyebrow.textContent = copy.howEyebrow;
  const howTitle = document.getElementById("howTitle");
  if (howTitle) howTitle.textContent = copy.howTitle;

  const stepItems = document.querySelectorAll(".how-section .steps li");
  copy.steps.forEach((step, idx) => {
    if (stepItems[idx]) {
      const h3 = stepItems[idx].querySelector("h3");
      const p = stepItems[idx].querySelector("p");
      if (h3) h3.textContent = step.title;
      if (p) p.textContent = step.desc;
    }
  });

  // Use cases
  const useEyebrow = document.querySelector(".use-section .eyebrow");
  if (useEyebrow) useEyebrow.textContent = copy.useEyebrow;
  const useTitle = document.getElementById("useTitle");
  if (useTitle) useTitle.textContent = copy.useTitle;
  const useSub = document.querySelector(".use-section .section-heading p:last-child");
  if (useSub) useSub.textContent = copy.useSubtitle;

  const useButtons = document.querySelectorAll(".use-cases .use-case");
  copy.useCases.forEach((uc, idx) => {
    if (useButtons[idx]) {
      const label = useButtons[idx].querySelector(".use-label");
      const prompt = useButtons[idx].querySelector(".example-prompt");
      if (label) label.textContent = uc.label;
      if (prompt) prompt.textContent = uc.prompt;
    }
  });

  // Philosophy / About
  const philEyebrow = document.querySelector(".philosophy .eyebrow");
  if (philEyebrow) philEyebrow.textContent = copy.philEyebrow;
  const philTitle = document.getElementById("philosophyTitle");
  if (philTitle) philTitle.innerHTML = copy.philTitle;
  const philCopy = document.querySelector(".philosophy div > p");
  if (philCopy) philCopy.textContent = copy.philCopy;

  // Pricing
  const priceEyebrow = document.querySelector(".pricing-section .eyebrow");
  if (priceEyebrow) priceEyebrow.textContent = copy.priceEyebrow;
  const priceTitle = document.getElementById("pricingTitle");
  if (priceTitle) priceTitle.textContent = copy.priceTitle;
  const priceCopy = document.querySelector(".pricing-section div > p");
  if (priceCopy) priceCopy.textContent = copy.priceCopy;
  const priceLink = document.querySelector(".pricing-section .text-link");
  if (priceLink) priceLink.innerHTML = `${copy.priceLink} <span aria-hidden="true">↗</span>`;

  // FAQ
  const faqEyebrow = document.querySelector(".faq-section .eyebrow");
  if (faqEyebrow) faqEyebrow.textContent = copy.faqEyebrow;
  const faqTitle = document.getElementById("faqTitle");
  if (faqTitle) faqTitle.textContent = copy.faqTitle;

  const faqDetails = document.querySelectorAll(".faq-list details");
  copy.faqs.forEach((faq, idx) => {
    if (faqDetails[idx]) {
      const summary = faqDetails[idx].querySelector("summary");
      const p = faqDetails[idx].querySelector("p");
      if (summary) summary.innerHTML = `${faq.q}<span aria-hidden="true">+</span>`;
      if (p) p.textContent = faq.a;
    }
  });

  // Final section
  const finalEyebrow = document.querySelector(".final-section .eyebrow");
  if (finalEyebrow) finalEyebrow.textContent = copy.finalEyebrow;
  const finalTitle = document.getElementById("finalTitle");
  if (finalTitle) finalTitle.textContent = copy.finalTitle;
  const finalPrompt = document.getElementById("finalPrompt");
  if (finalPrompt) finalPrompt.placeholder = copy.finalPlaceholder;
  const finalHint = document.getElementById("finalHint");
  if (finalHint) {
    finalHint.innerHTML = `<span>${copy.heroHint}</span><span class="keyboard-hint">${copy.heroEnterHint} <span aria-hidden="true">↵</span></span>`;
  }

  // Footer
  const footerLinks = document.querySelectorAll(".footer-top nav a");
  if (footerLinks.length >= 4) {
    footerLinks[2].textContent = copy.navPricing;
    footerLinks[3].textContent = copy.footerAbout;
  }
  const footerLegalLinks = document.querySelectorAll(".footer-bottom nav a");
  if (footerLegalLinks.length >= 2) {
    footerLegalLinks[0].textContent = copy.footerPrivacy;
    footerLegalLinks[1].textContent = copy.footerTerms;
  }

  // NoScript note
  const noScript = document.querySelector("noscript div");
  if (noScript) {
    noScript.innerHTML = `${copy.noscript}<a href="/login?returnTo=/workspace">${copy.noscriptLogin}</a>`;
  }
}

// Initialize on page load
applyHomepageLanguage(getLanguage());

/* ── Mobile menu toggle ───────────────────────────────────────────── */
const menuToggle = document.querySelector(".menu-toggle");
const mobileNav = document.getElementById("mobileNav");

if (menuToggle && mobileNav) {
  menuToggle.hidden = false;

  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isOpen));
    mobileNav.hidden = isOpen;

    menuToggle.innerHTML = isOpen
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  });

  mobileNav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      menuToggle.setAttribute("aria-expanded", "false");
      mobileNav.hidden = true;
      menuToggle.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>';
    }
  });
}

/* ── Composer logic (hero + final section) ────────────────────────── */
document.querySelectorAll(".home-composer").forEach((form) => {
  const textarea = form.querySelector("textarea");
  const submit = form.querySelector(".composer-submit");
  const modeInputs = form.querySelectorAll('input[name="mode"]');
  const modeDesc = form.closest(".composer-wrap")?.querySelector(".mode-description");

  // Enable/disable submit
  if (textarea && submit) {
    textarea.addEventListener("input", () => {
      submit.disabled = !textarea.value.trim();
    });
  }

  // Mode label switch
  modeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const lang = getLanguage();
      const labels = HOMEPAGE_COPY[lang]?.modeLabels || HOMEPAGE_COPY.az.modeLabels;
      if (modeDesc) modeDesc.textContent = labels[input.value] || "";
    });
  });

  // Submit → redirect to workspace
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const prompt = textarea?.value.trim();
    if (!prompt) return;
    const mode = form.querySelector('input[name="mode"]:checked')?.value || "ask";
    const params = new URLSearchParams({ mode, prompt });
    window.location.href = `/workspace?${params}`;
  });

  // Enter to submit (shift+enter for new line)
  if (textarea) {
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (textarea.value.trim()) form.requestSubmit();
      }
    });
  }
});

// Click use case cards to prefill composer and scroll
document.querySelectorAll(".use-case").forEach((button) => {
  button.addEventListener("click", () => {
    const promptText = button.querySelector(".example-prompt")?.textContent?.trim();
    const mode = button.dataset.mode || "build";
    const heroForm = document.querySelector(".hero .home-composer");
    if (!heroForm || !promptText) return;

    const textarea = heroForm.querySelector("textarea");
    const modeRadio = heroForm.querySelector(`input[name="mode"][value="${mode}"]`);
    const submit = heroForm.querySelector(".composer-submit");
    const modeDesc = heroForm.closest(".composer-wrap")?.querySelector(".mode-description");

    if (modeRadio) {
      modeRadio.checked = true;
      const lang = getLanguage();
      const labels = HOMEPAGE_COPY[lang]?.modeLabels || HOMEPAGE_COPY.az.modeLabels;
      if (modeDesc) modeDesc.textContent = labels[mode] || "";
    }
    if (textarea) {
      textarea.value = promptText;
      if (submit) submit.disabled = false;
      textarea.focus();
      textarea.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
});

/* ── Product preview tabs ─────────────────────────────────────────── */
const previewTabs = document.querySelectorAll(".preview-tabs button");
const previewPanels = document.querySelectorAll(".product-preview");

if (previewTabs.length && previewPanels.length) {
  previewTabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      previewTabs.forEach((t) => t.setAttribute("aria-selected", "false"));
      tab.setAttribute("aria-selected", "true");
      previewPanels.forEach((p, j) => (p.hidden = j !== i));
    });
  });
}

/* ── Copyright year ───────────────────────────────────────────────── */
const yearEl = document.getElementById("copyrightYear");
if (yearEl) yearEl.textContent = new Date().getFullYear();
