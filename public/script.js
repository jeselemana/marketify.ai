const input = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const chatBox = document.getElementById("chat-box");
const centerMsg = document.querySelector(".center-message");
const clearBtn = document.getElementById("clear-btn");

let typingInterval;
let typingIndicator;

// 🧹 Çatı təmizləmə funksiyası
clearBtn.addEventListener("click", () => {
  chatBox.innerHTML = "";
  centerMsg.style.opacity = "1"; // “Hazıram” yazısı yenidən görünür
});

function showTyping() {
  typingIndicator = document.createElement("div");
  typingIndicator.classList.add("message", "bot", "typing");
  typingIndicator.textContent = "Marketify AI yazır";
  chatBox.appendChild(typingIndicator);

  let dots = 0;
  typingInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    typingIndicator.textContent = "Marketify AI yazır" + ".".repeat(dots);
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 500);
}

function hideTyping() {
  if (typingIndicator) typingIndicator.remove();
  clearInterval(typingInterval);
}

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  centerMsg.style.opacity = "0";
}

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";
  showTyping();

  try {
    const res = await fetch("http://localhost:5050/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    hideTyping();
    addMessage(data.reply, "bot");
  } catch {
    hideTyping();
    addMessage("⚠️ Bağlantı problemi. Marketify AI hazırda oflayn rejimdədir.", "bot");
  }
}

const modelBtn = document.getElementById("model-btn");
const modelMenu = document.getElementById("model-menu");

modelBtn.addEventListener("click", () => {
  modelMenu.style.display =
    modelMenu.style.display === "flex" ? "none" : "flex";
});
document.addEventListener("click", (e) => {
  if (!modelBtn.contains(e.target) && !modelMenu.contains(e.target)) {
    modelMenu.style.display = "none";
  }
});

/* mövcud chat və typing funksiyaları burada eynilə qalır */

// 🗑️ Çat təmizləmə düyməsi
document.getElementById("clearChat").addEventListener("click", () => {
  const chatBox = document.querySelector(".chat-box");
  chatBox.innerHTML = "";

  // Əgər mərkəzi mesaj görünməli olsa, yenidən göstər
  const centerMessage = document.querySelector(".center-message");
  if (centerMessage) {
    centerMessage.style.display = "block";
  }
});