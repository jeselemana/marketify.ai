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

// ✅ Yalnız mobil üçün kartların görünməsi (CSS-də .show lazımdır)
let shouldHideCardsOnSend = false; // yalnız kart klikindən gələn göndərişlərdə gizlətmək üçün flaq

document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelector(".prompt-cards");
  // yalnız mobil ekranda (<=768px) görünüş animasiyasını aç
  if (cards && window.matchMedia("(max-width: 768px)").matches) {
    cards.classList.add("show"); // CSS-də .prompt-cards.show görünür
  }
});

// 🔽 Model menyusu
if (modelBtn && dropdownMenu && arrow) {
  modelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle("show");
    arrow.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!modelBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove("show");
      arrow.classList.remove("open");
    }
  });
}

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
  typing.textContent = "Marketify yazır...";
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

// 🔵 Cavab göndərmə
async function sendMessage(message) {
  if (!message.trim()) return;

  // Əsas başlıq (center) gizlənsin, amma kartlar yox
  const centerEl = document.querySelector(".center");
  if (centerEl) centerEl.style.display = "none";

  addMessage("user", message);
  const typing = showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
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
  } finally {
    // ✅ Kartları YALNIZ kart klikindən sonra göndərilən mesajda gizlət
    const cards = document.querySelector(".prompt-cards");
    if (cards && window.matchMedia("(max-width: 768px)").matches) {
      if (shouldHideCardsOnSend) {
        cards.style.display = "none";
        cards.classList.remove("show");
        shouldHideCardsOnSend = false; // reset
      } else {
        // adi yazılı mesajdırsa, kartlar qalır (heç nə etmirik)
      }
    }
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

    // 🟢 Center hissəsini yenidən göstər
    const centerView = document.getElementById("center-view");
    if (centerView) centerView.style.display = "flex";

    bubbles.forEach((b) => (b.style.display = "inline-block"));
    // burdan aşağı sənin qalan kodun olduğu kimi davam etsin

    // 🧹 Təmizlə sonrası kartları geri gətir (yalnız mobil)
    const cards = document.querySelector(".prompt-cards");
    if (cards && window.matchMedia("(max-width: 768px)").matches) {
      cards.style.display = "flex";
      // animasiya üçün:
      cards.classList.remove("show");
      // kiçik gecikmə ilə show əlavə edək ki, transition işləsin
      setTimeout(() => {
        cards.classList.add("show");
      }, 50);
    }

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

// 🌟 Dinamik tagline
document.addEventListener("DOMContentLoaded", () => {
  const tagline = document.querySelector(".tagline");
  if (!tagline) return;
  const taglines = [
    "Bu gün nə haqqında danışırıq? 😊",
    "Marketinq ideyaları ilə dolu bir günə hazırsan? 🚀",
    "Sən yaz, AI düşünsün 💡",
    "Yaradıcı gücünü AI ilə birləşdir ✨",
    "Reklam dünyasında inqilab buradan başlayır 🌍",
    "Bir az ilham, bir az AI 💬",
  ];
  let last = "";
  function updateTag() {
    let r;
    do {
      r = taglines[Math.floor(Math.random() * taglines.length)];
    } while (r === last);
    last = r;
    tagline.textContent = r;
  }
  updateTag();
  setInterval(updateTag, 10000);
});

// 💡 Shake Detection (v2.1 – iPhone + Android uyumlu)
function requestMotionAccess() {
  if (typeof DeviceMotionEvent.requestPermission === "function") {
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

// 💬 Kiçik info popup (yalnız mobil)
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

// 📱 Kart kliklənəndə mesaj göndər + kartları gizlət
document.querySelectorAll(".prompt-cards .card").forEach((card) => {
  card.addEventListener("click", () => {
    const input = document.getElementById("user-input");
    const form = document.getElementById("chat-form");
    const cards = document.querySelector(".prompt-cards");

    const message =
      card.querySelector("h3").textContent +
      " — " +
      card.querySelector("p").textContent;

    // Kartdan göndəriş → yalnız bu halda kartları gizlədəcəyik
    shouldHideCardsOnSend = true;

    input.value = message.trim();
    // dərhal göndər
    form.dispatchEvent(new Event("submit"));
  });
});