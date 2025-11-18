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

// 🟣 MODEL DROPDOWN (100% stabil versiya)
let selectedModel = "gpt-4o-mini";

modelBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle("show");
  arrow.classList.toggle("open");
});

// Dropdown-u çöldə kliklədikdə bağlamaq
document.addEventListener("click", (e) => {
  if (!dropdownMenu.contains(e.target) && !modelBtn.contains(e.target)) {
    dropdownMenu.classList.remove("show");
    arrow.classList.remove("open");
  }
});

// Model seçimi
document.querySelectorAll(".model-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();

    document.querySelectorAll(".model-item")
      .forEach((m) => m.classList.remove("selected"));

    item.classList.add("selected");
    selectedModel = item.dataset.model;

    // UI brand text
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

// 💡 Smart suggestions
bubbles.forEach((b) => {
  b.addEventListener("click", () => {
    input.value = b.textContent.trim();
    input.focus();
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

// 🟡 “Marketify yazır...” effekti
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot");
  typing.textContent = "Bir dəqiqə, Marketify düşünür...";
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

async function sendMessage(message) {
  if (!message.trim()) return;
  center.style.display = "none";
  addMessage("user", message);
  const typing = showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        model: selectedModel // 💥 LOCAL / GPT seçimi buradan backend-ə gedir
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
    chatBox.innerHTML = "";
    center.style.display = "flex";
    bubbles.forEach((b) => (b.style.display = "inline-block"));
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



// 💡 Shake Detection (v2.1 – iPhone + Android uyumlu)
function requestMotionAccess() {
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    // iOS 13+
    DeviceMotionEvent.requestPermission()
      .then((response) => {
        if (response === "granted") {
          initShakeDetection();
          showInfoPopup("✅ Silkələmə aktivdir!");
        } else {
          showInfoPopup("⚠️ Hərəkət icazəsi verilmədi!");
        }
      })
      .catch(() => showInfoPopup("⚠️ İcazə alınarkən xəta baş verdi."));
  } else {
    // Android və ya köhnə iOS
    initShakeDetection();
    showInfoPopup("✅ Silkələmə aktivdir!");
  }
}

// 👇 Başlatmaq üçün istifadəçi klik gözləyir
window.addEventListener("click", () => {
  requestMotionAccess();
}, { once: true });

// 💫 Əsas Shake Detection
function initShakeDetection() {
  let lastX = null, lastY = null, lastZ = null, lastTime = 0, shakeTimeout = null;
  window.addEventListener("devicemotion", (event) => {
    const acc = event.accelerationIncludingGravity;
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

// 💬 Shake popup
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

// 💬 Kiçik info popup (icazə statusu üçün, yalnız mobil cihazlarda)
function showInfoPopup(text) {
  // Yalnız mobil cihazlarda göstər
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) return;

  const info = document.createElement("div");
  info.className = "info-popup";
  info.textContent = text;
  document.body.appendChild(info);
  setTimeout(() => info.remove(), 3000);
}

console.log("✅ Marketify 2.0 JS tam aktivdir (Shake + Popup + Chat)");

/* 🔄 Tagline – Non-repeating until exhausted (bubble sync) */

const taglineElement = document.querySelector(".tagline");

const allTaglines = [
  "Bu gün nə haqqında danışırıq? 😊",
  "Marketinq ideyaları ilə dolu bir günə hazırsan? 🚀",
  "Sən yaz, AI düşünsün 💡",
  "Yaradıcı gücünü AI ilə birləşdir ✨",
  "Reklam dünyasında inqilab buradan başlayır 🌍",
  "Bir az sən, bir az AI 💬",
  "Brendini AI ilə gücləndir ⚡️",
  "Marketinq gələcəyini bu gündən yarat 🌟",
  "Mətnlər gəlsin, ideyalar axsın ✍️",
  "AI sənə lazım olan tərəfdaşdır 💙",
  "Sovetin dövründə belə şey yox idi – amma indi var 😉",
  "Az olsun, saz olsun – Marketify AI ilə mükəmməl olsun 💡"
];

let taglinePool = [...allTaglines];

function rotateTagline() {
  if (taglinePool.length === 0) {
    taglinePool = [...allTaglines];
  }

  const index = Math.floor(Math.random() * taglinePool.length);
  const newTagline = taglinePool[index];
  taglinePool.splice(index, 1);

  taglineElement.style.opacity = 0;
  setTimeout(() => {
    taglineElement.textContent = newTagline;
    taglineElement.style.opacity = 1;
  }, 250);
}

/* ==========================================================
   🔄 PREMIUM DİNAMİK PROMPT BUBBLES (NO REPEAT + ANIMATED)
   ========================================================== */

const bubbleContainer = document.querySelector(".prompt-bubbles");

const dynamicPrompts = [
  // Sənin mövcud promptların
  "Yeni il kampaniyası ideyası 🎄",
  "Sosial media postu üçün mətn ✨",
  "Reklam sloqanı tap 💡",
  "LinkedIn-də keyfiyyətli məzmun yarat 💼",
  "Landing page üçün mətn yaz 📝",
  "Brend tonu yarat 🔊",
  "Google Ads üçün başlıq tap 🔥",
  "Marketinq planı qur 🚀",
  "💸 Reklamlarım üçün maliyyə planlaması",

  // 🔥 Yeni — High-Level Pro istifadəçilər üçün
  "Brendin ICP (Ideal Customer Profile) analizini et 🎯",
  "Sifirdan GTM (Go-To-Market) strategiyası hazırla 📊",
  "A/B test hipotezləri yarat (Pro) 🧪",
  "Funnel optimizasiya planı qur (Awareness→Action) 🔥",
  "Marketinq avtomatizasiya ardıcıllığı yarat (Flow) ⚡",
  "B2B satış mesajlaşdırması strukturu qur (Pro) 🏢",
  "SEO üçün yüksək niyyətli keyword klasterləri yarat 🔍",
  "Brendin mövqeləndirmə xəritəsini çıxart 🧭",
  "Rəqiblər üzrə qısa SWOT analiz çıxart 📈",
];

// 🔁 Rotation üçün pool
let pool = [...dynamicPrompts];

function loadRandomBubbles() {
  bubbleContainer.innerHTML = "";

  rotateTagline();

  // Pool-da 4-dən az prompt qalıbsa → yenidən başla
  if (pool.length < 4) {
    pool = [...dynamicPrompts];
  }

  // 4 random seçirik və pool-dan çıxarırıq
  const selected = [];
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }

  // UI-yə bir-bir əlavə edirik (animasiya ilə)
  selected.forEach((text, i) => {
    const btn = document.createElement("button");
    btn.className = "bubble animated-bubble";
    btn.style.animationDelay = `${0.12 * i}s`; // delay-chain
    btn.textContent = text;

    btn.addEventListener("click", () => {
      input.value = text;
      input.focus();
    });

    bubbleContainer.appendChild(btn);
  });
}

// İlk dəfə yüklə
loadRandomBubbles();

// Hər 9 saniyədə bir dəyişsin
setInterval(loadRandomBubbles, 9000);