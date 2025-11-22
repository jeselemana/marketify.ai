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
  { title: "Yeni il kampaniyası", sub: "üçün kreativ strategiya" },
  { title: "Satışları artırmaq", sub: "üçün 5 psixoloji üsul" },
  { title: "Brend hekayəsi", sub: "yazmaqda kömək et" },
  { title: "Email marketinq", sub: "üçün başlıq ideyaları" },
  { title: "Müştəri rəyləri", sub: "üçün cavab şablonu" },
  
  // Sosial Media
  { title: "Instagram Reels", sub: "üçün viral ssenari" },
  { title: "TikTok trendləri", sub: "biznesimə necə uyğunlaşdırım?" },
  { title: "LinkedIn postu", sub: "peşəkar üslubda yaz" },
  { title: "Youtube videosu", sub: "üçün SEO təsviri" },

  // Yaradıcılıq & İdeya
  { title: "Reklam sloqanı", sub: "qısa və yaddaqalan olsun" },
  { title: "Logo dizaynı", sub: "üçün prompt hazırla" },
  { title: "Məhsul adı", sub: "tapmaqda kömək et" },
  { title: "Startap ideyası", sub: "üçün SWOT analizi" },
  
  // Texniki & Digər
  { title: "SEO açar sözlər", sub: "bu mövzu üçün tap" },
  { title: "Blog yazısı", sub: "giriş hissəsi yaz" },
  { title: "Müsahibə sualları", sub: "SMM meneceri üçün" }
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
    });

    container.appendChild(btn);
  });
}

document.addEventListener("DOMContentLoaded", loadDynamicBubbles);

// 🟣 MODEL DROPDOWN
let selectedModel = "gpt-4o-mini";

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

// 🟣 Mesaj əlavə etmə
function addMessage(role, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", role);
  msg.textContent = text;
  chatBox.appendChild(msg);
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

// ✨ Hərf-hərf yazma effekti
function typeText(el, text, speed = 18) {
  el.textContent = "";
  let i = 0;
  const interval = setInterval(() => {
    el.textContent += text.charAt(i);
    i++;
    scrollToBottom();
    if (i >= text.length) clearInterval(interval);
  }, speed);
}

// 🚀 SEND MESSAGE FUNKSİYASI (Düzəldilmiş Versiya)
async function sendMessage(message) {
  if (!message.trim()) return;
  
  // Mərkəzi görünüşü gizlət
  center.style.display = "none";
  
  // ✅ DÜYMƏNİ GÖSTƏR (Fade-in)
  if (clearBtn) clearBtn.classList.add("show");

  addMessage("user", message);
  const typing = showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        model: selectedModel
      }),
    });

    if (!res.ok) throw new Error("Server error");

    const data = await res.json();
    chatBox.removeChild(typing);

    let reply = data.reply || "⚠️ Cavab alınmadı 😔";

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
    chatBox.removeChild(typing);
    addMessage("bot", "⚠️ Bağlantı xətası. Marketify AI hazırda oflayn rejimdədir.");
  }
}

// ✉️ Form göndərilməsi
if (form && input) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;
    sendMessage(msg);
    input.value = "";
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const msg = input.value.trim();
      if (!msg) return;
      sendMessage(msg);
      input.value = "";
    }
  });
}

// ✅ Scroll aşağı
function scrollToBottom() {
  requestAnimationFrame(() => {
    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: "smooth" });
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

if (confirmYes) {
  confirmYes.addEventListener("click", async (e) => {
    e.preventDefault();
    confirmPopup.classList.remove("show");
    
    // Çatı təmizlə
    chatBox.innerHTML = "";
    
    // Ana ekranı qaytar
    center.style.display = "flex";
    
    // ✅ DÜYMƏNİ GİZLƏT (Fade-out)
    if (clearBtn) clearBtn.classList.remove("show");

    // Bubbles-ları yenidən yüklə
    loadDynamicBubbles();

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

// 💡 Shake Detection (v2.1)
function requestMotionAccess() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === "function") {
    DeviceMotionEvent.requestPermission()
      .then((response) => {
        if (response === "granted") initShakeDetection();
      })
      .catch(() => {});
  } else {
    initShakeDetection();
  }
}

window.addEventListener("click", () => {
  requestMotionAccess();
}, { once: true });

function initShakeDetection() {
  let lastX = null, lastY = null, lastZ = null, lastTime = 0, shakeTimeout = null;
  window.addEventListener("devicemotion", (event) => {
    const acc = event.accelerationIncludingGravity;
    if(!acc) return;
    const currentTime = Date.now();
    if ((currentTime - lastTime) > 200) {
      const deltaX = Math.abs(acc.x - (lastX || 0));
      const deltaY = Math.abs(acc.y - (lastY || 0));
      const deltaZ = Math.abs(acc.z - (lastZ || 0));
      if ((deltaX + deltaY + deltaZ) > 35) {
        if (!shakeTimeout) {
          showShakePrompt();
          shakeTimeout = setTimeout(() => (shakeTimeout = null), 5000);
        }
      }
      lastTime = currentTime;
      lastX = acc.x;
      lastY = acc.y;
      lastZ = acc.z;
    }
  });
}

function showShakePrompt() {
  if (document.querySelector(".shake-popup")) return;
  const popup = document.createElement("div");
  popup.className = "shake-popup";
  popup.innerHTML = `
    <p>💡 Saytdakı xəta haqqında məlumat vermək istəyirsən?</p>
    <div class="shake-actions">
      <button id="shakeYes">Bəli</button>
      <button id="shakeNo">Xeyr</button>
    </div>`;
  document.body.appendChild(popup);

  document.getElementById("shakeYes").addEventListener("click", () => {
    popup.remove();
    window.location.href =
      "mailto:supp.marketifym@gmail.com?subject=Marketify%202.0%20Xəta&body=Salam,%20saytda%20qarşılaşdığım%20xəta%20barədə:";
  });
  document.getElementById("shakeNo").addEventListener("click", () => popup.remove());
  setTimeout(() => popup.remove(), 8000);
}

function showInfoPopup(text) {
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) return;
  const info = document.createElement("div");
  info.className = "info-popup";
  info.textContent = text;
  document.body.appendChild(info);
  setTimeout(() => info.remove(), 3000);
}

console.log("✅ Marketify 2.0 JS tam aktivdir (Shake + Popup + Chat)");

/* ============================================
   🔄 AUTO-ROTATING TAGLINE (FIXED)
============================================ */

const rotatingTaglines = [
  "Bu gün nə haqqında danışırıq? 😊",
  "Marketinq ideyaları ilə dolu bir günə hazırsan? 🚀",
  "Sən yaz, AI düşünsün 💡",
  "Yaradıcı gücünü AI ilə birləşdir ✨",
  "Reklam dünyasında inqilab buradan başlayır 🌍",
  "Bir az sən, bir az AI... Mükəmməl nəticə 💬",
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

// 💡 Tooltip Məntiqi
document.addEventListener("DOMContentLoaded", () => {
  const tooltip = document.getElementById("model-tooltip");
  const modelBtn = document.getElementById("model-btn");

  if (tooltip && modelBtn) {
    // 1. Sayt açılandan 1.5 saniyə sonra göstər
    setTimeout(() => {
      // Əgər menyu hələ açılmayıbsa göstər
      if (!document.getElementById("dropdownMenu").classList.contains("show")) {
        tooltip.classList.add("show");
      }
    }, 1500);

    // 2. 6 saniyə sonra avtomatik gizlət
    setTimeout(() => {
      tooltip.classList.remove("show");
    }, 7500);

    // 3. Buttona klikləyəndə dərhal gizlət
    modelBtn.addEventListener("click", () => {
      tooltip.classList.remove("show");
    });
  }
});

// 💡 Tooltip Göstərmə Funksiyası (Reusable)
function triggerModelTooltip() {
  const tooltip = document.getElementById("model-tooltip");
  const dropdownMenu = document.getElementById("dropdownMenu");
  
  if (tooltip && dropdownMenu) {
    // Əgər menyu artıq açıqdırsa, tooltip-ə ehtiyac yoxdur
    if (dropdownMenu.classList.contains("show")) return;

    tooltip.classList.add("show");

    // 6 saniyə sonra gizlət
    setTimeout(() => {
      tooltip.classList.remove("show");
    }, 6000);
  }
}

// Sayt yüklənəndə işə düşən hissə
document.addEventListener("DOMContentLoaded", () => {
  // ... digər yüklənmə kodları ...

  // 1. Sayt açılandan 1.5 saniyə sonra göstər
  setTimeout(() => {
    triggerModelTooltip();
  }, 1500);

  // Buttona klikləyəndə dərhal gizlət
  const modelBtn = document.getElementById("model-btn");
  const tooltip = document.getElementById("model-tooltip");
  
  if (modelBtn && tooltip) {
    modelBtn.addEventListener("click", () => {
      tooltip.classList.remove("show");
    });
  }
});