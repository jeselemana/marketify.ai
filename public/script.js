const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clearChat");
const bubbles = document.querySelectorAll(".bubble");
const center = document.querySelector(".center");
const form = document.getElementById("chat-form");

// 🟣 Mesaj əlavə etmə funksiyası
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  scrollToBottom();
  return msg;
}

// 🟡 “Marketify yazır...” effekti
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot", "typing");
  typing.textContent = "Marketify yazır...";
  chatBox.appendChild(typing);
  scrollToBottom();
  return typing;
}

// ✨ Cavabı hərf-hərf yazan funksiya
function typeText(element, text, speed = 20) {
  element.textContent = "";
  let i = 0;
  const interval = setInterval(() => {
    element.textContent += text.charAt(i);
    i++;
    scrollToBottom();
    if (i >= text.length) clearInterval(interval);
  }, speed);
}

// 🔵 Cavab göndərmə funksiyası
async function sendMessage(message) {
  if (!message.trim()) return;

  center.style.display = "none";
  addMessage("user", message);

  const typing = showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error("Server error");

    const data = await response.json();
    chatBox.removeChild(typing);

    // 🎨 Marketify Style tonu tətbiq et
    let reply = data.reply || "⚠️ Cavab alınmadı 😔";
    reply = reply
      .replaceAll("İlk olaraq,", "Başlayaq belə:")
      .replaceAll("Bu addımları izləyə bilərsən", "Gəlin birlikdə baxaq 👇")
      .replaceAll("Nəticədə", "Sonda isə")
      .replaceAll("Bu, sizə kömək edəcək", "Bu sənə real fərq yaradacaq 💡")
      .replaceAll("Uğurlar!", "Uğurlar, sən artıq fərqlisən 🚀");

    const botMsg = addMessage("bot", "");
    typeText(botMsg, reply, 18);
  } catch (error) {
    console.error(error);
    chatBox.removeChild(typing);
    addMessage("bot", "⚠️ Bağlantı xətası. Marketify AI hazırda oflayn rejimdədir.");
  }
}

// ✉️ Form göndərilməsi
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;
  sendMessage(message);
  input.value = "";
});

// ⌨️ Enter klavişinə dəstək
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    sendMessage(message);
    input.value = "";
  }
});

// 💡 Bubble klikləri
bubbles.forEach((bubble) => {
  bubble.addEventListener("click", () => {
    const message = bubble.innerText;
    bubbles.forEach((b) => (b.style.display = "none"));
    sendMessage(message);
  });
});

// ✅ Daha ağıllı scroll funksiyası (mobil üçün də problemsiz)
function scrollToBottom() {
  const nearBottom =
    chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 100;

  if (nearBottom) {
    requestAnimationFrame(() => {
      chatBox.scrollTo({
        top: chatBox.scrollHeight,
        behavior: "smooth",
      });
    });
  }
}

const observer = new MutationObserver(scrollToBottom);
observer.observe(chatBox, { childList: true });
document.addEventListener("DOMContentLoaded", scrollToBottom);

// ▼ Model dropdown
const modelButton = document.getElementById("modelButton");
const dropdownMenu = document.getElementById("dropdownMenu");

if (modelButton && dropdownMenu) {
  modelButton.addEventListener("click", () => {
    dropdownMenu.classList.toggle("show");
  });
  document.addEventListener("click", (e) => {
    if (!modelButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove("show");
    }
  });
}

// ⚠️ Popup və düymələr
const confirmPopup = document.getElementById("confirmPopup");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");

// 💬 Əsas “Təmizlə” kliklənəndə popup açılsın
if (clearBtn) {
  clearBtn.addEventListener("click", (e) => {
    e.preventDefault();
    confirmPopup.classList.add("show");
  });
}

// ❌ “Xeyr, ləğv et” kliklənəndə sadəcə popup bağlanır (ekran dəyişməsin)
if (confirmNo) {
  confirmNo.onclick = (e) => {
    e.preventDefault();
    confirmPopup.classList.remove("show");
    // Burada heç nə gizlətmirik!
  };
}

// ✅ “Təsdiqlə” kliklənəndə real təmizləmə
if (confirmYes) {
  confirmYes.onclick = async (e) => {
    e.preventDefault();
    confirmPopup.classList.remove("show");

    try {
      await fetch("/api/clear", { method: "POST" });
    } catch (err) {
      console.error("Clear error:", err);
    }

    chatBox.innerHTML = "";
    center.style.display = "flex";
    bubbles.forEach((b) => (b.style.display = "inline-block"));

    // 🎉 Bildiriş (Marketify tonda)
    const notice = document.createElement("div");
    notice.innerHTML = "💬 Yeni söhbət üçün hazırsan 😎";
    Object.assign(notice.style, {
      position: "fixed",
      bottom: "100px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "linear-gradient(135deg, #2d6bff, #60a5ff)",
      color: "#fff",
      padding: "12px 20px",
      borderRadius: "12px",
      boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
      fontSize: "14px",
      fontFamily: "'Poppins', sans-serif",
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
  };
}

// 💡 SMART SUGGESTIONS (təkrarsız)
document.addEventListener("DOMContentLoaded", () => {
  const ideas = [
    "AI ilə sosial media post ideyası ✨",
    "Yeni kampaniya sloqanı tap 💡",
    "Marketify AI ilə reklam mətni hazırla 🚀",
    "Brend üçün email mətni 💌",
    "Sosial media caption yarat 🤳",
    "Satış üçün təsirli bio mətni 📈",
    "Yeni məhsul təqdimatı üçün plan 🧠",
  ];

  const bubbles = document.querySelectorAll(".bubble");
  if (!bubbles.length) return;
  const ideasCopy = [...ideas];
  bubbles.forEach((bubble) => {
    if (ideasCopy.length === 0) return;
    const randomIndex = Math.floor(Math.random() * ideasCopy.length);
    const randomIdea = ideasCopy.splice(randomIndex, 1)[0];
    bubble.textContent = randomIdea;
  });
});

// 💡 Dinamik Tagline
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
  let lastTagline = "";
  function updateTagline() {
    let random;
    do {
      random = taglines[Math.floor(Math.random() * taglines.length)];
    } while (random === lastTagline);
    lastTagline = random;
    tagline.textContent = random;
  }
  updateTagline();
  setInterval(updateTagline, 10000);
});

// 💡 Marketify Shake Detection (v2.1 – iPhone + Android uyumlu)
function requestMotionAccess() {
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    // iOS 13+
    DeviceMotionEvent.requestPermission()
      .then((response) => {
        if (response === "granted") {
          initShakeDetection();
          if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            showInfoPopup("✅ Silkələmə aktivdir!");
          }
        } else {
          showInfoPopup("⚠️ Hərəkət icazəsi verilmədi!");
        }
      })
      .catch(() => showInfoPopup("⚠️ İcazə alınarkən xəta baş verdi."));
  } else {
    // Android və ya köhnə iOS
    initShakeDetection();
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      showInfoPopup("✅ Silkələmə aktivdir!");
    }
  }
}
// 👇 Başlatmaq üçün istifadəçi klik gözləyir (təhlükəsizlik səbəbi ilə)
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

      // Həssaslıq – 35 orta, 25 daha həssas
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
    </div>
  `;
  document.body.appendChild(popup);

  document.getElementById("shakeYes").addEventListener("click", () => {
    popup.remove();
    window.location.href =
      "mailto:supp.marketifym@gmail.com?subject=Marketify%202.0%20Xəta&body=Salam,%20saytda%20qarşılaşdığım%20xəta%20barədə:%20";
  });

  document.getElementById("shakeNo").addEventListener("click", () => popup.remove());
  setTimeout(() => popup.remove(), 8000);
}

// 💬 Kiçik info popup (icazə statusu üçün)
function showInfoPopup(text) {
  const info = document.createElement("div");
  info.className = "info-popup";
  info.textContent = text;
  document.body.appendChild(info);
  setTimeout(() => info.remove(), 3000);
}