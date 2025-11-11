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

    const botMsg = addMessage("bot", "");
const replyText = data.reply || "⚠️ Cavab alınmadı 😔";
typeText(botMsg, replyText, 18);

// typing bitəndən bir az sonra copy düyməsini əlavə et
setTimeout(() => attachCopyButton(botMsg, replyText), replyText.length * 20 + 200);
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

    // ✨ Təmizlənmə animasiyası
    chatBox.style.transition = "opacity 0.4s ease";
    chatBox.style.opacity = "0.3";

    // 💬 Söhbəti təmizləyir
    setTimeout(async () => {
      await fetch("/api/clear", { method: "POST" });
      chatBox.innerHTML = "";
      chatBox.style.opacity = "1";
      center.style.display = "flex";
      bubbles.forEach((b) => (b.style.display = "inline-block"));
    }, 400);
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
clearBtn.addEventListener("click", () => {
  chatBox.style.opacity = "0.5";
  setTimeout(() => {
    chatBox.innerHTML = "";
    chatBox.style.opacity = "1";
  }, 300);
});