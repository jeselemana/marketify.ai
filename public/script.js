const chatBox = document.getElementById("chat-box");
const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const clearBtn = document.getElementById("clearChat");
const bubbles = document.querySelectorAll(".bubble");
const center = document.querySelector(".center");

// 🟣 Mesaj əlavə etmə funksiyası
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 🟡 Bot typing effekti
function showTyping() {
  const typing = document.createElement("div");
  typing.classList.add("message", "bot", "typing");
  typing.textContent = "Marketify yazır...";
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;
  return typing;
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

    const data = await response.json();
    chatBox.removeChild(typing);
    addMessage("bot", data.reply || "⚠️ Cavab alınmadı 😔");
  } catch (error) {
    chatBox.removeChild(typing);
    addMessage("bot", "⚠️ Bağlantı xətası. Marketify AI hazırda oflayn rejimdədir.");
  }
}

// ✉️ “Göndər” düyməsi
sendBtn.addEventListener("click", () => {
  const message = input.value;
  sendMessage(message);
  input.value = "";
});

// ⌨️ “Enter” klavişi
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage(input.value);
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

// 🧹 Təmizlə düyməsi
clearBtn.addEventListener("click", () => {
  location.reload();
});