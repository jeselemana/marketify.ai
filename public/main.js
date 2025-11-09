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
  requestAnimationFrame(() => {
    msg.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

// 💬 Typing effekti
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot", "typing");
  typing.textContent = "Marketify yazır...";
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;
  return typing;
}

// 🟢 Cavab göndərmə funksiyası
async function sendMessage(message) {
  if (!message.trim()) return;

  center.style.display = "none"; // prompt hissəsini gizlə
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
    addMessage("bot", data.reply || "⚠️ Cavab alınmadı 😔");
  } catch (error) {
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
    sendMessage(message);
  });
});

// 🧹 Təmizlə düyməsi — yalnız chat hissəsini təmizləyir, center hissəsini bərpa edir
clearBtn.addEventListener("click", () => {
  chatBox.innerHTML = ""; // yalnız mesajları sil
  center.style.display = "flex"; // prompt hissəsini geri qaytar
  bubbles.forEach((b) => (b.style.display = "inline-flex")); // bubble-ları yenidən göstər
});

// ✅ Scroll avtomatik aşağı
function scrollToBottom() {
  chatBox.scrollTo({
    top: chatBox.scrollHeight,
    behavior: "smooth",
  });
}
const observer = new MutationObserver(scrollToBottom);
observer.observe(chatBox, { childList: true });