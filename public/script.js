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

    // Typing effekti ilə cavabı göstər
    const botMsg = addMessage("bot", "");
    attachCopyButton(botMsg);
    typeText(botMsg, data.reply || "⚠️ Cavab alınmadı 😔", 18);
  } catch (error) {
    console.error(error);
    chatBox.removeChild(typing);
    addMessage(
      "bot",
      "⚠️ Bağlantı xətası. Marketify AI hazırda oflayn rejimdədir."
    );
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

// ✅ Avtomatik scroll funksiyası
function scrollToBottom() {
  requestAnimationFrame(() => {
    chatBox.scrollTo({
      top: chatBox.scrollHeight,
      behavior: "smooth",
    });
  });
}

// 🧩 Yeni mesaj əlavə olunanda avtomatik en
const observer = new MutationObserver(scrollToBottom);
observer.observe(chatBox, { childList: true });

// 🧠 Səhifə yüklənəndə avtomatik aşağıda başlasın
document.addEventListener("DOMContentLoaded", scrollToBottom);

// ▼ AÇILAN MENYU FUNKSİYASI
const modelButton = document.getElementById("modelButton");
const dropdownMenu = document.getElementById("dropdownMenu");

if (modelButton && dropdownMenu) {
  modelButton.addEventListener("click", () => {
    dropdownMenu.classList.toggle("show");
  });

  // Ekranın kənarına kliklənəndə menyunu bağla
  document.addEventListener("click", (e) => {
    if (!modelButton.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.remove("show");
    }
  });
}

// ⚠️ Təsdiq popup üçün
const confirmPopup = document.getElementById("confirmPopup");
const confirmYes = document.getElementById("confirmYes");
const confirmNo = document.getElementById("confirmNo");

if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    confirmPopup.classList.add("show");
  });
}

if (confirmNo) {
  confirmNo.addEventListener("click", () => {
    confirmPopup.classList.remove("show");
  });
}

if (confirmYes) {
  confirmYes.addEventListener("click", async () => {
    confirmPopup.classList.remove("show");

    // 💬 Söhbəti təmizləyir
    await fetch("/api/clear", { method: "POST" });
    chatBox.innerHTML = "";
    center.style.display = "flex";
    bubbles.forEach((b) => (b.style.display = "inline-block"));
  });
}
// 💡 SMART SUGGESTIONS (təkrarsız variant)
document.addEventListener("DOMContentLoaded", () => {
  const ideas = [
    "AI ilə sosial media post ideyası ✨",
    "Yeni kampaniya sloqanı tap 💡",
    "Marketify AI ilə reklam mətni hazırla 🚀",
    "Brend üçün email mətni 💌",
    "Sosial media caption yarad 🤳",
    "Satış üçün təsirli bio mətni 📈",
    "Yeni məhsul təqdimatı üçün plan 🧠",
  ];

  const bubbles = document.querySelectorAll(".bubble");
  if (!bubbles.length) return;

  // Təkrarsız ideyalar üçün kopya yaradılır
  const ideasCopy = [...ideas];

  bubbles.forEach((bubble) => {
    if (ideasCopy.length === 0) return;
    const randomIndex = Math.floor(Math.random() * ideasCopy.length);
    const randomIdea = ideasCopy.splice(randomIndex, 1)[0]; // seç + sil
    bubble.textContent = randomIdea;
  });
});
// 💬 Typing indicator göstər/gizlət
const typingIndicator = document.getElementById("typing-indicator");

// cavab göndərilərkən göstər
function showTypingIndicator() {
  typingIndicator.style.display = "flex";
}
// cavab gəldikdə gizlə
function hideTypingIndicator() {
  typingIndicator.style.display = "none";
}

// mövcud sendMessage funksiyasında dəyişiklik et:
async function sendMessage(message) {
  if (!message.trim()) return;

  center.style.display = "none";
  addMessage("user", message);

  showTypingIndicator();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();
    hideTypingIndicator();

    const botMsg = addMessage("bot", "");
    typeText(botMsg, data.reply || "⚠️ Cavab alınmadı 😔", 18);
  } catch (error) {
    hideTypingIndicator();
    addMessage("bot", "⚠️ Bağlantı xətası. Marketify AI hazırda oflayn rejimdədir.");
  }
}
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
  } while (random === lastTagline); // eyni cümlə olmasın
  lastTagline = random;
  tagline.textContent = random;
}

  updateTagline(); // səhifə açıldıqda
  setInterval(updateTagline, 10000); // 10 saniyədən bir dəyişsin
});
// 📋 Copy-Response düyməsi (Marketify AI 2.0)
document.addEventListener("click", async (e) => {
  if (e.target.classList.contains("copy-btn")) {
    const message = e.target.closest(".message").innerText;
    try {
      await navigator.clipboard.writeText(message);
      e.target.textContent = "✅";
      setTimeout(() => (e.target.textContent = "📋"), 1500);
    } catch (err) {
      console.error("Kopyalama xətası:", err);
    }
  }
});

// 📋 Copy düyməsi üçün funksionallıq (stabil versiya)
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatBox.appendChild(msg);

  // 🔹 Əgər botdursa, copy düyməsini əlavə et
  if (sender === "bot") {
    const copyBtn = document.createElement("button");
    copyBtn.classList.add("copy-btn");
    copyBtn.innerHTML = "📋";
    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.innerHTML = "✅";
        setTimeout(() => (copyBtn.innerHTML = "📋"), 1500);
      } catch (err) {
        console.error("Kopyalama xətası:", err);
      }
    });
    msg.appendChild(copyBtn);
  }

  scrollToBottom();
  return msg;
}
// 📋 Bot cavabına Copy düyməsi ilişdirən helper
function attachCopyButton(msgEl) {
  if (!msgEl || msgEl.querySelector(".copy-btn")) return; // təkrar olmasın
  const btn = document.createElement("button");
  btn.className = "copy-btn";
  btn.textContent = "📋";
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const text = msgEl.innerText.replace("📋", "").trim(); // yalnız mətn
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "✅";
      setTimeout(() => (btn.textContent = "📋"), 1200);
    } catch (err) {
      console.error("Kopyalama xətası:", err);
    }
  });
  msgEl.appendChild(btn);
}