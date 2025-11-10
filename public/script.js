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