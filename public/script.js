/* ==========================================================================
   1. GLOBAL VARIABLES & DOM ELEMENTS
   ========================================================================== */
const modelBtn = document.getElementById("model-btn");
const dropdownMenu = document.getElementById("dropdownMenu");
const arrow = document.querySelector(".arrow-down");
const clearBtn = document.getElementById("clearChat");
const chatBox = document.getElementById("chat-box");
const bubbles = document.querySelectorAll(".bubble"); // Static bubbles if any
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const center = document.getElementById("center-view");
const sendBtn = document.getElementById("send-btn");

// UI Elements for Hiding/Showing
const brandTitle = document.querySelector(".brand-sub");
const tagline = document.querySelector(".tagline");
const promptContainer = document.querySelector(".prompt-bubbles");
const newTitle = document.querySelector(".new-dynamic-title");
const newDisclaimer = document.querySelector(".new-chat-disclaimer");

// State
let selectedModel = "gpt-4o";
let userStartedTyping = false; // For desktop placeholder logic

/* ==========================================================================
   2. DATA ARRAYS
   ========================================================================== */
const promptSuggestions = [
  // Marketinq & Biznes
  { title: "Growth Hacking", sub: "strategiyasını düzgün tətbiq etmə yolları" },
  { title: "Black Friday-də", sub: "sərfəli təkliflərlə yanaşı mənfəət artırmaq" },
  { title: "Alış-veriş həvəskarları üçün", sub: "cəlbedici təkliflər" },
  { title: "Minimum büdcə", sub: "ilə maksimum gəlir əldə etmə üsulları" },
  { title: "Yeni il kampaniyası", sub: "üçün kreativ strategiya" },
  { title: "Satışları artırmaq", sub: "üçün 5 psixoloji üsul" },
  { title: "Brend hekayəsi", sub: "yazmaqda kömək et" },
  { title: "Email marketinq", sub: "üçün başlıq ideyaları" },
  { title: "Müştəri rəyləri", sub: "üçün cavab şablonu" },
  { title: "Landing page", sub: "üçün dönüşüm artıran variant" },
  { title: "Reklam büdcəsi", sub: "üçün aylıq plan hazırlamağa kömək et" },
  { title: "SMM strategiyası", sub: "3 aylıq mini plan ver" },
  { title: "Biznes audit", sub: "qısa təhlil et" },
  // Sosial Media
  { title: "Instagram Reels", sub: "üçün viral ssenari" },
  { title: "TikTok trendləri", sub: "biznesimə necə uyğunlaşdırım?" },
  { title: "LinkedIn postu", sub: "peşəkar üslubda yaz" },
  { title: "YouTube videosu", sub: "üçün SEO təsviri" },
  { title: "Caption ideyası", sub: "qısa və kreativ olsun" },
  { title: "Trend audiosu", sub: "bu sahəyə uyğun tap" },
  // Yaradıcılıq & Branding
  { title: "Reklam sloqanı", sub: "qısa və yaddaqalan olsun" },
  { title: "Logo dizaynı", sub: "üçün prompt hazırla" },
  { title: "Məhsul adı", sub: "tapmaqda kömək et" },
  { title: "Startap ideyası", sub: "üçün SWOT analizi" },
  { title: "Brand voice", sub: "təklif et" },
  // Yerli (Azərbaycan) mövzular
  { title: "Yerli auditoriyanı", sub: "cəlb edəcək reklam kampaniyası" },
  { title: "Azərbaycanda SMM", sub: "üçün düzgün ton" },
  { title: "Endirim aksiyası", sub: "Azərbaycan bazarına uyğun yaz" },
  // AI & Texnoloji
  { title: "AI ilə kontent", sub: "yaratma planı hazırla" },
  { title: "Prompt optimallaşdırma", sub: "üçün ipucları ver" },
  // Texniki & Digər
  { title: "SEO açar sözlər", sub: "bu mövzu üçün tap" },
  { title: "Blog yazısı", sub: "giriş hissəsi yaz" },
  { title: "Müsahibə sualları", sub: "SMM meneceri üçün" },
  { title: "Press-reliz", sub: "üçün professional mətn yaz" },
  { title: "Böhran vəziyyətində", sub: "bilməli olduqlarım" }
];

const rotatingTaglines = [
  "Bu gün nə haqqında danışırıq? 😊",
  "Marketinq ideyaları ilə dolu bir günə hazırsan? 🚀",
  "Sən yaz, AI düşünsün 💡",
  "Yaradıcı gücünü AI ilə birləşdir ✨",
  "Reklam dünyasında inqilab buradan başlayır 🌍",
  "Bir az sən, bir az AI...",
  "Brendini Marketify AI ilə gücləndir ⚡️",
  "Marketinq gələcəyini bu gündən yarat 🌟",
  "Mətnlər gəlsin, ideyalar axsın ✍️",
  "Az olsun, saz olsun – Marketify AI ilə mükəmməl olsun 👌",
  "Sovetin dövründə belə şey yox idi – amma indi var 😉",
  "Atalar üçdən deyib – sualını yaz, göndər və cavab al ✌️"
];

const desktopPrompts = [
  "Growth hacking strategiyası qur",
  "Instagram üçün viral post ideyası ver",
  "Reklam büdcəmi necə bölməliyəm?",
  "Black Friday kampaniyası hazırla",
  "Brend üçün slogan tap",
  "Email marketinq başlığı yaz",
  "Satışları artırmaq üçün 5 üsul",
  "Startap ideyamı analiz et"
];

/* ==========================================================================
   3. HELPER FUNCTIONS (Utils)
   ========================================================================== */
function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isDesktop() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    const lastMessage = chatBox?.querySelector(".message:last-of-type") || chatBox?.lastElementChild;
    if (lastMessage) {
      lastMessage.scrollIntoView({ block: "end", behavior: "smooth" });
    } else {
      chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
    }
  });
}

// Modal Functions
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("show");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("show");
}

/* ==========================================================================
   4. UI LOGIC (Bubbles, Views, States)
   ========================================================================== */

// --- Dynamic Bubbles ---
function loadDynamicBubbles() {
  const container = document.querySelector(".prompt-bubbles");
  if (!container) return;

  container.innerHTML = "";
  // Qarışdır və ilk 4-nü götür
  const selected = promptSuggestions.sort(() => Math.random() - 0.5).slice(0, 4);

  selected.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "bubble";
    btn.innerHTML = `
      <div class="bubble-content">
        <span class="bubble-title">${item.title}</span>
        <span class="bubble-sub">${item.sub}</span>
      </div>
    `;

    btn.addEventListener("click", () => {
      if(input) {
        input.value = `${item.title} ${item.sub}`;
        input.focus();
        // Trigger visual updates
        updateUIStateForInput();
        input.dispatchEvent(new Event("input"));
      }
    });
    container.appendChild(btn);
  });
}

// ✅ Statik və ya Dinamik Kartı İdarə Edən Funksiya
function initStarterHint() {
  if (!isDesktop()) return; // Yalnız desktop

  let hint = document.getElementById("starter-hint");

  // Əgər HTML-də yoxdursa, JS ilə yaradırıq (Ehtiyat variant)
  if (!hint) {
    hint = document.createElement("div");
    hint.id = "starter-hint";
    hint.className = "starter-hint";
    hint.innerHTML = `
      <div class="hint-icon">🚀</div>
      <div class="hint-text">
        <strong>Necə başlayım?</strong>
        <span>Bir mövzu seçin və ya sadəcə "Salam" yazın</span>
      </div>
    `;
    document.body.appendChild(hint);
  }

  // Klik hadisəsi
  hint.onclick = () => {
    if(input) {
        input.value = "Salam, nə haqqında danışa bilərik?";
        input.focus();
        updateUIStateForInput();
    }
  };
}

// --- View State Management (Centralized) ---

// 1. Ekranı tamamilə "Yazışma rejiminə" keçirir
function setChatActiveMode() {
  if (center) center.style.display = "none";
  if (brandTitle) {
      brandTitle.style.display = "none";
      brandTitle.style.opacity = "0";
  }
  if (tagline) tagline.style.display = "none";
  if (promptContainer) promptContainer.style.display = "none";
  
  if (newTitle) newTitle.classList.remove("show");
  if (newDisclaimer) newDisclaimer.classList.remove("show");
  
  if (clearBtn) clearBtn.classList.add("show");

  // ✅ Desktop Footer Mode
  if (form && isDesktop()) { 
     form.classList.add("footer-mode");
  }

  // ✅ HIDE STARTER HINT
  const hint = document.getElementById("starter-hint");
  if(hint) hint.classList.add("hide-hint");
}

// 2. Inputa yazarkən baş verən dəyişikliklər
function updateUIStateForInput() {
  const hasText = input.value.trim().length > 0;
  
  // Send button state
  if (hasText) {
    sendBtn.classList.remove("disabled");
    sendBtn.disabled = false;
  } else {
    sendBtn.classList.add("disabled");
    sendBtn.disabled = true;
  }

  // Bubbles & Center Elements Logic
  const hint = document.getElementById("starter-hint");

  if (hasText) {
    if (promptContainer) promptContainer.classList.add("hidden-bubbles");
    
    // Show "New Chat" title, hide Main Brand
    if (newTitle) newTitle.classList.add("show");
    if (newDisclaimer) newDisclaimer.classList.add("show");
    if (brandTitle) brandTitle.style.opacity = "0";
    if (tagline) tagline.style.opacity = "0";

    // Hide Hint when typing
    if(hint) hint.classList.add("hide-hint");
    
  } else {
    // Input boşdur
    if (promptContainer) promptContainer.classList.remove("hidden-bubbles");

    // Yalnız çat boşdursa "Brand" geri qayıdır
    if (chatBox.children.length === 0) {
       if (newTitle) newTitle.classList.remove("show");
       if (newDisclaimer) newDisclaimer.classList.remove("show");
       if (brandTitle) brandTitle.style.opacity = "1";
       if (tagline) tagline.style.opacity = "1";

       // Show Hint again if chat is empty
       if(hint) hint.classList.remove("hide-hint");
    } else {
        // Çatda mesaj varsa (Chat Active)
        if (newTitle) newTitle.classList.remove("show");
        if (newDisclaimer) newDisclaimer.classList.remove("show");
        
        // ✅ CRITICAL FIX: Çat aktivdirsə amma input boşdursa, kart gizli qalsın!
        if(hint) hint.classList.add("hide-hint");
    }
  }
}

// 3. Reset to Initial State (Clear Chat)
function resetToHomeState() {
  if (chatBox) chatBox.innerHTML = "";
  if (center) center.style.display = "flex";
  
  if (brandTitle) {
      brandTitle.style.display = "block";
      brandTitle.style.opacity = "1";
      brandTitle.style.transform = "scale(1)";
  }
  if (tagline) {
      tagline.style.display = "block";
      tagline.style.opacity = "1";
  }
  
  if (promptContainer) {
      promptContainer.style.display = "flex";
      promptContainer.classList.remove("hidden-bubbles");
      loadDynamicBubbles();
  }
  
  if (clearBtn) clearBtn.classList.remove("show");
  if (newTitle) newTitle.classList.remove("show");
  if (newDisclaimer) newDisclaimer.classList.remove("show");

  // ✅ Remove Footer Mode
  if (form) {
    form.classList.remove("footer-mode");
  }

  // ✅ SHOW STARTER HINT
  const hint = document.getElementById("starter-hint");
  if(hint) hint.classList.remove("hide-hint");
  
  // Reset Input
  if (input) {
      input.value = "";
      input.style.height = "44px";
      input.classList.remove("scrolling");
      updateUIStateForInput();
      
      // Desktop: Reset placeholder logic
      if (isDesktop()) {
          input.placeholder = "Sualını yaz..."; 
          userStartedTyping = false;
          // ✅ SIFIRLANANDA ROTASİYA BAŞLAYIR
          setTimeout(startPromptRotation, 2000); 
      }
  }

  // Notification
  // const notice = document.createElement("div");
  // notice.textContent = "Yeni stilimiz hazırdı 🔥";
  // Object.assign(notice.style, {
   // position: "fixed", bottom: "100px", left: "50%",
   // transform: "translateX(-50%)", background: "linear-gradient(135deg,#2d6bff,#60a5ff)",
    //color: "#fff", padding: "12px 20px", borderRadius: "12px",
    //fontFamily: "'Poppins',sans-serif", zIndex: "999", opacity: "0", transition: "opacity 0.4s ease",
  
  document.body.appendChild(notice);
  setTimeout(() => (notice.style.opacity = "1"), 80);
  setTimeout(() => {
    notice.style.opacity = "0";
    setTimeout(() => notice.remove(), 600);
  }, 2200);
}

// --- Tagline Rotator (Yalnız səhifə yeniləndikdə) ---
function initTaglineRotator() {
  if (!tagline) return;
  
  // Massivdən təsadüfi birini seçirik
  const randomIndex = Math.floor(Math.random() * rotatingTaglines.length);
  
  // Mətni təyin edirik
  tagline.textContent = rotatingTaglines[randomIndex];
}

// --- Desktop Prompt Placeholder Rotator ---
let promptIndex = 0;
let promptInterval = null;

function startPromptRotation() {
  if (!input || !isDesktop()) return;
  stopPromptRotation();
  
  // Start with the current index
  input.placeholder = desktopPrompts[promptIndex];

  promptInterval = setInterval(() => {
    if (userStartedTyping || input.value.trim() !== "") return;
    
    promptIndex = (promptIndex + 1) % desktopPrompts.length;
    input.classList.add("fade-placeholder");
    setTimeout(() => {
      input.placeholder = desktopPrompts[promptIndex];
      input.classList.remove("fade-placeholder");
    }, 250);
  }, 3500);
}

function stopPromptRotation() {
  if (promptInterval) {
    clearInterval(promptInterval);
    promptInterval = null;
  }
}

/* ==========================================================================
   5. CHAT LOGIC
   ========================================================================== */

function addMessage(role, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", role);
  msg.innerHTML = text;
  chatBox.appendChild(msg);
  scrollToBottom();
  return msg;
}

function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot", "typing-message");
  typing.innerHTML = `
    <span class="typing-text">Mesajını nəzərdən keçirirəm</span>
    <div class="typing-indicator"><span></span><span></span><span></span></div>
  `;
  chatBox.appendChild(typing);
  scrollToBottom();
  return typing;
}

function typeText(el, text, speed = 18) {
  el.innerHTML = ""; 
  let i = 0;
  const interval = setInterval(() => {
    if (i >= text.length) {
      clearInterval(interval);
      const next = el.nextSibling;
      if (next && next.classList.contains("msg-floating-left")) {
        next.style.display = "flex";
      }
      return;
    }
    const char = text.charAt(i);
    if (char === '<') {
      const tagEnd = text.indexOf('>', i);
      if (tagEnd !== -1) {
        el.innerHTML += text.substring(i, tagEnd + 1);
        i = tagEnd + 1;
      } else {
        el.innerHTML += char;
        i++;
      }
    } else {
      el.innerHTML += char;
      i++;
    }
    scrollToBottom();
  }, speed);
}

// 🚀 UNIFIED SEND MESSAGE FUNCTION
async function sendMessage(message) {
  if (!message.trim()) return;
  
  // 1. UI Updates: Switch to Chat Mode
  setChatActiveMode();
  
  // Disable button while sending
  sendBtn.classList.add("disabled");
  sendBtn.disabled = true;

  // 2. Add User Message
  addMessage("user", message);
  const typing = showTyping();

  // 3. Memory Logic
  const savedMemory = localStorage.getItem('marketify_memory');
  let finalMessageToSend = message;
  if (savedMemory && savedMemory.trim() !== "") {
    finalMessageToSend = `[Sistem Təlimatı / İstifadəçi Konteksti: ${savedMemory}]\n\nİstifadəçinin Mesajı: ${message}`;
  }

  // 4. API Call
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: finalMessageToSend,
        model: selectedModel
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Server error");

    if (typing?.parentNode) chatBox.removeChild(typing);

let reply = data.reply || "⚠️ Cavab alınmadı 😔";

    // MARKDOWN təmizləmə
    reply = reply
      .replace(/\*\*/g, "")
      .replace(/##+/g, "")
      .replace(/[\*_]{1,3}/g, "")
      .replace(/`+/g, "")
      .replace(/^>\s?/gm, "")
      .replace(/^-\s+/gm, "");

    // Azərbaycan dilində kiçik düzəlişlər (Tone of Voice)
    reply = reply
      .replaceAll("İlk olaraq,", "Başlayaq belə:")
      .replaceAll("Bu addımları izləyə bilərsən", "Gəlin birlikdə baxaq 👇")
      .replaceAll("Nəticədə", "Sonda isə")
      .replaceAll("Bu, sizə kömək edəcək", "Bu sənə real fərq yaradacaq 💡")
      .replaceAll("Uğurlar!", "Uğurlar, sən artıq fərqlisən 🚀");

    const botMsg = addMessage("bot", "");
    typeText(botMsg, reply);
  } catch (err) {
    console.error(err);
    if (typing?.parentNode) chatBox.removeChild(typing);

    const fallbackMsg =
      err?.message && err.message !== "Server error"
        ? `⚠️ ${err.message}`
        : "⚠️ Bağlantı xətası. Marketify AI hazırda oflayn rejimdədir.";

    addMessage("bot", fallbackMsg);
  }
}

/* ==========================================================================
   6. EVENT LISTENERS
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  loadDynamicBubbles();
  initTaglineRotator();
  if (isDesktop()) {
      startPromptRotation();
      initStarterHint();
  }
  
  // Check initial state
  if (chatBox && chatBox.children.length > 0) {
      setChatActiveMode();
  } else {
      resetToHomeState();
  }
});

// --- Input & Form Handling ---
if (form && input) {
  // Key Events
  input.addEventListener("keydown", (e) => {
    if (isMobile()) {
      if (e.key === "Enter") return; // Let it add newline
    }
    
    // Desktop: Shift+Enter = newline, Enter = send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.dispatchEvent(new Event("submit")); // Trigger submit handler
    }
  });

  // Input Typing Events
  input.addEventListener("input", function() {
    // 1. Height Adjustment
    const maxHeight = 180;
    this.style.height = "44px";
    const contentHeight = this.scrollHeight;
    this.style.height = `${Math.min(contentHeight, maxHeight)}px`;
    this.classList.toggle("scrolling", contentHeight > maxHeight);

    // 2. Desktop Placeholder logic
    if (isDesktop()) {
        if (this.value.trim() !== "") {
            userStartedTyping = true;
            stopPromptRotation();
        } else {
            userStartedTyping = false;
            startPromptRotation();
        }
    }

    // 3. UI State (Show/Hide Bubbles/Titles)
    updateUIStateForInput();
  });

  // ✅ Placeholder Click (Desktop)
  input.addEventListener("click", () => {
    if (!isDesktop()) return;
    
    // "Sualını yaz..." deyilsə kopyala
    if (input.value.trim() === "" && input.placeholder !== "Sualını yaz...") {
        input.value = input.placeholder;
        input.select();
        userStartedTyping = true;
        stopPromptRotation();
        input.dispatchEvent(new Event("input"));
    }
  });

  // Send Button Click Handler
  if (sendBtn) {
      sendBtn.addEventListener("click", (e) => {
          e.preventDefault();
          form.dispatchEvent(new Event("submit"));
      });
  }

  // ✅ Submit Handler (YENİLƏNİB!)
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    
    sendMessage(msg);
    
    // Reset Input
    input.value = "";
    input.style.height = "auto";
    input.style.overflowY = "hidden";
    input.classList.remove("scrolling");
    
    // ✅ Desktop: Həmişə "Sualını yaz..." qalsın və rotasiya dayansın
    if (isDesktop()) {
        input.placeholder = "Sualını yaz...";
        userStartedTyping = false;
        stopPromptRotation();
        // restart silindi
        
        // ⚡ FORCE STATE UPDATE: Input təmizlənəndən sonra UI vəziyyətini yenilə
        // Bu, kartın gizli qalmasını təmin edəcək (çünki chatBox.children > 0)
        updateUIStateForInput();
    }
  });
}

// --- Model Selection Dropdown ---
if (modelBtn) {
  modelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("show");
    arrow.classList.toggle("open");
  });
}

document.addEventListener("click", (e) => {
  // Close Main Model Dropdown
  if (dropdownMenu && !dropdownMenu.contains(e.target) && !modelBtn.contains(e.target)) {
    dropdownMenu.classList.remove("show");
    if(arrow) arrow.classList.remove("open");
  }
  
  // Close Bottom Model Menu (if exists)
  const bMenu = document.getElementById("bottom-model-menu");
  const bTrigger = document.getElementById("bottom-model-trigger");
  if (bMenu && !bMenu.contains(e.target) && bTrigger && !bTrigger.contains(e.target)) {
    bMenu.classList.remove("show");
    bTrigger.classList.remove("active");
  }
  
  // Close Contact Popup
  const contactPopup = document.getElementById("contactPopup");
  const contactBtn = document.getElementById("contactBtn");
  if (contactPopup && contactBtn && !contactBtn.contains(e.target) && !contactPopup.contains(e.target)) {
      contactPopup.classList.remove("show");
      contactPopup.classList.add("hidden");
  }
});

document.querySelectorAll(".model-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".model-item").forEach((m) => m.classList.remove("selected"));
    item.classList.add("selected");
    selectedModel = item.dataset.model;

    const brand = document.querySelector(".brand");
    const version = document.querySelector(".version");
    
    // Brand Name Update Logic
    if (selectedModel === "local") {
      if(brand) brand.textContent = "Marketify Brain";
      if(version) version.textContent = "Beta";
    } else {
      if(brand) brand.textContent = "Marketify AI";
      if(version) version.textContent = "2.0";
    }

    dropdownMenu.classList.remove("show");
    arrow.classList.remove("open");
  });
});

// --- Clear Chat / Confirm Popup ---
const confirmPopup = document.getElementById("confirmPopup");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");

if (clearBtn) {
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    confirmPopup.classList.add("show");
  });
}

if (confirmNo) {
  confirmNo.addEventListener("click", (e) => {
    e.preventDefault();
    confirmPopup.classList.remove("show");
  });
}

if (confirmYes) {
  confirmYes.addEventListener("click", (e) => {
     e.preventDefault();
     confirmPopup.classList.remove("show");
    resetToHomeState(); // Uses the centralized reset function
  })
}

// --- Bottom Model Picker (System Core) ---
const bTrigger = document.getElementById("bottom-model-trigger");
if (bTrigger) {
    bTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const bMenu = document.getElementById("bottom-model-menu");
      if(bMenu) bMenu.classList.toggle("show");
      bTrigger.classList.toggle("active");
    });
    
    const bItems = document.querySelectorAll(".b-model-item");
    const bLabel = document.getElementById("bottom-model-text");
    
    bItems.forEach(item => {
        item.addEventListener("click", () => {
             const newVal = item.getAttribute("data-val");
             const newName = item.textContent.trim();
             
             selectedModel = newVal;
             if(bLabel) bLabel.textContent = newName;
             
             bItems.forEach(i => i.classList.remove("selected"));
             item.classList.add("selected");
             
             // Sync with main brand text logic if needed
             const brand = document.querySelector(".brand");
             const version = document.querySelector(".version");
             if (brand && version) {
                if (newVal === "local") {
                  brand.textContent = "Marketify Brain";
                  version.textContent = "Beta";
                } else {
                  brand.textContent = "Marketify AI";
                  version.textContent = "2.0";
                }
             }
             
             document.getElementById("bottom-model-menu").classList.remove("show");
             bTrigger.classList.remove("active");
        });
    });
}

// --- Contact Popup ---
const contactBtn = document.getElementById("contactBtn");
if (contactBtn) {
    contactBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const contactPopup = document.getElementById("contactPopup");
        if(contactPopup) {
            contactPopup.classList.toggle("show");
            contactPopup.classList.remove("hidden");
        }
    });
}

// --- FAQ Toggle ---
function toggleFaq(id) {
  const content = document.getElementById(id);
  if(content) content.classList.toggle("open");
  
  if (event && event.currentTarget) {
      event.currentTarget.classList.toggle("open");
  }
}

// --- Navigation (Mobile) ---
const navHome = document.getElementById("nav-home");
const navNewChat = document.getElementById("nav-new-chat");
const navClear = document.getElementById("nav-clear");
const navMenu = document.getElementById("nav-menu");
const allNavBtns = document.querySelectorAll(".nav-btn");

function setActiveNav(btn) {
  allNavBtns.forEach(b => b.classList.remove("active"));
  if(btn) btn.classList.add("active");
}

if (navHome) {
  navHome.addEventListener("click", () => {
    setActiveNav(navHome);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (chatBox && chatBox.children.length === 0) {
        resetToHomeState();
    }
  });
}

if (navNewChat) {
  navNewChat.addEventListener("click", (e) => {
    setActiveNav(navNewChat);
    e.preventDefault();
    if (chatBox && chatBox.children.length > 0) {
        if(confirmPopup) confirmPopup.classList.add("show");
    } else {
        if (input) input.focus();
    }
    setTimeout(() => navNewChat.classList.remove("active"), 300);
  });
}

if (navClear) {
  navClear.addEventListener("click", (e) => {
    setActiveNav(navClear);
    e.preventDefault();
    if(confirmPopup) confirmPopup.classList.add("show");
    setTimeout(() => navClear.classList.remove("active"), 300);
  });
  
  if (chatBox) {
      const observer = new MutationObserver(() => {
        if (chatBox.children.length > 0) {
            navClear.classList.remove("hidden-btn");
        } else {
            navClear.classList.add("hidden-btn");
            navClear.classList.remove("active");
        }
      });
      observer.observe(chatBox, { childList: true });
  }
}

if (navMenu) {
  navMenu.addEventListener("click", (e) => {
    e.stopPropagation();
    setActiveNav(navMenu);
    if(input) input.blur();
    
    if(dropdownMenu) dropdownMenu.classList.toggle("show");
    if(arrow) arrow.classList.toggle("open");
    
    setTimeout(() => navMenu.classList.remove("active"), 300);
  });
}

// --- Mobile Keyboard Detection ---
(function () {
  const body = document.body;
  function isTextInput(el) {
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }
  document.addEventListener('focusin', (e) => {
      if (isTextInput(e.target)) body.classList.add('keyboard-open');
  }, true);
  document.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!isTextInput(document.activeElement)) body.classList.remove('keyboard-open');
      }, 150);
  }, true);
  
  if (window.visualViewport) {
    let baseHeight = window.visualViewport.height;
    window.visualViewport.addEventListener('resize', () => {
      if (isTextInput(document.activeElement)) return;
      const diff = baseHeight - window.visualViewport.height;
      if (diff > 120) body.classList.add('keyboard-open');
      else body.classList.remove('keyboard-open');
    });
  }
})();