// 🎯 Elementlər
const modelBtn = document.getElementById("model-btn");
const dropdownMenu = document.getElementById("dropdownMenu");
const arrow = document.querySelector(".arrow-down");
const clearBtn = document.getElementById("clearChat");
const chatBox = document.getElementById("chat-box");
const bubbles = document.querySelectorAll(".bubble");
const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const center = document.getElementById("center-view");

/* ============================================
   DYNAMIC TWO-LINE PROMPT BUBBLES
============================================ */

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

function loadDynamicBubbles() {
  const container = document.querySelector(".prompt-bubbles");
  if (!container) return;

  container.innerHTML = "";

  // Qarışdır və ilk 4-nü götür
  const selected = promptSuggestions
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

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
  const input = document.getElementById("user-input");
  input.value = `${item.title} ${item.sub}`;
  input.focus();

  input.dispatchEvent(new Event("input"));

  hideCenterElements();
  showNewChat();

  // 🔥 Popup göstər
  showSuggestionPopup();
});

    container.appendChild(btn);
  });
}

document.addEventListener("DOMContentLoaded", loadDynamicBubbles);

// 🟣 MODEL DROPDOWN
let selectedModel = "gpt-4o";

if (modelBtn) {
  modelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("show");
    arrow.classList.toggle("open");
  });
}

document.addEventListener("click", (e) => {
  if (dropdownMenu && !dropdownMenu.contains(e.target) && !modelBtn.contains(e.target)) {
    dropdownMenu.classList.remove("show");
    if(arrow) arrow.classList.remove("open");
  }
});

document.querySelectorAll(".model-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();

    document.querySelectorAll(".model-item")
      .forEach((m) => m.classList.remove("selected"));

    item.classList.add("selected");
    selectedModel = item.dataset.model;

    const brand = document.querySelector(".brand");
    const version = document.querySelector(".version");

    if (selectedModel === "local") {
      brand.textContent = "Marketify Brain";
      version.textContent = "Beta";
    } else {
      brand.textContent = "Marketify AI";
      version.textContent = "2.0";
    }

    dropdownMenu.classList.remove("show");
    arrow.classList.remove("open");
  });
});

function addMessage(role, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", role);
  msg.innerHTML = text;
  chatBox.appendChild(msg);

  if (role === "bot") {
    const actions = document.createElement("div");
    actions.classList.add("msg-floating-left");

    actions.innerHTML = `
      <button class="msg-btn copy-btn">
        <svg width="16" height="16" stroke="currentColor" fill="none" viewBox="0 0 24 24">
          <rect x="9" y="9" width="13" height="13" rx="2"></rect>
          <path d="M5 15V5a2 2 0 0 1 2-2h10"></path>
        </svg>
      </button>

      <button class="msg-btn share-btn">
        <svg width="16" height="16" stroke="currentColor" fill="none" viewBox="0 0 24 24">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <line x1="8.6" y1="13.5" x2="15.4" y2="17.5"></line>
          <line x1="15.4" y1="6.5" x2="8.6" y2="10.5"></line>
        </svg>
      </button>
    `;

    // 🔥 HƏMİŞƏ DOM-DAN GÖTÜRÜLƏN REAL MƏTN
    const getRealText = () => msg.innerText.trim();

    // COPY
    actions.querySelector(".copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(getRealText());
      showCopyPopup();
    });

    // SHARE
    actions.querySelector(".share-btn").addEventListener("click", async () => {
      const real = getRealText();

      if (navigator.share) {
        await navigator.share({
          title: "Marketify AI cavabı",
          text: real
        });
      } else {
        navigator.clipboard.writeText(real);
        showCopyPopup("Paylaşma dəstəklənmir, kopyalandı");
      }
    });

    // Mesajdan sonra yerləşdir
    msg.insertAdjacentElement("afterend", actions);
  }

  scrollToBottom();
  return msg;
}

// 🟡 “Marketify yazır...” effekti (Düzəldilmiş - V3)
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot", "typing-message"); // Xüsusi klas əlavə etdik
  
  typing.innerHTML = `
    <span class="typing-text">Mesajını nəzərdən keçirirəm</span>
    <div class="typing-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;
  
  chatBox.appendChild(typing);
  scrollToBottom();
  return typing;
}

// ✨ Hərf-hərf yazma effekti (Smart HTML - Kodları gizlədərək yazır)
function typeText(el, text, speed = 18) {
  el.innerHTML = ""; 
  let i = 0;
  
  const interval = setInterval(() => {
    if (i >= text.length) {
      clearInterval(interval);

      // 🔥 YAZI TAM BITDI → DÜYMƏLƏRI GÖSTER
      const next = el.nextSibling;
      if (next && next.classList.contains("msg-floating-left")) {
        next.style.display = "flex";
      }

      return;
    }
    
    const char = text.charAt(i);

    // HTML teqini birdəfəlik yazırıq
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


// 🚀 SEND MESSAGE FUNKSİYASI (YADDAŞ INTEQRASİYASI İLƏ 🧠)
async function sendMessage(message) {
  if (!message.trim()) return;
  
  // Mərkəzi görünüşü gizlət
  center.style.display = "none";
  
  // ✅ DÜYMƏNİ GÖSTƏR (Fade-in)
  if (clearBtn) clearBtn.classList.add("show");

  addMessage("user", message);
  const typing = showTyping();

  // ▼ ▼ ▼ YADDAŞ MƏNTİQİ (YENİ HİSSƏ) ▼ ▼ ▼
  const savedMemory = localStorage.getItem('marketify_memory');
  let finalMessageToSend = message;

  // Əgər istifadəçi yaddaşa nəsə yazıbsa, onu mesajın əvvəlinə gizli şəkildə əlavə edirik
  if (savedMemory && savedMemory.trim() !== "") {
    finalMessageToSend = `[Sistem Təlimatı / İstifadəçi Konteksti: ${savedMemory}]\n\nİstifadəçinin Mesajı: ${message}`;
  }
  // ▲ ▲ ▲ ▲ ▲ ▲

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: finalMessageToSend, // Bura artıq "yaddaşlı" mesaj gedir
        model: selectedModel
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Server error");
    }

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

// Mövcud Form Submit Kodunuzu bu şəkildə yeniləyin:
if (form && input) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    sendMessage(msg);
    
    // ✅ YENİ: Mesaj göndəriləndə inputu əvvəlki halına qaytar
    input.value = "";
    input.style.height = "auto"; 
    input.style.overflowY = "hidden";
    input.classList.remove("scrolling");
  });

  function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

input.addEventListener("keydown", (e) => {

  // 📱 MOBILE → Enter = SƏTİR AŞAĞI
  if (isMobile()) {
    if (e.key === "Enter") {
      // Göndərməsin, normal newline versin
      return;
    }
  }

  // 💻 DESKTOP → Shift+Enter = newline
  if (e.key === "Enter" && e.shiftKey) {
    return; // normal newline
  }

  // 💻 DESKTOP → Enter = göndər
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    sendMessage(msg);

    input.value = "";
    input.style.height = "44px";
    input.classList.remove("scrolling");
  }
});

}

// ✅ Scroll aşağı
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

// ⚠️ Popup və təmizlə
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

/* script.js - Təxminən sətir 280 civarı */

if (confirmYes) {
  confirmYes.addEventListener("click", async (e) => {
    e.preventDefault();
    confirmPopup.classList.remove("show");
    
    // Çatı təmizlə
    chatBox.innerHTML = "";
    
    // Ana ekranı qaytar
    center.style.display = "flex";

    // ✅ BU SƏTRİ ƏLAVƏ ET: Bubbles gizlidirsə, mütləq görünsün
    const pContainer = document.querySelector(".prompt-bubbles");
    if(pContainer) pContainer.classList.remove("hidden-bubbles");
    
    // Düyməni gizlət
    if (clearBtn) clearBtn.classList.remove("show");

    // Bubbles-ları yenidən yüklə
    loadDynamicBubbles();

    // ... (kodun qalan hissəsi eynilə qalır)

    const notice = document.createElement("div");
    notice.textContent = "💬 Yeni söhbət üçün hazırsan 😎";
    Object.assign(notice.style, {
      position: "fixed",
      bottom: "100px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "linear-gradient(135deg,#2d6bff,#60a5ff)",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: "12px",
      fontFamily: "'Poppins',sans-serif",
      zIndex: "999",
      opacity: "0",
      transition: "opacity 0.4s ease",
    });
    document.body.appendChild(notice);
    setTimeout(() => (notice.style.opacity = "1"), 80);
    setTimeout(() => {
      notice.style.opacity = "0";
      setTimeout(() => notice.remove(), 600);
    }, 2200);
  });
}
/* ============================================
   🔄 AUTO-ROTATING TAGLINE (FIXED)
============================================ */

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

// script.js - faylın ən sonundakı funksiya

function initTaglineRotator() {
  const taglineEl = document.querySelector(".tagline");
  if (!taglineEl) return;

  // Başlanğıc mətn
  let currentIndex = Math.floor(Math.random() * rotatingTaglines.length);
  taglineEl.textContent = rotatingTaglines[currentIndex];

  setInterval(() => {
    // 1. Animasiyanı başlat (Gizlət)
    taglineEl.classList.add("hide");

    // 2. CSS-dəki 0.6s (600ms) bitdikdən sonra mətni dəyiş
    setTimeout(() => {
      currentIndex = (currentIndex + 1) % rotatingTaglines.length;
      taglineEl.textContent = rotatingTaglines[currentIndex];
      
      // 3. Mətn dəyişdi, indi yenidən göstər
      taglineEl.classList.remove("hide");
    }, 600); // CSS transition müddəti ilə eyni olmalıdır
  }, 5000); // Hər 5 saniyədən bir dəyişsin
}

document.addEventListener("DOMContentLoaded", initTaglineRotator);


// 1. Elementləri seçirik
const promptContainer = document.querySelector(".prompt-bubbles");
const userInputField = document.getElementById("user-input");

// 2. Input sahəsini dinləyirik
if (userInputField && promptContainer) {
  userInputField.addEventListener("input", () => {
    // Əgər inputda boşluqdan başqa simvol varsa, bubbles gizlənsin
    if (userInputField.value.trim().length > 0) {
      promptContainer.classList.add("hidden-bubbles");
    } else {
      // Input boşdursa, bubbles geri qayıtsın
      promptContainer.classList.remove("hidden-bubbles");
    }
  });
}

/* ============================================
   🔄 INPUT RESET FIX (script.js - mövcud hissəni yeniləyin)
============================================ */

if (form && input) {
  // 1. Submit (Göndər düyməsi)
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    sendMessage(msg);
    
    // ✅ DÜZƏLİŞ: Inputu təmizlə və hündürlüyü standart (44px) hala qaytar
    input.value = "";
    input.style.height = "44px"; 
    input.style.overflowY = "hidden";
  });



  // 3. Avto-böyümə funksiyası (Bunu olduğu kimi saxlayın və ya əlavə edin)
  input.addEventListener("input", function() {
    const maxHeight = 180; // px
    this.style.height = "44px"; // əvvəl sıfırlayırıq

    const contentHeight = this.scrollHeight;
    const nextHeight = Math.min(contentHeight, maxHeight);
    this.style.height = `${nextHeight}px`;

    // Mətn çox olanda scrollbar göstər
    if (contentHeight > maxHeight) {
      this.classList.add("scrolling");
    } else {
      this.classList.remove("scrolling");
    }
  });
}

/* ============================================
   BRAND + TAGLINE + BUBBLES AUTO-HIDE SYSTEM
============================================ */

// Elementlər
const brandTitle = document.querySelector(".brand-sub");  // Marketify AI
const tagline = document.querySelector(".tagline");        // Tagline
const promptBubbles = document.querySelector(".prompt-bubbles"); // Bubbles

// Funksiya: Hamısını gizlət
function hideCenterElements() {
  if (brandTitle) brandTitle.style.display = "none";
  if (tagline) tagline.style.display = "none";
  if (promptBubbles) promptBubbles.style.display = "none";
}

// Funksiya: Hamısını göstər
function showCenterElements() {
  if (brandTitle) brandTitle.style.display = "block";
  if (tagline) tagline.style.display = "block";
  if (promptBubbles) {
    promptBubbles.style.display = "flex";
    loadDynamicBubbles(); // yenidən bubble-lar gəlir
  }
}

// 1) İstifadəçi inputa yazanda gizlənsin
input.addEventListener("input", () => {
  if (input.value.trim().length > 0) {
    hideCenterElements();
  } else {
    // input boşdursa göstər
    if (chatBox.children.length === 0) {
      showCenterElements();
    }
  }
});

// 2) Mesaj göndəriləndə gizli qalsın
form.addEventListener("submit", () => {
  hideCenterElements();
});

// 3) Chat təmizlənəndə yenidən görünsün  (clearChat artıq var – bunu genişləndiririk)
if (confirmYes) {
  confirmYes.addEventListener("click", () => {
    setTimeout(() => {
      showCenterElements();
    }, 50);
  });
}

// 4) Səhifə yenilənəndə – əgər chat boşdursa, göstər
window.addEventListener("DOMContentLoaded", () => {
  if (chatBox.children.length === 0) {
    showCenterElements();
  } else {
    hideCenterElements();
  }
});

/* ============================================
   YENİ SÖHBƏT — BRAND-SUB REPLACEMENT SYSTEM
============================================ */

const newChat = document.getElementById("newChat");
const brandMainTitle = document.querySelector(".brand-sub");

// 🟦 FUNKSIYA: “Yeni söhbət” göstər
function showNewChat() {
  if (!newChat) return;

  newChat.style.display = "block";
  setTimeout(() => newChat.classList.add("show"), 10);

  // Marketify AI gizlət
  brandMainTitle.style.opacity = "0";
  brandMainTitle.style.transform = "scale(0.9) translateY(6px)";
}

// 🟥 FUNKSIYA: “Yeni söhbət” gizlət
function hideNewChat() {
  if (!newChat) return;

  newChat.classList.remove("show");
  setTimeout(() => (newChat.style.display = "none"), 200);
}

// Input yazıldıqda aktiv olsun
input.addEventListener("input", () => {
  if (input.value.trim().length > 0) {
    showNewChat();
  } else {
    hideNewChat();

    // Chat boşdursa — Marketify AI geri qayıtsın
    if (chatBox.children.length === 0) {
      brandMainTitle.style.opacity = "1";
      brandMainTitle.style.transform = "scale(1) translateY(0)";
    }
  }
});

// Mesaj göndəriləndə “Yeni söhbət” tam yox olsun
const _originalSend = sendMessage;
sendMessage = function(msg) {
  hideNewChat();
  brandMainTitle.style.opacity = "0";
  _originalSend(msg);
};

// Chat təmizlənəndə — hər şey sıfırlansın
if (confirmYes) {
  confirmYes.addEventListener("click", () => {
    setTimeout(() => {
      hideNewChat();
      brandMainTitle.style.opacity = "1";
      brandMainTitle.style.transform = "scale(1)";
    }, 80);
  });
}

/* ============================================
   STATİK YENİ SÖHBƏT BAŞLIĞI & XƏBƏRDARLIQ (YENİLƏNMİŞ)
============================================ */
const newTitle = document.querySelector(".new-dynamic-title");
const newDisclaimer = document.querySelector(".new-chat-disclaimer"); // <--- YENİ ELEMENT

// Köməkçi Funksiyalar (Bunu hər yerdə işlədəcəyik)
function showNewChat() {
  if (newTitle) newTitle.classList.add("show");
  if (newDisclaimer) newDisclaimer.classList.add("show");

  // Ana ekran elementlərini gizlət
  const brandTitle = document.querySelector(".brand-sub");
  const tagline = document.querySelector(".tagline");
  if(brandTitle) brandTitle.style.opacity = "0";
  if(tagline) tagline.style.opacity = "0";
}

function hideNewChat() {
  if (newTitle) newTitle.classList.remove("show");
  if (newDisclaimer) newDisclaimer.classList.remove("show");
}

// 1. Inputa yazanda işə düşsün
if (input) {
  input.addEventListener("input", () => {
    if (input.value.trim().length > 0) {
      showNewChat();
    } else {
      // Çat boşdursa, hər şeyi əvvəlki halına qaytar
      const chatBox = document.getElementById("chat-box");
      if (chatBox && chatBox.children.length === 0) {
        hideNewChat();
        
        const brandTitle = document.querySelector(".brand-sub");
        const tagline = document.querySelector(".tagline");
        if(brandTitle) brandTitle.style.opacity = "1";
        if(tagline) tagline.style.opacity = "1";
      } else {
        // Mesaj varsa, sadəcə başlığı gizlət
        hideNewChat();
      }
    }
  });
}

// 2. Mesaj göndəriləndə (Send button) hər şey gizlənsin
// Qeyd: Bu kod mövcud sendMessage funksiyasını "overwrite" edir
const _superOriginalSend = sendMessage;
sendMessage = function(msg) {
  hideNewChat();
  
  // Hər ehtimala qarşı ana ekranı da gizli saxla
  const brandTitle = document.querySelector(".brand-sub");
  const tagline = document.querySelector(".tagline");
  if(brandTitle) brandTitle.style.opacity = "0";
  if(tagline) tagline.style.opacity = "0";

  _superOriginalSend(msg);
};


/* SHOW/HIDE */
input.addEventListener("input", () => {
  if (input.value.trim().length > 0) {
    newTitle.classList.add("show");

    brandTitle.style.opacity = "0";
    tagline.style.opacity = "0";
  } else {
    newTitle.classList.remove("show");

    // yalnız chat boşdursa Marketify AI geri qayıdır
    if (chatBox.children.length === 0) {
      brandTitle.style.opacity = "1";
      tagline.style.opacity = "1";
    }
  }
});

/* Dynamic word rotation */
setInterval(() => {
  dynamicIndex = (dynamicIndex + 1) % dynamicWords.length;

  newDynamic.classList.add("fade");
  setTimeout(() => {
    newDynamic.textContent = dynamicWords[dynamicIndex];
    newDynamic.classList.remove("fade");
  }, 400);
}, 3000);

/* Chat göndəriləndə daim gizli qalsın */
const originalSend = sendMessage;
sendMessage = function(msg) {
  newTitle.classList.remove("show");
  brandTitle.style.opacity = "0";
  tagline.style.opacity = "0";
  originalSend(msg);
};

/* Chat təmizlənəndə sıfırlansın */
confirmYes.addEventListener("click", () => {
  setTimeout(() => {
    newTitle.classList.remove("show");
    brandTitle.style.opacity = "1";
    tagline.style.opacity = "1";
  }, 50);
});

// 🎯 SEND BUTTON DİNAMİK TƏNZİMİ
const sendBtn = document.getElementById("send-btn");
const userInput = document.getElementById("user-input");

// Başlanğıcda deaktiv et
disableSendBtn();

// Inputa yazılanda rəngi dəyişsin
userInput.addEventListener("input", () => {
  if (userInput.value.trim().length > 0) {
    enableSendBtn();
  } else {
    disableSendBtn();
  }
});

// Mesaj göndəriləndə yenidən deaktiv et
form.addEventListener("submit", () => {
  disableSendBtn();
});

// Çat təmizlənəndə (clearChat → confirmYes)
if (confirmYes) {
  confirmYes.addEventListener("click", () => {
    disableSendBtn();
  });
}

// Funksiyalar
function enableSendBtn() {
  sendBtn.classList.remove("disabled");
  sendBtn.disabled = false;
}

function disableSendBtn() {
  sendBtn.classList.add("disabled");
  sendBtn.disabled = true;
}

/* =========================================
   🔗 MODEL PICKER INTEGRATION (SYSTEM CORE)
   ========================================= */

document.addEventListener("DOMContentLoaded", () => {
  const trigger = document.getElementById("bottom-model-trigger");
  const menu = document.getElementById("bottom-model-menu");
  const textLabel = document.getElementById("bottom-model-text");
  const items = document.querySelectorAll(".b-model-item");

  // 1. Menyunu açmaq/bağlamaq
  if (trigger && menu) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("show");
      trigger.classList.toggle("active");
    });
  }

  // 2. Kənara klikləyəndə bağlamaq
  document.addEventListener("click", (e) => {
    if (menu && !menu.contains(e.target) && !trigger.contains(e.target)) {
      menu.classList.remove("show");
      trigger.classList.remove("active");
    }
  });

  // 3. SEÇİM MƏNTİQİ (ƏSAS HİSSƏ)
  items.forEach(item => {
    item.addEventListener("click", () => {
      // A) Dəyəri HTML-dən götürürük (gpt-4o, local və s.)
      const newVal = item.getAttribute("data-val");
      const newName = item.textContent.trim();

      // B) 🔴 SİSTEMİ YENİLƏYİRİK (Ən vacib yer)
      // Sənin script.js-dəki 'selectedModel' dəyişənini dəyişirik
      if (typeof selectedModel !== 'undefined') {
        selectedModel = newVal; 
        console.log("✅ Sistem modeli dəyişdi:", selectedModel);
      }

      // C) Button üzərindəki yazını dəyişirik
      if (textLabel) textLabel.textContent = newName;

      // D) Vizual olaraq 'selected' sinfini dəyişirik
      items.forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");

      // E) Menyunu bağlayırıq
      menu.classList.remove("show");
      trigger.classList.remove("active");

      // F) (Opsional) Əgər köhnə Brand adı dəyişmə effektini saxlamaq istəyirsənsə:
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
    });
  });
});


/* ===========================
   🌐 MODAL OPEN/CLOSE FUNCTIONS
   =========================== */
function openModal(id) {
  document.getElementById(id).classList.add("show");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

function openModal(id) {
  document.getElementById(id).classList.add("show");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("show");
}

function toggleFaq(id) {
  const content = document.getElementById(id);

  // content açılıb-bağlanır
  content.classList.toggle("open");

  // kliklənən kateqoriyanı tapırıq və ona 'open' class veririk
  const category = event.currentTarget;
  category.classList.toggle("open");
}


/* ============================================
   📱 MOBILE NAVIGATION LOGIC (FIXED)
============================================ */
document.addEventListener("DOMContentLoaded", () => {
  const navHome = document.getElementById("nav-home");
  const navNewChat = document.getElementById("nav-new-chat");
  const navClear = document.getElementById("nav-clear");
  const navMenu = document.getElementById("nav-menu");
  
  const allNavBtns = document.querySelectorAll(".nav-btn");

  function setActiveNav(btn) {
    allNavBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  }

  // 🛠 KÖMƏKÇİ FUNKSİYA: Ekranı "Ana Səhifə" halına qaytarır
  function resetToHomeState() {
    const chatBox = document.getElementById("chat-box");
    const input = document.getElementById("user-input");

    // Yalnız çat boşdursa dizaynı sıfırla (Mesaj varsa dəymirik)
    if (chatBox && chatBox.children.length === 0) {
        // 1. Mərkəzi elementləri (Logo, Bubbles) geri gətir
        if (typeof showCenterElements === "function") showCenterElements();
        
        // 2. "Yeni Söhbət" başlığını gizlət
        if (typeof hideNewChat === "function") hideNewChat();

        // 3. Inputu təmizlə və klaviaturanı bağla (blur)
        if (input) {
            input.value = "";
            input.blur(); // Klaviaturanı bağlayır
            input.style.height = "44px";
        }
    }
  }

  // 1. HOME (ƏSAS) — ARTIQ EKRANI SIFIRLAYIR
  if (navHome) {
    navHome.addEventListener("click", () => {
      setActiveNav(navHome);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // 👇 ƏSAS DÜZƏLİŞ: Rejimi sıfırlayırıq
      resetToHomeState();
    });
  }

  // 2. NEW CHAT (YENİ SÖHBƏT) — FULL UI SWITCH
  if (navNewChat) {
    navNewChat.addEventListener("click", (e) => {
      setActiveNav(navNewChat);
      e.preventDefault();

      const chatBox = document.getElementById("chat-box");
      const input = document.getElementById("user-input");
      const popup = document.getElementById("confirmPopup");

      // A) Əgər çatda mesaj varsa -> Popup aç (Silmək üçün)
      if (chatBox && chatBox.children.length > 0) {
        if (popup) popup.classList.add("show");
      } 
      
      // B) Əgər çat boşdursa -> "YAZIŞMA REJİMİNİ" MƏCBURİ AKTİVLƏŞDİR
      else {
        // 1. Ana Ekranı (Logo, Tagline, BUBBLES) MƏCBURİ GİZLƏT
        if (typeof hideCenterElements === "function") {
          hideCenterElements(); 
        }

        // 2. "Yeni Söhbət" başlığını və xəbərdarlığı GÖSTƏR
        if (typeof showNewChat === "function") {
          showNewChat();
        }

        // 3. Inputa fokuslan
        if (input) {
            input.focus();
        }
      }

      setTimeout(() => navNewChat.classList.remove("active"), 300);
    });
  }
  
  // 3. CLEAR (TƏMİZLƏ)
  if (navClear) {
    navClear.addEventListener("click", (e) => {
      setActiveNav(navClear);
      e.preventDefault();
      
      const popup = document.getElementById("confirmPopup");
      if(popup) popup.classList.add("show");
      
      setTimeout(() => navClear.classList.remove("active"), 300);
    });
  }

  // 4. MENU
  if (navMenu) {
    navMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      setActiveNav(navMenu);
      
      // Menyu açılarkən də klaviaturanı bağlamaq yaxşı olar
      const input = document.getElementById("user-input");
      if(input) input.blur();

      const dropdown = document.getElementById("dropdownMenu");
      const arrow = document.querySelector(".arrow-down");
      
      if(dropdown) dropdown.classList.toggle("show");
      if(arrow) arrow.classList.toggle("open");
      
      setTimeout(() => navMenu.classList.remove("active"), 300);
    });
  }
});

/* ============================================
   🔄 AUTO-HIDE/SHOW CLEAR BUTTON
============================================ */
document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chat-box");
  const navClear = document.getElementById("nav-clear");

  if (chatBox && navClear) {
    // 1. Dəyişiklikləri izləyən funksiya
    const observer = new MutationObserver(() => {
      // Əgər çatda mesaj varsa, 'hidden-btn' sinfini SİL (görünsün)
      if (chatBox.children.length > 0) {
        navClear.classList.remove("hidden-btn");
      } 
      // Mesaj yoxdursa, 'hidden-btn' sinfini ƏLAVƏ ET (gizlənsin)
      else {
        navClear.classList.add("hidden-btn");
        navClear.classList.remove("active"); // Aktiv effekti də sil
      }
    });

    // 2. İzləməni başlat
    observer.observe(chatBox, { childList: true });
  }
});

// 📱 Mobile keyboard detection — stable version
(function () {
  const body = document.body;

  function isTextInput(el) {
    return (
      el &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable)
    );
  }

  // ---- Focus based (PRIMARY) ----
  document.addEventListener(
    'focusin',
    (e) => {
      if (isTextInput(e.target)) {
        body.classList.add('keyboard-open');
      }
    },
    true
  );

  document.addEventListener(
    'focusout',
    () => {
      setTimeout(() => {
        if (!isTextInput(document.activeElement)) {
          body.classList.remove('keyboard-open');
        }
      }, 150);
    },
    true
  );

  // ---- VisualViewport fallback (SECONDARY) ----
  if (window.visualViewport) {
    let baseHeight = window.visualViewport.height;

    window.visualViewport.addEventListener('resize', () => {
      // Əgər input fokusdadırsa, viewport heç nə dəyişə bilməz
      if (isTextInput(document.activeElement)) return;

      const diff = baseHeight - window.visualViewport.height;

      if (diff > 120) {
        body.classList.add('keyboard-open');
      } else {
        body.classList.remove('keyboard-open');
      }
    });
  }
})();
